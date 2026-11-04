import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import Stripe from "stripe";
import { createBilling, PLANS } from "./billing.mjs";
import { adPurchases, easternTime } from "./ad-purchases.mjs";
const cid = "11111111-1111-4111-8111-111111111111",
  other = "44444444-4444-4444-8444-444444444444",
  owner = "22222222-2222-4222-8222-222222222222",
  gclid = "Cj0KCQiA_test-click_ID123",
  now = Date.parse("2026-11-03T15:00:00Z");
const on = {
  GOOGLE_ADS_PURCHASE_ENABLED: "true",
  GOOGLE_ADS_PURCHASE_CONVERSION_NAME: "Paid subscription",
  GOOGLE_ADS_UPLOAD_USER: "google-ads",
  GOOGLE_ADS_UPLOAD_PASSWORD: "unit-only-password",
};
async function call(handle, path, opts = {}) {
  const server = http.createServer((req, res) => handle(req, res));
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  try {
    const r = await fetch(
      "http://127.0.0.1:" + server.address().port + path,
      opts,
    );
    return { status: r.status, headers: r.headers, text: await r.text() };
  } finally {
    await new Promise((r) => server.close(r));
  }
}
const recorder = (answers = {}) => {
  const calls = [];
  const db = async (path, method, body) => {
    calls.push({ path, method, body });
    for (const [k, v] of Object.entries(answers))
      if (path.startsWith(k)) return v;
    return true;
  };
  return { calls, db };
};

test("Purchase measurement is off by default and stores nothing", async () => {
  const { calls, db } = recorder();
  const ads = adPurchases({ db, env: {}, now: () => now });
  assert.equal(ads.enabled, false);
  assert.deepEqual(
    await ads.saveClick(cid, { gclid, consented_at: now - 1000 }),
    { saved: false },
  );
  assert.equal(
    await ads.recordPurchase(
      cid,
      { paid: true },
      { latest_invoice: { amount_paid: 4900, currency: "usd" } },
      1,
    ),
    false,
  );
  assert.deepEqual(await ads.feed({ headers: {} }), { status: 404 });
  assert.equal(calls.length, 0);
});

test("Only well-formed, recently consented Google click IDs are saved", async () => {
  const { calls, db } = recorder();
  const ads = adPurchases({ db, env: on, now: () => now });
  assert.deepEqual(
    await ads.saveClick(cid, { gclid, consented_at: now - 3 * 86400000 }),
    { saved: true },
  );
  assert.deepEqual(calls[0], {
    path: "rpc/mow_ad_click_save",
    method: "POST",
    body: {
      cid,
      click: gclid,
      consented: new Date(now - 3 * 86400000).toISOString(),
    },
  });
  for (const bad of [
    { gclid: "short", consented_at: now },
    { gclid: gclid + "<script>", consented_at: now },
    { gclid, consented_at: now - 9 * 86400000 },
    { gclid, consented_at: now + 3600000 },
    { gclid, consented_at: "yesterday" },
    { gbraid: gclid, consented_at: now },
  ])
    await assert.rejects(ads.saveClick(cid, bad), { status: 400 });
  assert.equal(calls.length, 1);
});

test("A paid subscription records its paid amount; unpaid ones record nothing", async () => {
  const { calls, db } = recorder();
  const ads = adPurchases({ db, env: on, now: () => now });
  const sub = {
    latest_invoice: {
      amount_paid: 4900,
      currency: "usd",
      status_transitions: { paid_at: 1793800000 },
      customer_email: "owner@example.invalid",
    },
  };
  assert.equal(await ads.recordPurchase(cid, { paid: false }, sub, 1), false);
  assert.equal(calls.length, 0);
  assert.equal(await ads.recordPurchase(cid, { paid: true }, sub, 1), true);
  assert.deepEqual(calls[0].body, {
    cid,
    cents: 4900,
    cur: "USD",
    at: new Date(1793800000 * 1000).toISOString(),
  });
  assert(!JSON.stringify(calls).includes("example.invalid"));
  // Without the expanded invoice the value is unknown, so nothing is recorded.
  assert.equal(
    await ads.recordPurchase(
      cid,
      { paid: true },
      { latest_invoice: "in_1" },
      1,
    ),
    false,
  );
});

