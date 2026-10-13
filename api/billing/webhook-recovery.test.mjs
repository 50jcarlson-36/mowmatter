import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import Stripe from "stripe";
import { createBilling } from "./billing.mjs";
const secret = "whsec_fake_unit",
  job = "11111111-1111-4111-8111-111111111111",
  company = "22222222-2222-4222-8222-222222222222";
async function call(
  handler,
  event,
  path = "/api/billing/connect/webhook",
  signature,
) {
  const payload = JSON.stringify(event),
    req = Readable.from([Buffer.from(payload)]);
  req.url = path;
  req.method = "POST";
  req.headers = {
    "stripe-signature":
      signature ||
      Stripe.webhooks.generateTestHeaderString({ payload, secret }),
  };
  let status, result;
  await handler(req, {
    writeHead(s) {
      status = s;
    },
    end(body) {
      result = JSON.parse(body);
    },
  });
  return { status, result };
}
function harness({ mapped = true, live = true, dbFailure = false } = {}) {
  const calls = [],
    client = new Stripe("sk_test_fake_unit");
  client.checkout.sessions.retrieve = async () => ({
    id: "cs_early",
    mode: "payment",
    currency: "usd",
    amount_total: 5000,
    payment_status: "paid",
    metadata: {
      mowmatter_job: job,
      mowmatter_attempt: "33333333-3333-4333-8333-333333333333",
    },
  });
  const handler = createBilling({
    env: {
      STRIPE_MODE: live ? "live" : "sandbox",
      SUPABASE_SECRET_KEY: "sb_secret_unit",
      STRIPE_CONNECT_WEBHOOK_SECRET: secret,
      STRIPE_WEBHOOK_SECRET: secret,
    },
    stripeClient: client,
    fetcher: async (url, opts) => {
      calls.push({ url, opts, body: opts.body ? JSON.parse(opts.body) : null });
      if (dbFailure) return new Response("failure", { status: 503 });
      return new Response(
        JSON.stringify(
          url.includes("mow_billing_accounts")
            ? [{ company_id: company }]
            : url.includes("mow_payment_reconcile")
              ? mapped
              : null,
        ),
      );
    },
  });
  const event = {
    id: "evt_early",
    type: "checkout.session.completed",
    account: "acct_operator",
    livemode: live,
    created: 123,
    data: { object: { id: "cs_early" } },
  };
  return { handler, event, calls };
}
test("early webhook is persisted before reconciliation and marked done only after application", async () => {
  const h = harness();
  assert.equal((await call(h.handler, h.event)).status, 200);
  assert(h.calls[0].url.includes("mow_webhook_inbox"));
  const applied = h.calls.find((x) => x.url.includes("mow_payment_reconcile"));
  assert.equal(applied.body.jid, job);
  assert.equal(applied.body.state, "paid");
  assert(h.calls.at(-1).body.processed_at);
});
test("unmatched payment is retained and returns retryable failure instead of acknowledging", async () => {
  const h = harness({ mapped: false });
  assert.equal((await call(h.handler, h.event)).status, 503);
  assert(!h.calls.some((x) => x.body?.processed_at));
});
test("inbox persistence failure never acknowledges a payment", async () => {
  const h = harness({ dbFailure: true });
  assert.equal((await call(h.handler, h.event)).status, 503);
  assert.equal(h.calls.length, 1);
});
test("explicit sandbox accepts test events and rejects live events before any write", async () => {
  const h = harness({ live: false });
  assert.equal((await call(h.handler, h.event)).status, 200);
  h.calls.length = 0;
  assert.equal(
    (await call(h.handler, { ...h.event, livemode: true })).status,
    400,
  );
  assert.equal(h.calls.length, 0);
});
test("forged event cannot enter the durable inbox", async () => {
  const h = harness();
  assert.equal(
    (await call(h.handler, h.event, undefined, "t=1,v1=bad")).status,
    400,
  );
  assert.equal(h.calls.length, 0);
});
