import twilio from "twilio";
import { fail, uuid } from "../operations/access.mjs";
export function createSMS({ backend: b, env = process.env, client } = {}) {
  const configured = () =>
    env.MOW_SMS_ENABLED === "true" &&
    env.TWILIO_REGISTRATION_APPROVED === "true" &&
    !!env.TWILIO_ACCOUNT_SID &&
    !!env.TWILIO_AUTH_TOKEN &&
    !!env.TWILIO_MESSAGING_SERVICE_SID &&
    !!env.TWILIO_WEBHOOK_URL &&
    !!env.TWILIO_STATUS_WEBHOOK_URL;
  const provider = () =>
    client ||
    twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN, {
      autoRetry: false,
      timeout: 10000,
    });
  async function sendQuote({ cid, user, quoteId }) {
    if (!configured())
      throw fail(
        "SMS is awaiting provider configuration and registration approval",
        503,
      );
    if (!uuid(quoteId)) throw fail("Choose a quote");
    const quote = (
      await b.db(
        "mow_customer_quotes?select=id,title,amount_cents&company_id=eq." +
          cid +
          "&id=eq." +
          quoteId,
      )
    )[0];
    if (!quote) throw fail("Quote unavailable", 404);
    const company = (
      await b.db("mow_crew_companies?select=name&id=eq." + cid)
    )[0];
    const claim = await b.db("rpc/mow_quote_sms_claim", "POST", {
      qid: quoteId,
      cid,
      actor: user.id,
    });
    if (!claim.claimed)
      throw fail(
        "This quote message was already sent or needs delivery review",
        409,
      );
    const url =
      "https://office.mowmatter.com/customer-account.html?" +
      new URLSearchParams({ business: cid, customer: claim.customer_id });
    const message = `${company.name} via MowMatter: Optional additional service, $${(quote.amount_cents / 100).toFixed(2)}. Review scope and approve or decline: ${url} No charge from this text. Reply STOP to opt out, HELP for help.`;
    // Do not retry uncertain sends: provider may have accepted the message before a timeout.
    try {
      const r = await provider().messages.create({
        messagingServiceSid: env.TWILIO_MESSAGING_SERVICE_SID,
        to: claim.phone,
        body: message,
        statusCallback: env.TWILIO_STATUS_WEBHOOK_URL,
      });
      await b.db(
        "mow_quote_messages?quote_id=eq." + quoteId + "&company_id=eq." + cid,
        "PATCH",
        {
          status: "accepted",
          provider_id: r.sid,
          updated_at: new Date().toISOString(),
        },
      );
      return { ok: true, status: "accepted" };
    } catch (e) {
      throw fail(
        "Message delivery needs review before retrying. The quote remains available in the customer account.",
        503,
      );
    }
  }
  async function webhook(req, res) {
    const path = req.url.split("?")[0];
    if (
      !["/api/commerce/sms/webhook", "/api/commerce/sms/status"].includes(path)
    )
      return false;
    const respond = (status, xml = "<Response/>") => {
      res.writeHead(status, {
        "Content-Type": "text/xml",
        "Cache-Control": "no-store",
      });
      res.end(xml);
    };
    try {
      if (
        req.method !== "POST" ||
        !req.headers["content-type"]?.startsWith(
          "application/x-www-form-urlencoded",
        )
      ) {
        respond(400);
        return true;
      }
      let raw = "";
      for await (const chunk of req) {
        raw += chunk;
        if (raw.length > 8192) throw fail("Too large", 413);
      }
      const params = Object.fromEntries(new URLSearchParams(raw));
      const url = path.endsWith("/status")
        ? env.TWILIO_STATUS_WEBHOOK_URL
        : env.TWILIO_WEBHOOK_URL;
      if (
        !env.TWILIO_AUTH_TOKEN ||
        !url ||
        new URL(url).pathname !== path ||
        !twilio.validateRequest(
          env.TWILIO_AUTH_TOKEN,
          req.headers["x-twilio-signature"] || "",
          url,
          params,
        )
      ) {
        respond(403);
        return true;
      }
      if (params.AccountSid !== env.TWILIO_ACCOUNT_SID) {
        respond(403);
        return true;
      }
      if (path.endsWith("/status")) {
        const status = {
          queued: "accepted",
          sending: "accepted",
          sent: "sent",
          delivered: "delivered",
          undelivered: "undelivered",
          failed: "failed",
        }[params.MessageStatus];
        if (status && /^SM[0-9a-f]{32}$/i.test(params.MessageSid || ""))
          await b.db(
            "mow_quote_messages?provider_id=eq." +
              params.MessageSid +
              "&status=not.in.(delivered,undelivered,failed)",
            "PATCH",
            { status, updated_at: new Date().toISOString() },
          );
      } else {
        const keyword = (params.Body || "").trim().toUpperCase();
        if (
          params.OptOutType === "STOP" ||
          [
            "STOP",
            "STOPALL",
            "UNSUBSCRIBE",
            "CANCEL",
            "END",
            "QUIT",
            "REVOKE",
            "OPT OUT",
          ].includes(keyword)
        ) {
          if (!/^\+1[2-9][0-9]{9}$/.test(params.From || ""))
            throw fail("Invalid phone");
          await b.db("rpc/mow_sms_stop", "POST", { p_phone: params.From });
        }
        // Advanced Opt-Out sends its own STOP/HELP responses; do not send duplicates.
        else if (!params.OptOutType && ["HELP", "INFO"].includes(keyword)) {
          respond(
            200,
            "<Response><Message>MowMatter help: https://mowmatter.com/contact.html. Reply STOP to opt out. Messages are optional.</Message></Response>",
          );
          return true;
        }
      }
      respond(200);
    } catch (e) {
      respond(e.status || 503);
    }
    return true;
  }
  return { sendQuote, webhook, configured };
}
