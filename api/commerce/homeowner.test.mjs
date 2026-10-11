import { test } from "node:test";
import assert from "node:assert/strict";
import { homeownerBilling, monthlyAmount } from "../billing/homeowner.mjs";
const cid = "11111111-1111-4111-8111-111111111111",
  customer = "22222222-2222-4222-8222-222222222222",
  pid = "33333333-3333-4333-8333-333333333333";
function harness({ state = {}, sub = {} } = {}) {
  const writes = [],
    calls = [];
  const row = {
    plan_id: pid,
    company_id: cid,
    customer_id: customer,
    monthly_cents: 9783,
    terms: "Fixed monthly plan.",
    snapshot: { business: "Test", interval_days: 14, services: ["Mow"] },
    status: "proposed",
    stripe_customer: "cus_unit",
    ...state,
  };
  const stripe = {
    subscriptions: {
      list: async () => ({ data: [] }),
      retrieve: async (id, p, o) => {
        calls.push({ type: "retrieve", o });
        return {
          id,
          metadata: { mowmatter_homeowner_plan: pid, mowmatter_company: cid },
          customer: "cus_unit",
          status: "active",
          items: {
            data: [
              {
                price: {
                  unit_amount: 9783,
                  currency: "usd",
                  recurring: { interval: "month" },
                },
                current_period_start: 100,
                current_period_end: 200,
              },
            ],
          },
          latest_invoice: { status: "paid" },
          ...sub,
        };
      },
    },
    checkout: {
      sessions: {
        create: async (p, o) => {
          calls.push({ type: "checkout", p, o });
          return { id: "cs_unit", url: "https://checkout.stripe.com/unit" };
        },
      },
    },
  };
  const h = homeownerBilling({
    stripe,
    db: async (path, method, body) => {
      if (method) {
        writes.push({ path, body });
        return true;
      }
      return path.startsWith("mow_homeowner_subscriptions") ? [row] : [];
    },
    ready: async () => ({ homeowner_payments_enabled: true }),
    connected: async () => ({
      account_id: "acct_operator",
      payments_ready: true,
      payouts_ready: true,
    }),
    feePlan: () => "growth",
    feeBps: { growth: 250 },
  });
  return {
    h,
    writes,
    calls,
    handle: (body) =>
      h.handle({
        pathname: "/api/billing/recurring-checkout",
        cid,
        user: { id: "user", email: "customer@example.invalid" },
        account: {},
        body: { customer_id: customer, plan_id: pid, ...body },
        customerRoute: true,
      }),
  };
}
test("monthly calculation uses saved per-visit price and cadence", () => {
  assert.equal(monthlyAmount({ price_cents: 4500, interval_days: 14 }), 9783);
  assert.throws(() => monthlyAmount({ price_cents: 4500, interval_days: 0 }));
  assert.throws(() => monthlyAmount({ price_cents: 0, interval_days: 14 }));
});
test("missing recurring authorization or altered amount blocks Stripe mutation", async () => {
  const x = harness();
  await assert.rejects(
    () => x.handle({ confirm_recurring: false }),
    /authorization/,
  );
  await assert.rejects(
    () =>
      x.handle({
        confirm_recurring: true,
        notice_version: "2026-10-11",
        expected_monthly_cents: 1,
      }),
    /authorization/,
  );
  assert.equal(x.calls.length, 0);
  assert.equal(x.writes.length, 0);
});
test("authorized recurring checkout uses stored price and merchant scope", async () => {
  const x = harness();
  await x.handle({
    confirm_recurring: true,
    notice_version: "2026-10-11",
    expected_monthly_cents: 9783,
  });
  const c = x.calls.find((c) => c.type === "checkout");
  assert.equal(c.p.mode, "subscription");
  assert.equal(c.p.line_items[0].price_data.unit_amount, 9783);
  assert.equal(c.p.line_items[0].price_data.recurring.interval, "month");
  assert.equal(c.o.stripeAccount, "acct_operator");
  assert.equal(c.p.subscription_data.application_fee_percent, 2.5);
  assert.match(
    c.p.custom_text.submit.message,
    /Additional work requires separate approval/,
  );
  assert.equal(c.p.payment_method_types, undefined);
  assert.equal(x.writes[0].body.actor_email, "customer@example.invalid");
});
test("subscription event checks stored customer and company before recording state", async () => {
  const x = harness();
  await x.h.sync(
    {
      id: "evt_unit",
      created: 100,
      type: "invoice.paid",
      account: "acct_operator",
      data: { object: { object: "invoice", subscription: "sub_unit" } },
    },
    cid,
  );
  assert.equal(x.writes[0].path, "rpc/mow_homeowner_sync");
  assert.equal(x.writes[0].body.invoice_state, "paid");
  assert.equal(x.calls[0].o.stripeAccount, "acct_operator");
  const bad = harness({ sub: { customer: "cus_other" } });
  await assert.rejects(
    () =>
      bad.h.sync(
        {
          id: "evt_unit",
          created: 100,
          account: "acct_operator",
          data: { object: { object: "subscription", id: "sub_unit" } },
        },
        cid,
      ),
    /mismatch/,
  );
  assert.equal(bad.writes.length, 0);
});
test("existing subscription cannot be replaced with another checkout", async () => {
  const x = harness({ state: { subscription_id: "sub_existing" } });
  await assert.rejects(
    () =>
      x.handle({
        confirm_recurring: true,
        notice_version: "2026-10-11",
        expected_monthly_cents: 9783,
      }),
    /existing subscription/,
  );
  assert.equal(x.calls.length, 0);
});
