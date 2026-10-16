import { BirdClient } from "@messagebird/sdk";
import { fail } from "../operations/access.mjs";
const phone = (v) => /^\+1[2-9][0-9]{9}$/.test(v || "");
const reference = (v) => /^sms_[A-Za-z0-9]+$/.test(v || "");
export function createBirdSMS({ backend: b, env = process.env, client } = {}) {
  const missing = () => {
    const list = [
      "BIRD_API_KEY",
      "BIRD_SMS_FROM",
      "BIRD_WORKSPACE_ID",
      "BIRD_WEBHOOK_SECRET",
    ].filter((k) => !env[k]);
    if (env.BIRD_SMS_FROM && !phone(env.BIRD_SMS_FROM))
      list.push("BIRD_SMS_FROM (approved US number)");
    for (const k of [
      "MOW_SMS_ENABLED",
      "BIRD_REGISTRATION_APPROVED",
      "BIRD_WEBHOOKS_VERIFIED",
    ])
      if (env[k] !== "true") list.push(k);
    return list;
  };
  const configured = () => missing().length === 0;
  let sdk;
  const provider = () =>
    client ||
    (sdk ||= new BirdClient({
      apiKey: env.BIRD_API_KEY,
      maxRetries: 0,
      timeout: 10000,
      webhooks: { secret: env.BIRD_WEBHOOK_SECRET },
    }));
  async function send({ to, body, idempotencyKey, category = "service" }) {
    if (!configured())
      throw fail("Bird SMS is awaiting provider activation", 503);
    if (!phone(to)) throw fail("Use a US phone number in E.164 format");
    const r = await provider().sms.send(
      { from: env.BIRD_SMS_FROM, to, text: body, category },
      {
        maxRetries: 0,
        timeout: 10000,
        ...(idempotencyKey ? { idempotencyKey } : {}),
      },
    );
    if (
      !reference(r.id) ||
      !["accepted", "sent", "delivered"].includes(r.status)
    )
      throw Error("Bird did not accept the message");
    return { sid: "bird:" + r.id };
  }
  async function webhook(req, res) {
    if (req.url.split("?")[0] !== "/api/commerce/sms/bird/webhook")
      return false;
    const reply = (code) => {
      res.writeHead(code, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      res.end("{}");
    };
    try {
      if (
        req.method !== "POST" ||
        !req.headers["content-type"]?.startsWith("application/json")
      ) {
        reply(400);
        return true;
      }
      let raw = "",
        size = 0;
      for await (const chunk of req) {
        size += Buffer.byteLength(chunk);
        if (size > 32768) throw fail("Too large", 413);
        raw += chunk;
      }
      if (!env.BIRD_WEBHOOK_SECRET || !env.BIRD_WORKSPACE_ID) {
        reply(403);
        return true;
      }
      let event;
      try {
        event = provider().webhooks.unwrap(raw, req.headers);
      } catch {
        reply(403);
        return true;
      }
      // Bird's test sends carry only a type. They verify reachability without changing data.
      if (!event.data) {
        reply(200);
        return true;
      }
      const data = event.data;
      if (data.workspace_id !== env.BIRD_WORKSPACE_ID) {
        reply(403);
        return true;
      }
      if (event.type === "sms.received") {
        if (
          data.to !== env.BIRD_SMS_FROM ||
          !phone(data.from) ||
          !reference(data.sms_id)
        ) {
          reply(400);
          return true;
        }
        const keyword = String(data.text || "")
          .trim()
          .toUpperCase();
        if (
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
        )
          await b.db("rpc/mow_sms_stop", "POST", { p_phone: data.from });
        // Bird keyword rules provide STOP/HELP responses. YES/START never approve work or restore consent.
      } else if (event.type === "sms_suppression.created") {
        if (data.originator !== env.BIRD_SMS_FROM || !phone(data.destination)) {
          reply(400);
          return true;
        }
        await b.db("rpc/mow_sms_stop", "POST", { p_phone: data.destination });
      } else {
        const status = {
          "sms.accepted": "accepted",
          "sms.sent": "sent",
          "sms.delivered": "delivered",
          "sms.undelivered": "undelivered",
          "sms.failed": "failed",
          "sms.rejected": "failed",
          "sms.expired": "undelivered",
        }[event.type];
        if (status) {
          if (data.from !== env.BIRD_SMS_FROM || !reference(data.sms_id)) {
            reply(400);
            return true;
          }
          for (const table of [
            "mow_quote_messages",
            "mow_visit_sms_messages",
            "mow_route_notices",
            "mow_sms_confirmations",
          ])
            await b.db(
              table +
                "?provider_id=eq.bird:" +
                data.sms_id +
                "&status=" +
                (status === "accepted"
                  ? "eq.sending"
                  : status === "sent"
                    ? "in.(sending,accepted)"
                    : "not.in.(delivered,undelivered,failed)"),
              "PATCH",
              { status, updated_at: new Date().toISOString() },
            );
        }
      }
      // Mutations are idempotent: repeat STOP and delivery events do not send replies or restore consent.
      reply(200);
    } catch (e) {
      reply(e.status || 503);
    }
    return true;
  }
  return { configured, missing, send, webhook };
}
