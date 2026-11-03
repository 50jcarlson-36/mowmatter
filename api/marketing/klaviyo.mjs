import { timingSafeEqual } from "node:crypto";

// Mow Matter's own marketing to lawn business owners, synced to Klaviyo.
// Homeowner texts (quote offers, arrival/completion) stay on Bird and never reach Klaviyo.
const API = "https://a.klaviyo.com/api/";
const REVISION = "2024-10-15";
const PHONE = /^\+1[2-9][0-9]{9}$/;
const EMAIL = /^\S+@[^\s@]+\.[^\s@]+$/;

export function createKlaviyo({
  backend: b,
  env = process.env,
  fetcher = fetch,
} = {}) {
  const missing = () => {
    const list = [
      "KLAVIYO_PRIVATE_API_KEY",
      "KLAVIYO_LIST_ID",
      "KLAVIYO_WEBHOOK_SECRET",
    ].filter((k) => !env[k]);
    if (env.MOW_KLAVIYO_ENABLED !== "true") list.push("MOW_KLAVIYO_ENABLED");
    return list;
  };
  const configured = () => missing().length === 0;
  const status = () => ({ enabled: configured(), missing: missing() });

  async function call(path, body) {
    const r = await fetcher(API + path, {
      method: "POST",
      headers: {
        Authorization: "Klaviyo-API-Key " + env.KLAVIYO_PRIVATE_API_KEY,
        revision: REVISION,
        accept: "application/vnd.api+json",
        "content-type": "application/vnd.api+json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) throw Error("Klaviyo rejected " + path + " (" + r.status + ")");
  }

  const subscriptions = (channels, consent) => ({
    ...(channels.email ? { email: { marketing: { consent } } } : {}),
    ...(channels.sms ? { sms: { marketing: { consent } } } : {}),
  });
  const job = (type, lead, channels, consent) => ({
    data: {
      type,
      attributes: {
        ...(consent === "SUBSCRIBED"
          ? { custom_source: "Mow Matter Office" }
          : {}),
        profiles: {
          data: [
            {
              type: "profile",
              attributes: {
                ...(channels.email ? { email: lead.email } : {}),
                ...(channels.sms ? { phone_number: lead.phone } : {}),
                subscriptions: subscriptions(channels, consent),
              },
            },
          ],
        },
      },
      relationships: {
        list: { data: { type: "list", id: env.KLAVIYO_LIST_ID } },
      },
    },
  });

  // Push one queued consent change. Leads who never consented are not created in Klaviyo.
  async function syncNext() {
    if (!configured()) return { status: "disabled" };
    const lead = await b.db("rpc/mowmatter_klaviyo_claim", "POST", {});
    if (!lead?.claimed) return { status: lead?.status || "idle" };
    const subscribe = {
      email: lead.email_marketing,
      sms: lead.sms_marketing && PHONE.test(lead.phone || ""),
    };
    const unsubscribe = lead.previously_synced
      ? {
          email: !subscribe.email,
          sms: !subscribe.sms && PHONE.test(lead.phone || ""),
        }
      : { email: false, sms: false };
    let ok = true;
    try {
      if (subscribe.email || subscribe.sms) {
        await call("profile-import", {
          data: {
            type: "profile",
            attributes: {
              email: lead.email,
              ...(lead.first_name ? { first_name: lead.first_name } : {}),
              ...(lead.company ? { organization: lead.company } : {}),
              properties: { mow_matter_audience: "lawn_business" },
            },
          },
        });
        await call(
          "profile-subscription-bulk-create-jobs",
          job(
            "profile-subscription-bulk-create-job",
            lead,
            subscribe,
            "SUBSCRIBED",
          ),
        );
      }
      if (unsubscribe.email || unsubscribe.sms)
        await call(
          "profile-subscription-bulk-delete-jobs",
          job(
            "profile-subscription-bulk-delete-job",
            lead,
            unsubscribe,
            "UNSUBSCRIBED",
          ),
        );
    } catch {
      // Subscription jobs are idempotent; a failed row waits for the next consent change or a manual requeue.
      ok = false;
    }
    await b.db("rpc/mowmatter_klaviyo_done", "POST", {
      p_id: lead.id,
      p_version: lead.version,
      p_ok: ok,
    });
    return { status: ok ? "accepted" : "failed" };
  }

  // Klaviyo flow webhooks ("Unsubscribed from Email/SMS Marketing") report opt-outs made in Klaviyo,
  // so Mow Matter and Bird stop too. Authenticated with a shared bearer secret.
  async function webhook(req, res) {
    if (req.url.split("?")[0] !== "/api/marketing/klaviyo/unsubscribe")
      return false;
    const reply = (code) => {
      res.writeHead(code, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      res.end("{}");
    };
    const secret = env.KLAVIYO_WEBHOOK_SECRET || "";
    const given = Buffer.from(String(req.headers.authorization || ""));
    const expected = Buffer.from("Bearer " + secret);
    if (
      !secret ||
      given.length !== expected.length ||
      !timingSafeEqual(given, expected)
    ) {
      reply(403);
      return true;
    }
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
      if (raw.length > 4096) {
        reply(413);
        return true;
      }
    }
    let event;
    try {
      event = JSON.parse(raw);
    } catch {
      reply(400);
      return true;
    }
    const email = String(event?.email || "")
      .trim()
      .toLowerCase();
    const phone = String(event?.phone || "").trim();
    if (
      !(event?.channel === "email" && EMAIL.test(email)) &&
      !(event?.channel === "sms" && PHONE.test(phone))
    ) {
      reply(400);
      return true;
    }
    try {
      await b.db("rpc/mowmatter_marketing_unsubscribe", "POST", {
        p_channel: event.channel,
        p_email: email || null,
        p_phone: phone || null,
      });
      reply(200);
    } catch {
      // A non-2xx response leaves the unsubscribe visible as failed in the Klaviyo flow's webhook log.
      reply(503);
    }
    return true;
  }

  return { configured, status, syncNext, webhook };
}
