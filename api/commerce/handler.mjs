import { createSMS } from "./sms.mjs";
import { backend, fail, jsonBody, uuid } from "../operations/access.mjs";
export function createCommerce(options = {}) {
  const b = options.backend || backend(options);
  const sms = createSMS({ ...options, backend: b });
  return async (req, res, send) => {
    const path = req.url.split("?")[0];
    if (!path.startsWith("/api/commerce/")) return false;
    try {
      if (req.method !== "POST") throw fail("POST required", 405);
      if (!req.headers["content-type"]?.startsWith("application/json"))
        throw fail("Send JSON", 415);
      const input = await jsonBody(req, 12000),
        cid = input.company_id;
      if (path.endsWith("/propose-visit")) {
        const user = await b.user(req);
        if (!user.email_confirmed_at)
          throw fail("Verified account required", 401);
        if (!uuid(input.job_id) || !uuid(input.id))
          throw fail("Choose a visit");
        send(200, {
          ok: await b.db("rpc/mow_visit_propose", "POST", {
            actor: user.id,
            jid: input.job_id,
            rid: input.id,
            t: input.title,
            d: input.scope,
          }),
        });
        return true;
      }
      if (!uuid(cid)) throw fail("Choose a business");
      const customerAction = [
        "customer",
        "request",
        "respond",
        "sms-preferences",
      ].includes(path.split("/").pop());
      const user = customerAction ? await b.user(req) : await b.owner(req, cid);
      if (!user.email_confirmed_at) throw fail("Use a verified account", 401);
      const cu = input.customer_id;
      if (customerAction) {
        if (!uuid(cu)) throw fail("Choose a customer");
        const rows = await b.db(
          "mow_customers?select=id,email&company_id=eq." + cid + "&id=eq." + cu,
        );
        if (
          !rows[0]?.email ||
          rows[0].email.toLowerCase() !== user.email?.toLowerCase()
        )
          throw fail("Customer access denied", 403);
      }
      const action = path.split("/").pop();
      if (action === "send-quote-sms") {
        send(200, await sms.sendQuote({ cid, user, quoteId: input.id }));
        return true;
      }
      if (action === "sms-preferences") {
        if (
          !/^\+1[2-9][0-9]{9}$/.test(input.phone || "") ||
          typeof input.consent !== "boolean"
        )
          throw fail("Enter a US mobile number with +1");
        send(200, {
          ok: await b.db("rpc/mow_sms_preferences", "POST", {
            actor: user.id,
            actor_email: user.email,
            cid,
            customer: cu,
            p_phone: input.phone,
            consent: input.consent,
          }),
        });
        return true;
      }
      if (["owner", "customer"].includes(action)) {
        const scope =
          "company_id=eq." +
          cid +
          (customerAction ? "&customer_id=eq." + cu : "");
        const [quotes, requests] = await Promise.all([
          b.db(
            "mow_customer_quotes?select=*&" +
              scope +
              "&order=created_at.desc&limit=100",
          ),
          b.db(
            "mow_customer_requests?select=id,customer_id,kind,job_id,message,preferred_date,state,owner_response,created_at&" +
              scope +
              "&order=created_at.desc&limit=100",
          ),
        ]);
        const channels = customerAction
          ? await b.db(
              "mow_customer_channels?select=phone,sms_offer_consent&company_id=eq." +
                cid +
                "&customer_id=eq." +
                cu,
            )
          : [];
        const proposals = customerAction
          ? []
          : await b.db(
              "mow_visit_proposals?select=id,customer_id,job_id,title,scope,state,created_at&company_id=eq." +
                cid +
                "&order=created_at.desc&limit=100",
            );
        send(200, {
          quotes,
          requests,
          channels,
          proposals,
          sms_enabled: sms.configured(),
        });
        return true;
      }
      if (
        ![
          "request",
          "resolve",
          "quote",
          "respond",
          "withdraw",
          "book",
          "apply-addon",
        ].includes(action)
      )
        throw fail("Unknown action", 404);
      if (!uuid(cu) || !uuid(input.id)) throw fail("Choose a valid record");
      // No browser price is used for a payment. Quote prices are deliberately owner-authored.
      if (
        action === "quote" &&
        (!Number.isSafeInteger(input.amount_cents) ||
          input.amount_cents < 1 ||
          input.amount_cents > 10000000 ||
          input.confirm_review !== true)
      )
        throw fail("Review a valid quote amount");
      if (
        action === "respond" &&
        input.choice === "accepted" &&
        input.confirm_quote !== true
      )
        throw fail("Review scope, terms and price first");
      const result = await b.db("rpc/mow_commerce_action", "POST", {
        actor: user.id,
        actor_email: user.email,
        cid,
        customer: cu,
        command: action,
        payload: input,
      });
      send(200, result);
    } catch (e) {
      send(e.status || 503, {
        error: e.status
          ? e.message
          : "This action could not finish. Refresh and try again.",
      });
    }
    return true;
  };
}
