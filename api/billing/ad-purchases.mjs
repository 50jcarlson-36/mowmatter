import { timingSafeEqual, createHash } from "node:crypto";
// Google Ads purchase measurement for paid Office subscriptions. Off unless
// GOOGLE_ADS_PURCHASE_ENABLED=true. Only a Google click ID saved with the
// visitor's analytics consent is used; Google receives the click ID, the
// conversion time and the subscription value, nothing else.
const GCLID = /^[A-Za-z0-9_-]{10,400}$/;
const DAY = 86400000;
const TIME_ZONE = "America/New_York";
const clean = (v) =>
  String(v)
    .replace(/[\r\n",]/g, " ")
    .trim();
const same = (a, b) =>
  timingSafeEqual(
    createHash("sha256").update(String(a)).digest(),
    createHash("sha256").update(String(b)).digest(),
  );
export function easternTime(ms) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(ms))
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
}
export function adPurchases({ db, env = process.env, now = Date.now }) {
  const enabled = env.GOOGLE_ADS_PURCHASE_ENABLED === "true";
  const name = env.GOOGLE_ADS_PURCHASE_CONVERSION_NAME;
  const user = env.GOOGLE_ADS_UPLOAD_USER,
    password = env.GOOGLE_ADS_UPLOAD_PASSWORD;
  async function saveClick(cid, body) {
    if (!enabled) return { saved: false };
    const consented = Number(body.consented_at);
    if (
      typeof body.gclid !== "string" ||
      !GCLID.test(body.gclid) ||
      !Number.isSafeInteger(consented) ||
      consented > now() + 300000 ||
      consented < now() - 8 * DAY
    )
      throw Object.assign(Error("Invalid ad click"), { status: 400 });
    const saved = await db("rpc/mow_ad_click_save", "POST", {
      cid,
      click: body.gclid,
      consented: new Date(consented).toISOString(),
    });
    return { saved: saved === true };
  }
  // First paid subscription only; later renewals and plan changes are ignored by the database.
  async function recordPurchase(cid, state, sub, eventCreated) {
    if (!enabled || !state.paid) return false;
    const invoice =
      typeof sub.latest_invoice === "object" ? sub.latest_invoice : null;
    const cents = Number.isSafeInteger(invoice?.amount_paid)
      ? invoice.amount_paid
      : null;
    const paidAt = invoice?.status_transitions?.paid_at || eventCreated;
    if (cents === null || !Number.isSafeInteger(paidAt)) return false;
    return (
      (await db("rpc/mow_ad_purchase_record", "POST", {
        cid,
        cents,
        cur: String(invoice.currency || "usd").toUpperCase(),
        at: new Date(paidAt * 1000).toISOString(),
      })) === true
    );
  }
  // Scheduled upload source for Google Ads (Conversions → Uploads → Schedules, HTTPS).
  async function feed(req) {
    if (!enabled || !name || !user || !password) return { status: 404 };
    const auth = req.headers.authorization || "";
    const [u, p] = auth.startsWith("Basic ")
      ? Buffer.from(auth.slice(6), "base64").toString().split(/:(.*)/s)
      : [];
    if (!(same(u ?? "", user) & same(p ?? "", password)))
      return { status: 401 };
    const since = new Date(now() - 30 * DAY).toISOString();
    const rows = await db(
      "mow_ad_clicks?select=gclid,purchase_at,value_cents,currency&purchase_at=gte." +
        encodeURIComponent(since) +
        "&order=purchase_at.asc&limit=5000",
    );
    const lines = [
      "Parameters:TimeZone=" + TIME_ZONE,
      "Google Click ID,Conversion Name,Conversion Time,Conversion Value,Conversion Currency",
      ...rows
        .filter((r) => GCLID.test(r.gclid) && /^[A-Z]{3}$/.test(r.currency))
        .map((r) =>
          [
            r.gclid,
            clean(name),
            easternTime(Date.parse(r.purchase_at)),
            (r.value_cents / 100).toFixed(2),
            r.currency,
          ].join(","),
        ),
    ];
    return { status: 200, body: lines.join("\r\n") + "\r\n" };
  }
  return { enabled, saveClick, recordPurchase, feed };
}
