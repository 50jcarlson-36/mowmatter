import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
const root = new URL("../../", import.meta.url);
const cid = "11111111-1111-4111-8111-111111111111",
  actor = "22222222-2222-4222-8222-222222222222",
  jid = "33333333-3333-4333-8333-333333333333";
async function fixture() {
  const db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table mowmatter_directory_listings(owner_user_id uuid);create table mowmatter_featured_placements(listing_id uuid);create table mow_customer_quotes(id uuid primary key);create table mow_customer_channels(company_id uuid,customer_id uuid,phone text,sms_offer_consent boolean,notice_version text);create table mow_sms_suppressions(phone text primary key);`,
  );
  for (const file of [
    "crew/supabase/crew-schema.sql",
    "crew/supabase/office-schema.sql",
    "api/billing/schema.sql",
    "api/billing/connect-schema.sql",
    "api/billing/homeowner-schema.sql",
    "api/commerce/visit-proposals.sql",
    "api/commerce/visit-sms.sql",
    "supabase/migrations/20261010144631_yard_weather_operations.sql",
    "supabase/migrations/20261011134937_payment_recovery_p1.sql",
    "supabase/migrations/20261011135139_entitlements_and_crew_scope.sql",
  ])
    await db.exec(await readFile(new URL(file, root), "utf8"));
  await db.query("insert into auth.users(id) values($1)", [actor]);
  await db.query(
    "insert into mow_crew_companies(id,owner_id,name) values($1,$2,$3)",
    [cid, actor, "Test business"],
  );
  await db.query(
    "insert into mow_crew_members(company_id,user_id,role) values($1,$2,'owner')",
    [cid, actor],
  );
  await db.query(
    "insert into mow_billing_accounts(company_id,customer_id) values($1,'acct_test')",
    [cid],
  );
  await db.query(
    "insert into mow_crew_jobs(id,company_id,assigned_to,customer_name,address,city,service_date,status) values($1,$2,$3,'Test','123 Lawn St','Denver, CO',current_date,'completed')",
    [jid, cid, actor],
  );
  return db;
}
async function scalar(db, sql, params = []) {
  return Object.values((await db.query(sql, params)).rows[0])[0];
}
const claim = (db, nonce = randomUUID()) =>
  scalar(db, "select mow_payment_claim($1,$2,$3,5000,350,175)", [
    jid,
    cid,
    nonce,
  ]);
test("migrations execute and elapsed leases never replace unresolved attempts", async () => {
  const db = await fixture();
  try {
    const nonce = randomUUID();
    assert.equal(await claim(db, nonce), true);
    await db.query(
      "update mow_payment_checkouts set lease_until=now()-interval '1 day'",
    );
    assert.equal(await claim(db), false);
    assert.equal(
      await scalar(db, "select nonce from mow_payment_checkouts"),
      nonce,
    );
    assert.equal(
      await scalar(db, "select count(*) from mow_payment_attempts"),
      1,
    );
  } finally {
    await db.close();
  }
});
test("webhook recovers unsaved session atomically; duplicate and older failures cannot reverse paid state", async () => {
  const db = await fixture();
  try {
    const nonce = randomUUID();
    await claim(db, nonce);
    const apply = (eid, ec, state, amount = 5000, company = cid) =>
      scalar(
        db,
        "select mow_payment_reconcile($1,'checkout.session.completed',$2,$3,'cs_paid',$4,$5,$6,'usd','acct_test',$7)",
        [eid, ec, company, jid, nonce, amount, state],
      );
    assert.equal(await apply("evt_paid", 200, "paid"), true);
    assert.equal(
      await scalar(db, "select session_id from mow_payment_checkouts"),
      "cs_paid",
    );
    assert.equal(await apply("evt_paid", 200, "paid"), true);
    await apply("evt_failed", 100, "failed");
    assert.equal(
      await scalar(db, "select status from mow_payment_checkouts"),
      "paid",
    );
    assert.equal(await claim(db), false);
    await assert.rejects(() => apply("evt_bad", 300, "paid", 5001), /mismatch/);
    assert.equal(
      await scalar(
        db,
        "select count(*) from mow_billing_events where event_id='evt_bad'",
      ),
      0,
    );
    assert.equal(
      await scalar(
        db,
        "select mow_payment_event('evt_unmatched','checkout.session.completed',1,$1,'unknown','paid')",
        [cid],
      ),
      false,
    );
    assert.equal(
      await scalar(
        db,
        "select count(*) from mow_billing_events where event_id='evt_unmatched'",
      ),
      0,
    );
  } finally {
    await db.close();
  }
});
test("request payload is immutable; expired sessions preserve history and permit a new nonce", async () => {
  const db = await fixture();
  try {
    const nonce = randomUUID();
    await claim(db, nonce);
    const prepare = (request) =>
      scalar(db, "select mow_payment_prepare($1,$2,$3,$4,$5)", [
        jid,
        cid,
        nonce,
        "acct_test",
        request,
      ]);
    assert.deepEqual((await prepare({ first: true })).request, { first: true });
    assert.deepEqual((await prepare({ first: false })).request, {
      first: true,
    });
    assert.equal(
      await scalar(db, "select mow_payment_bind($1,$2,$3,'cs_old')", [
        jid,
        cid,
        nonce,
      ]),
      true,
    );
    await scalar(db, "select mow_payment_expire($1,$2,'cs_old')", [jid, cid]);
    assert.equal(await claim(db), true);
    assert.equal(
      await scalar(db, "select count(*) from mow_payment_attempts"),
      2,
    );
    assert.equal(
      await scalar(
        db,
        "select status from mow_payment_attempts where nonce=$1",
        [nonce],
      ),
      "expired",
    );
  } finally {
    await db.close();
  }
});
test("customer caps permit editing at cap and do not trust unpaid tier labels", async () => {
  const db = await fixture();
  try {
    for (let i = 0; i < 10; i++)
      await db.query(
        "insert into mow_customers(company_id,name,address) values($1,'Test','123 Street')",
        [cid],
      );
    await assert.rejects(
      () =>
        db.query(
          "insert into mow_customers(company_id,name,address) values($1,'Over','123 Street')",
          [cid],
        ),
      /limit reached/,
    );
    await db.query("update mow_customers set name='Edited'");
    await db.query(
      "update mow_billing_accounts set plan='scale',status='past_due',paid=false",
    );
    await assert.rejects(
      () =>
        db.query(
          "insert into mow_customers(company_id,name,address) values($1,'Over','123 Street')",
          [cid],
        ),
      /limit reached/,
    );
    await db.query(
      "update mow_billing_accounts set plan='growth',status='active',paid=true",
    );
    await db.query(
      "insert into mow_customers(company_id,name,address) values($1,'Allowed','123 Street')",
      [cid],
    );
  } finally {
    await db.close();
  }
});
test("monthly credits are atomic, idempotent, refundable once, and reset by period", async () => {
  const db = await fixture();
  try {
    const reserve = (rid) =>
      scalar(db, "select mow_credit_reserve($1,$2,$3,'setup')", [
        actor,
        cid,
        rid,
      ]);
    const first = randomUUID();
    assert.equal(await reserve(first), true);
    assert.equal(await reserve(first), false);
    for (let i = 1; i < 70; i++)
      assert.equal(await reserve(randomUUID()), true);
    assert.equal(await reserve(randomUUID()), false);
    for (let i = 0; i < 2; i++)
      await scalar(db, "select mow_credit_finish($1,$2,false)", [cid, first]);
    assert.equal(await reserve(randomUUID()), true);
    assert.equal(await reserve(randomUUID()), false);
    await db.query(
      "update mow_usage_credits set period=(current_date-interval '1 month')::date",
    );
    assert.equal(await reserve(randomUUID()), true);
  } finally {
    await db.close();
  }
});
test("crew expansion is paid, cross-crew access is denied, today survives 500 old jobs, and paging has no gaps", async () => {
  const db = await fixture();
  try {
    await assert.rejects(
      () =>
        db.query("insert into mow_crews(company_id,name) values($1,'South')", [
          cid,
        ]),
      /add-on/,
    );
    await db.query(
      "update mow_billing_accounts set plan='growth',paid=true,status='active',crew_addons=1",
    );
    const south = await scalar(
      db,
      "insert into mow_crews(company_id,name) values($1,'South') returning id",
      [cid],
    );
    const north = await scalar(
      db,
      "select crew_id from mow_crew_members where user_id=$1",
      [actor],
    );
    const lead = randomUUID(),
      worker = randomUUID();
    await db.query(
      "insert into mow_crew_members(company_id,user_id,role,crew_id) values($1,$2,'lead',$3),($1,$4,'member',$5)",
      [cid, lead, north, worker, south],
    );
    const southJob = randomUUID();
    await db.query(
      "insert into mow_crew_jobs(id,company_id,assigned_to,customer_name,address,service_date) values($1,$2,$3,'Private','123 Street',current_date)",
      [southJob, cid, worker],
    );
    assert.equal(
      await scalar(db, "select mow_job_access($1,$2)", [lead, southJob]),
      false,
    );
    await assert.rejects(
      () =>
        scalar(db, "select mow_crew_transition($1,$2,$3,'start','{}')", [
          lead,
          southJob,
          randomUUID(),
        ]),
      /access denied/,
    );
    await db.query(
      "insert into mow_crew_jobs(company_id,assigned_to,customer_name,address,service_date) select $1,$2,'Old','123 Street',current_date-100 from generate_series(1,501)",
      [cid, actor],
    );
    const today = await db.query(
      "select * from mow_crew_list_jobs($1,$2,current_date,current_date)",
      [actor, cid],
    );
    assert(today.rows.some((j) => j.id === jid));
    assert.equal(today.rows.length, 2);
    await db.query(
      "insert into mow_crew_jobs(company_id,assigned_to,customer_name,address,service_date) select $1,$2,'Today','123 Street',current_date from generate_series(1,250)",
      [cid, actor],
    );
    let cursor = null;
    const seen = [];
    do {
      const rows = (
        await db.query(
          "select * from mow_crew_list_jobs($1,$2,current_date,current_date,$3,$4,$5,200)",
          [
            actor,
            cid,
            cursor?.service_date || null,
            cursor?.scheduled_time || null,
            cursor?.id || null,
          ],
        )
      ).rows;
      seen.push(...rows.map((j) => j.id));
      cursor = rows.length === 200 ? rows.at(-1) : null;
    } while (cursor);
    assert.equal(seen.length, 252);
    assert.equal(new Set(seen).size, 252);
  } finally {
    await db.close();
  }
});
test("new tables and payment/credit/crew functions are inaccessible to browser roles", async () => {
  const db = await fixture();
  try {
    for (const role of ["anon", "authenticated"]) {
      for (const table of [
        "mow_payment_attempts",
        "mow_webhook_inbox",
        "mow_usage_credits",
        "mow_crews",
      ]) {
        assert.equal(
          await scalar(db, "select has_table_privilege($1,$2,$3)", [
            role,
            table,
            "SELECT",
          ]),
          false,
        );
        assert.equal(
          await scalar(
            db,
            "select relrowsecurity from pg_class where relname=$1",
            [table],
          ),
          true,
        );
      }
      const fns = (
        await db.query(
          "select oid::regprocedure::text name from pg_proc where proname in ('mow_payment_reconcile','mow_payment_prepare','mow_payment_bind','mow_credit_reserve','mow_crew_manage','mow_crew_list_jobs')",
        )
      ).rows;
      for (const f of fns)
        assert.equal(
          await scalar(db, "select has_function_privilege($1,$2,$3)", [
            role,
            f.name,
            "EXECUTE",
          ]),
          false,
        );
    }
  } finally {
    await db.close();
  }
});

// Exercise the application recovery path against the migrated PostgreSQL functions.
import { paymentRecovery } from "./recovery.mjs";
import { subscriptionRecovery } from "./subscription-recovery.mjs";
function recoveryDB(db, { loseBind = false } = {}) {
  return async (path, method, body) => {
    if (path.startsWith("rpc/")) {
      const name = path.slice(4),
        keys = Object.keys(body);
      if (loseBind && name === "mow_payment_bind") {
        loseBind = false;
        throw Error("Database response lost");
      }
      return scalar(
        db,
        `select ${name}(${keys.map((k, i) => `${k} => $${i + 1}`).join(",")})`,
        Object.values(body),
      );
    }
    if (path.startsWith("mow_payment_checkouts"))
      return (
        await db.query(
          "select * from mow_payment_checkouts where job_id=$1 and company_id=$2",
          [jid, cid],
        )
      ).rows;
    throw Error("Unexpected recovery query");
  };
}
test("lost checkout save and concurrent retries recover one provider object with identical parameters", async () => {
  const db = await fixture();
  try {
    const objects = new Map(),
      requests = [];
    const stripe = {
      checkout: {
        sessions: {
          create: async (request, opts) => {
            requests.push({ request, opts });
            if (!objects.has(opts.idempotencyKey))
              objects.set(opts.idempotencyKey, {
                id: "cs_recovered",
                url: "https://checkout.stripe.com/recovered",
              });
            return objects.get(opts.idempotencyKey);
          },
          retrieve: async () => ({
            id: "cs_recovered",
            status: "open",
            url: "https://checkout.stripe.com/recovered",
          }),
        },
      },
    };
    const recovery = paymentRecovery({
      db: recoveryDB(db, { loseBind: true }),
      stripe,
    });
    const args = {
      job: { id: jid, price_cents: 5000 },
      cid,
      account: "acct_test",
      plan: "starter",
      bps: 350,
      fee: 175,
      success_url: "https://example.test/success",
      cancel_url: "https://example.test/cancel",
    };
    await assert.rejects(() => recovery.checkout(args), /response lost/);
    const results = await Promise.all([
      recovery.checkout({
        ...args,
        success_url: "https://example.test/changed",
      }),
      recovery.checkout(args),
    ]);
    assert(
      results.every((r) => r.url === "https://checkout.stripe.com/recovered"),
    );
    assert.equal(objects.size, 1);
    assert(requests.length >= 2);
    for (const request of requests) assert.deepEqual(request, requests[0]);
  } finally {
    await db.close();
  }
});
test("unknown payment beyond Stripe key retention and legacy unknown result never create another session", async () => {
  const db = await fixture();
  try {
    const nonce = randomUUID();
    await claim(db, nonce);
    await db.query(
      "update mow_payment_attempts set created_at=now()-interval '25 hours'",
    );
    let creates = 0;
    const recovery = paymentRecovery({
      db: recoveryDB(db),
      stripe: {
        checkout: {
          sessions: {
            create: async () => {
              creates++;
            },
          },
        },
      },
    });
    await assert.rejects(
      () =>
        recovery.checkout({
          job: { id: jid, price_cents: 5000 },
          cid,
          account: "acct_test",
          plan: "starter",
          bps: 350,
          fee: 175,
        }),
      /recovery|reconciliation/,
    );
    assert.equal(creates, 0);
    assert.equal(
      await scalar(db, "select nonce from mow_payment_checkouts"),
      nonce,
    );
  } finally {
    await db.close();
  }
});
test("office subscription lock survives timeout and retry preserves its first price and key", async () => {
  const db = await fixture();
  try {
    const nonce = randomUUID();
    assert.equal(
      await scalar(db, "select mow_billing_checkout_claim($1,$2)", [
        cid,
        nonce,
      ]),
      true,
    );
    await db.query(
      "update mow_billing_accounts set checkout_until=now()-interval '1 day'",
    );
    assert.equal(
      await scalar(db, "select mow_billing_checkout_claim($1,$2)", [
        cid,
        randomUUID(),
      ]),
      false,
    );
    let first = true;
    const requests = [];
    const saved = subscriptionRecovery({
      db: recoveryDB(db),
      stripe: {
        checkout: {
          sessions: {
            create: async (request, opts) => {
              requests.push({ request, opts });
              if (first) {
                first = false;
                throw Error("Stripe response lost");
              }
              return {
                id: "cs_subscription",
                url: "https://checkout.stripe.com/sub",
              };
            },
          },
        },
      },
    });
    await assert.rejects(
      () =>
        saved({
          cid,
          nonce,
          kind: "office",
          subject: cid,
          request: {
            mode: "subscription",
            line_items: [{ price: "price_first", quantity: 1 }],
          },
        }),
      /response lost/,
    );
    assert.equal(
      (
        await saved({
          cid,
          nonce,
          kind: "office",
          subject: cid,
          request: {
            mode: "subscription",
            line_items: [{ price: "price_changed", quantity: 1 }],
          },
        })
      ).url,
      "https://checkout.stripe.com/sub",
    );
    assert.deepEqual(requests[0], requests[1]);
    assert.equal(
      await scalar(db, "select checkout_nonce from mow_billing_accounts"),
      nonce,
    );
    assert.equal(
      await scalar(db, "select checkout_session from mow_billing_accounts"),
      "cs_subscription",
    );
  } finally {
    await db.close();
  }
});

test("legacy unknown attempts are never replayed, and retired subscription sessions retain history", async () => {
  const db = await fixture();
  try {
    const nonce = randomUUID();
    await claim(db, nonce);
    await db.query("update mow_payment_attempts set replayable=false");
    const prepared = await scalar(
      db,
      "select mow_payment_prepare($1,$2,$3,$4,$5)",
      [jid, cid, nonce, "acct_test", { mode: "payment" }],
    );
    assert.equal(prepared.request, null);
    const subNonce = randomUUID();
    await scalar(db, "select mow_billing_checkout_claim($1,$2)", [
      cid,
      subNonce,
    ]);
    await scalar(db, "select mow_subscription_bind($1,$2,'cs_expired')", [
      cid,
      subNonce,
    ]);
    assert.equal(
      await scalar(db, "select mow_subscription_expire($1,$2,'cs_other')", [
        cid,
        subNonce,
      ]),
      false,
    );
    assert.equal(
      await scalar(db, "select mow_subscription_expire($1,$2,'cs_expired')", [
        cid,
        subNonce,
      ]),
      true,
    );
    assert.equal(
      await scalar(db, "select mow_billing_checkout_claim($1,$2)", [
        cid,
        randomUUID(),
      ]),
      true,
    );
    assert.equal(
      await scalar(
        db,
        "select status from mow_subscription_attempts where nonce=$1",
        [subNonce],
      ),
      "expired",
    );
  } finally {
    await db.close();
  }
});

test("scoped transition retains cancellation and completion-proof guards", async () => {
  const db = await fixture();
  try {
    await db.query(
      "update mow_crew_jobs set status='scheduled',cancelled_at=now() where id=$1",
      [jid],
    );
    await assert.rejects(
      () =>
        scalar(db, "select mow_crew_transition($1,$2,$3,'start','{}')", [
          actor,
          jid,
          randomUUID(),
        ]),
      /cancelled/,
    );
    await db.query(
      "update mow_crew_jobs set status='in_progress',cancelled_at=null where id=$1",
      [jid],
    );
    await assert.rejects(
      () =>
        scalar(db, "select mow_crew_transition($1,$2,$3,'complete',$4)", [
          actor,
          jid,
          randomUUID(),
          { completed_tasks: ["Mow", "Edge", "Blow"] },
        ]),
      /photo/,
    );
    assert.equal(await scalar(db, "select count(*) from mow_crew_events"), 0);
  } finally {
    await db.close();
  }
});
