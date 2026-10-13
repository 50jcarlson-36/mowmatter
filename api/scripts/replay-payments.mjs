// Explicit operator command; it is not scheduled or run by the application.
import Stripe from "stripe";
import { Readable } from "node:stream";
import { createBilling } from "../billing/billing.mjs";
const env = process.env,
  key = env.STRIPE_SECRET_KEY || env.stripe_live_secret_key,
  dbkey =
    env.SUPABASE_SECRET_KEY ||
    env.SUPABASE_SERVICE_ROLE_KEY ||
    env.supabase_api_secret_key;
if (!key || !dbkey)
  throw Error(
    "Configure the intended Stripe environment and server database credentials",
  );
const live = env.STRIPE_MODE !== "sandbox";
if (/^(sk|rk)_test_/.test(key) === live)
  throw Error("Stripe key and STRIPE_MODE disagree");
const stripe = new Stripe(key, {
  apiVersion: "2026-08-26.dahlia",
  maxNetworkRetries: 2,
});
const response = await fetch(
  "https://pzymmsfjgspvzbivzvkx.supabase.co/rest/v1/mow_webhook_inbox?processed_at=is.null&order=received_at.asc&limit=100",
  {
    headers: {
      apikey: dbkey,
      ...(dbkey.startsWith("eyJ") ? { Authorization: "Bearer " + dbkey } : {}),
    },
    signal: AbortSignal.timeout(12000),
  },
);
if (!response.ok) throw Error("Could not read the pending webhook inbox");
const pending = await response.json(),
  handler = createBilling({ env, stripeClient: stripe });
let failed = 0;
for (const item of pending) {
  if (item.livemode !== live) continue;
  try {
    const event = await stripe.events.retrieve(
      item.event_id,
      {},
      item.account_id ? { stripeAccount: item.account_id } : {},
    );
    if (
      event.livemode !== live ||
      event.id !== item.event_id ||
      (event.account || null) !== item.account_id
    )
      throw Error("Event environment or account mismatch");
    const secret = item.account_id
      ? env.STRIPE_CONNECT_WEBHOOK_SECRET
      : env.STRIPE_WEBHOOK_SECRET || env.stripe_webhook_secret;
    if (!secret) throw Error("Configure the matching webhook secret");
    const payload = JSON.stringify(event),
      req = Readable.from([Buffer.from(payload)]);
    req.method = "POST";
    req.url = item.account_id
      ? "/api/billing/connect/webhook"
      : "/api/billing/webhook";
    req.headers = {
      "stripe-signature": Stripe.webhooks.generateTestHeaderString({
        payload,
        secret,
      }),
    };
    let status;
    await handler(req, {
      writeHead(code) {
        status = code;
      },
      end() {},
    });
    if (status !== 200) throw Error("Event remains pending");
    console.log(item.event_id + ": recovered");
  } catch {
    failed++;
    console.error(item.event_id + ": requires review; retained in inbox");
  }
}
if (failed) process.exitCode = 1;