test("Upload feed requires its password and sends only click ID, name, time, value and currency", async () => {
  const { db } = recorder({
    "mow_ad_clicks?": [
      {
        gclid,
        purchase_at: "2026-11-02T18:30:05Z",
        value_cents: 12900,
        currency: "USD",
      },
      {
        gclid: "bad,row\nInjected",
        purchase_at: "2026-11-02T18:30:05Z",
        value_cents: 1,
        currency: "USD",
      },
    ],
  });
  const ads = adPurchases({ db, env: on, now: () => now });
  const basic = (u, p) => ({
    headers: {
      authorization: "Basic " + Buffer.from(u + ":" + p).toString("base64"),
    },
  });
  assert.equal((await ads.feed({ headers: {} })).status, 401);
  assert.equal(
    (await ads.feed(basic("google-ads", "wrong-password"))).status,
    401,
  );
  const r = await ads.feed(basic("google-ads", "unit-only-password"));
  assert.equal(r.status, 200);
  assert.equal(
    r.body,
    "Parameters:TimeZone=America/New_York\r\n" +
      "Google Click ID,Conversion Name,Conversion Time,Conversion Value,Conversion Currency\r\n" +
      gclid +
      ",Paid subscription,2026-11-02 13:30:05,129.00,USD\r\n",
  );
  assert.equal(
    easternTime(Date.parse("2026-07-01T12:00:00Z")),
    "2026-07-01 08:00:00",
  );
});

test("Billing routes: paid webhook records the purchase, Office saves the click, feed is served", async () => {
  const stripe = new Stripe("sk_test_unit_only"),
    secret = "whsec_unit_only",
    event = {
      id: "evt_ads",
      created: 1793800000,
      livemode: true,
      type: "invoice.paid",
      data: {
        object: {
          object: "invoice",
          parent: { subscription_details: { subscription: "sub_ads" } },
        },
      },
    },
    payload = JSON.stringify(event),
    sig = stripe.webhooks.generateTestHeaderString({ payload, secret });
  stripe.subscriptions.retrieve = async (id) => ({
    id,
    customer: "cus_ads",
    status: "active",
    items: { data: [{ price: { id: PLANS.growth.price } }] },
    latest_invoice: { status: "paid", amount_paid: 4900, currency: "usd" },
  });
  for (const enabled of [false, true]) {
    const rpc = [];
    const h = createBilling({
      env: {
        STRIPE_WEBHOOK_SECRET: secret,
        supabase_api_secret_key: "fake",
        ...(enabled ? on : {}),
      },
      stripeClient: stripe,
      fetcher: async (url, opts) => {
        if (url.includes("/rpc/")) {
          rpc.push({ url, body: JSON.parse(opts.body) });
          return new Response("true");
        }
        if (url.endsWith("/auth/v1/user"))
          return new Response(JSON.stringify({ id: owner }));
        if (url.includes("mow_crew_members"))
          return new Response(
            JSON.stringify([{ company_id: cid, role: "owner" }]),
          );
        if (url.includes("mow_ad_clicks")) return new Response("[]");
        return new Response(JSON.stringify([{ company_id: cid }]));
      },
    });
    const r = await call(h, "/api/billing/webhook", {
      method: "POST",
      headers: { "stripe-signature": sig },
      body: payload,
    });
    assert.equal(r.status, 200);
    const purchase = rpc.find((x) => x.url.includes("mow_ad_purchase_record"));
    assert.equal(!!purchase, enabled);
    if (enabled) assert.equal(purchase.body.cents, 4900);
    const click = await call(h, "/api/billing/ad-click", {
      method: "POST",
      headers: {
        Origin: "https://office.mowmatter.com",
        Authorization: "Bearer unit",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        company_id: cid,
        gclid,
        consented_at: Date.now(),
      }),
    });
    assert.equal(click.status, 200);
    assert.equal(JSON.parse(click.text).saved, enabled);
    const feed = await call(h, "/api/billing/ads/purchases.csv", {
      headers: {
        Authorization:
          "Basic " +
          Buffer.from("google-ads:unit-only-password").toString("base64"),
      },
    });
    assert.equal(feed.status, enabled ? 200 : 404);
    if (enabled) assert.match(feed.headers.get("content-type"), /^text\/csv/);
  }
});

