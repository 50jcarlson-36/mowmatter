import { createHash } from "node:crypto";
import { fail, uuid } from "../operations/access.mjs";

// Events accepted by Klaviyo are NOT evidence of carrier delivery.
export const KLAVIYO_REVISION = "2026-10-15";
export function createKlaviyoSMS({ env = process.env, fetcher = fetch } = {}) {
  const missing = () => [
    ...(!env.KLAVIYO_PRIVATE_API_KEY ? ["KLAVIYO_PRIVATE_API_KEY"] : []),
    ...[
      "MOW_SMS_ENABLED",
      "KLAVIYO_REGISTRATION_APPROVED",
      "KLAVIYO_FLOWS_VERIFIED",
    ].filter((key) => env[key] !== "true"),
  ];
  const configured = () => missing().length === 0;
  async function request(path, method = "GET", data) {
    if (!env.KLAVIYO_PRIVATE_API_KEY)
      throw fail("Klaviyo is not configured", 503);
    const response = await fetcher("https://a.klaviyo.com/api/" + path, {
      method,
      headers: {
        Authorization: "Klaviyo-API-Key " + env.KLAVIYO_PRIVATE_API_KEY,
        revision: KLAVIYO_REVISION,
        accept: "application/vnd.api+json",
        "Content-Type": "application/vnd.api+json",
      },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
      signal: AbortSignal.timeout(10000),
      redirect: "error",
    });
    // Do not expose provider error bodies (which can contain personal data).
    if (!response.ok) throw fail("Klaviyo request could not finish", 503);
    return response.status === 202 || response.status === 204
      ? null
      : response.json();
  }
  async function profile(phone) {
    const query = new URLSearchParams({
      filter: `equals(phone_number,${JSON.stringify(phone)})`,
      "additional-fields[profile]": "subscriptions",
      "page[size]": "2",
    });
    const result = await request("profiles/?" + query);
    if (!Array.isArray(result.data) || result.data.length > 1)
      throw fail("SMS subscription needs review", 503);
    return result.data[0];
  }
  async function send({
    to,
    body,
    idempotencyKey,
    category = "service",
    companyId,
    customerId,
    kind,
  }) {
    if (!configured()) throw fail("Klaviyo SMS is awaiting activation", 503);
    if (!/^\+1[2-9][0-9]{9}$/.test(to || ""))
      throw fail("Use a US phone number in E.164 format");
    if (!uuid(companyId) || !uuid(customerId))
      throw fail("SMS company and customer are required");
    if (
      !idempotencyKey ||
      idempotencyKey.length > 250 ||
      typeof body !== "string" ||
      !body.trim() ||
      body.length > 1600
    )
      throw fail("Invalid SMS request");
    if (!["marketing", "service"].includes(category))
      throw fail("Invalid SMS category");
    // Klaviyo owns carrier STOP/HELP and opt-outs. Read current consent on EVERY send.
    // Never subscribe from a send, import old preferences, or silently reverse a STOP.
    const contact = await profile(to);
    const subscriptions = contact?.attributes?.subscriptions?.sms;
    const marketing = subscriptions?.marketing;
    const transactional = subscriptions?.transactional;
    const allowed =
      category === "marketing"
        ? marketing?.consent === "SUBSCRIBED" &&
          marketing.can_receive_sms_marketing === true
        : (transactional?.consent === "SUBSCRIBED" &&
            transactional.can_receive_sms_transactional === true) ||
          (marketing?.consent === "SUBSCRIBED" &&
            marketing.can_receive_sms_marketing === true);
    if (!allowed || !contact?.id)
      throw fail("Customer Klaviyo SMS consent required", 409);
    const uniqueId = createHash("sha256").update(idempotencyKey).digest("hex");
    await request("events/", "POST", {
      data: {
        type: "event",
        attributes: {
          unique_id: uniqueId,
          properties: {
            message: body,
            company_id: companyId,
            customer_id: customerId,
            message_kind: kind || category,
            category,
            brand_attribution: "powered by Mowmatter",
          },
          metric: {
            data: {
              type: "metric",
              attributes: {
                name:
                  category === "marketing"
                    ? "MowMatter SMS Offer Requested"
                    : "MowMatter SMS Service Requested",
              },
            },
          },
          profile: { data: { type: "profile", id: contact.id } },
        },
      },
    });
    return { sid: "klaviyo:" + uniqueId };
  }
  // Retired Bird callbacks cannot change preferences or delivery state after migration.
  // Klaviyo delivery callbacks require a separately verified integration; never invent them.
  async function webhook(req, res) {
    if (req.url.split("?")[0] !== "/api/commerce/sms/bird/webhook")
      return false;
    res.writeHead(410, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    res.end(JSON.stringify({ error: "SMS provider retired" }));
    return true;
  }
  return { configured, missing, send, webhook };
}
