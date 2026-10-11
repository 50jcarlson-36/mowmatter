import { tokenGenerate, verifySignature } from "@vonage/jwt";
import { createHash } from "node:crypto";
import { fail, uuid } from "../operations/access.mjs";
const inbound = "/api/commerce/sms/vonage/inbound",
  statusPath = "/api/commerce/sms/vonage/status";
const phone = (v) =>
  /^1[2-9][0-9]{9}$/.test(String(v || "").replace(/^\+/, ""));
export function createVonage({
  backend: b,
  env = process.env,
  fetcher = fetch,
  makeToken = tokenGenerate,
} = {}) {
  const missing = () => {
    const list = [
      "VONAGE_API_KEY",
      "VONAGE_APPLICATION_ID",
      "VONAGE_PRIVATE_KEY",
      "VONAGE_SIGNATURE_SECRET",
      "VONAGE_SMS_FROM",
    ].filter((k) => !env[k]);
    if (env.VONAGE_SMS_FROM && !phone(env.VONAGE_SMS_FROM))
      list.push("VONAGE_SMS_FROM (approved US number)");
    for (const k of [
      "MOW_SMS_ENABLED",
      "VONAGE_REGISTRATION_APPROVED",
      "VONAGE_WEBHOOKS_VERIFIED",
    ])
      if (env[k] !== "true") list.push(k);
    return list;
  };
  const configured = () => missing().length === 0;
  async function send(data) {
    if (!configured())
      throw fail("Vonage SMS is awaiting provider activation", 503);
    const jwt = makeToken(
      env.VONAGE_APPLICATION_ID,
      env.VONAGE_PRIVATE_KEY.replaceAll("\\n", "\n"),
      { ttl: 300 },
    );
    const response = await fetcher("https://api.nexmo.com/v1/messages", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + jwt,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        to: data.to.replace(/^\+/, ""),
        from: env.VONAGE_SMS_FROM.replace(/^\+/, ""),
        channel: "sms",
        message_type: "text",
        text: data.body,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw Error("Vonage did not accept the message");
    const r = await response.json();
    if (!uuid(r.message_uuid))
      throw Error("Missing provider message reference");
    return { sid: "vonage:" + r.message_uuid };
  }
  async function webhook(req, res) {
    const path = req.url.split("?")[0];
    if (![inbound, statusPath].includes(path)) return false;
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
      let raw = "";
      for await (const chunk of req) {
        raw += chunk;
        if (raw.length > 16384) throw fail("Too large", 413);
      }
      const token = (req.headers.authorization || "").match(
        /^Bearer ([A-Za-z0-9_.-]+)$/,
      )?.[1];
      if (
        !token ||
        !env.VONAGE_SIGNATURE_SECRET ||
        !verifySignature(token, env.VONAGE_SIGNATURE_SECRET)
      ) {
        reply(403);
        return true;
      }
      const header = JSON.parse(
          Buffer.from(token.split(".")[0], "base64url").toString(),
        ),
        claims = JSON.parse(
          Buffer.from(token.split(".")[1], "base64url").toString(),
        );
      if (
        header.alg !== "HS256" ||
        claims.api_key !== env.VONAGE_API_KEY ||
        !Number.isFinite(claims.iat) ||
        Math.abs(Date.now() / 1000 - claims.iat) > 300 ||
        claims.payload_hash !== createHash("sha256").update(raw).digest("hex")
      ) {
        reply(403);
        return true;
      }
      const data = JSON.parse(raw);
      if (data.channel !== "sms" || !uuid(data.message_uuid)) {
        reply(400);
        return true;
      }
      if (path === statusPath) {
        const status = {
          submitted: "accepted",
          delivered: "delivered",
          rejected: "failed",
          undeliverable: "undelivered",
        }[data.status];
        if (status)
          await b.db(
            "mow_quote_messages?provider_id=eq.vonage:" +
              data.message_uuid +
              "&status=not.in.(delivered,undelivered,failed)",
            "PATCH",
            { status, updated_at: new Date().toISOString() },
          );
        if (status)
          await b.db(
            "mow_visit_sms_messages?provider_id=eq.vonage:" +
              data.message_uuid +
              "&status=not.in.(delivered,undelivered,failed)",
            "PATCH",
            { status, updated_at: new Date().toISOString() },
          );
      } else {
        if (
          !phone(data.from) ||
          data.to?.replace(/^\+/, "") !==
            env.VONAGE_SMS_FROM?.replace(/^\+/, "")
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
          await b.db("rpc/mow_sms_stop", "POST", {
            p_phone: "+" + data.from.replace(/^\+/, ""),
          });
        // Vonage campaign must provide carrier/provider STOP/HELP responses before activation.
        // Other replies, including YES or START, never approve work, charge or restore consent.
      }
      reply(200);
    } catch (e) {
      reply(e.status || 503);
    }
    return true;
  }
  return { configured, missing, send, webhook };
}