test("A failed ads write never fails the billing webhook", async () => {
  const stripe = new Stripe("sk_test_unit_only"),
    secret = "whsec_unit_only",
    event = {
      id: "evt_ads_fail",
      created: 1,
      livemode: true,
      type: "customer.subscription.updated",
      data: { object: { object: "subscription", id: "sub_fail" } },
    },
    payload = JSON.stringify(event);
  stripe.subscriptions.retrieve = async (id) => ({
    id,
    customer: "cus_ads",
    status: "active",
    items: { data: [{ price: { id: PLANS.scale.price } }] },
    latest_invoice: { status: "paid", amount_paid: 12900, currency: "usd" },
  });
  let applied = false;
  const h = createBilling({
    env: {
      STRIPE_WEBHOOK_SECRET: secret,
      supabase_api_secret_key: "fake",
      ...on,
    },
    stripeClient: stripe,
    fetcher: async (url) => {
      if (url.includes("mow_ad_purchase_record"))
        return new Response("", { status: 500 });
      if (url.includes("mow_billing_apply")) applied = true;
      return new Response(
        url.includes("/rpc/") ? "true" : JSON.stringify([{ company_id: cid }]),
      );
    },
  });
  const original = console.error;
  console.error = () => {};
  try {
    const r = await call(h, "/api/billing/webhook", {
      method: "POST",
      headers: {
        "stripe-signature": stripe.webhooks.generateTestHeaderString({
          payload,
          secret,
        }),
      },
      body: payload,
    });
    assert.equal(r.status, 200);
    assert.equal(applied, true);
  } finally {
    console.error = original;
  }
});

test("Database: one click per company, first paid subscription only, server-only access", async () => {
  const db = new PGlite();
  await db.exec(
    "create role anon;create role authenticated;create role service_role;create table public.mow_crew_companies(id uuid primary key);",
  );
  await db.exec(
    await readFile(
      new URL(
        "../../supabase/migrations/20261103120000_google_ads_purchase_conversions.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.query("insert into mow_crew_companies values($1),($2)", [
    cid,
    other,
  ]);
  const save = async (company, click, consented) =>
    (
      await db.query("select mow_ad_click_save($1,$2,$3) ok", [
        company,
        click,
        consented,
      ])
    ).rows[0].ok;
  const record = async (company, at, cents = 4900) =>
    (
      await db.query("select mow_ad_purchase_record($1,$2,'USD',$3) ok", [
        company,
        cents,
        at,
      ])
    ).rows[0].ok;
  const consented = new Date().toISOString();
  assert.equal(await save(cid, gclid, consented), true);
  assert.equal(await save(cid, "Cj0KCQiA_second_click", consented), false);
  await assert.rejects(save(other, "bad click!", consented));
  assert.equal(
    (
      await db.query("select gclid from mow_ad_clicks where company_id=$1", [
        cid,
      ])
    ).rows[0].gclid,
    gclid,
  );
  const later = new Date(Date.now() + 86400000).toISOString();
  assert.equal(await record(cid, later), true);
  assert.equal(await record(cid, later, 12900), false);
  assert.equal(
    (
      await db.query(
        "select value_cents from mow_ad_clicks where company_id=$1",
        [cid],
      )
    ).rows[0].value_cents,
    4900,
  );
  // Outside Google's 90-day click window nothing is recorded.
  assert.equal(await save(other, gclid, consented), true);
  assert.equal(
    await record(other, new Date(Date.now() + 91 * 86400000).toISOString()),
    false,
  );
  // Stale rows are purged on the next write.
  await db.query(
    "update mow_ad_clicks set saved_at=now()-interval '91 days' where company_id=$1",
    [other],
  );
  await record(cid, later);
  assert.equal(
    (await db.query("select count(*)::int n from mow_ad_clicks")).rows[0].n,
    1,
  );
  for (const role of ["anon", "authenticated"]) {
    await db.exec("set role " + role);
    await assert.rejects(db.query("select * from mow_ad_clicks"));
    await assert.rejects(
      db.query("select mow_ad_click_save($1,$2,now())", [other, gclid]),
    );
    await db.exec("reset role");
  }
});
