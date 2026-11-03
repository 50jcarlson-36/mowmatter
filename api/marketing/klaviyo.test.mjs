import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Readable } from "node:stream";
import { PGlite } from "@electric-sql/pglite";
import { createKlaviyo } from "./klaviyo.mjs";

const env = {
  KLAVIYO_PRIVATE_API_KEY: "pk_unit",
  KLAVIYO_LIST_ID: "LIST1",
  KLAVIYO_WEBHOOK_SECRET: "unit-secret",
  MOW_KLAVIYO_ENABLED: "true",
};
const lead = (over) => ({
  claimed: true,
  id: "lead-1",
  version: 3,
  email: "owner@example.com",
  first_name: "Sam",
  company: "Green Co",
  email_marketing: true,
  sms_marketing: true,
  phone: "+13865555678",
  previously_synced: false,
  ...over,
});
function harness(claim, { failKlaviyo = false, env: e = env } = {}) {
  const db = [],
    api = [];
  const k = createKlaviyo({
    env: e,
    backend: {
      db: async (path, method, body) => {
        db.push([path, body]);
        return path === "rpc/mowmatter_klaviyo_claim" ? claim : true;
      },
    },
    fetcher: async (url, init) => {
      api.push([
        url.replace("https://a.klaviyo.com/api/", ""),
        JSON.parse(init.body),
        init.headers,
      ]);
      return { ok: !failKlaviyo, status: failKlaviyo ? 400 : 202 };
    },
  });
  return { k, db, api };
}

test("sync is off until every Klaviyo setting and the enable flag are present", async () => {
  const h = harness(lead(), { env: { ...env, MOW_KLAVIYO_ENABLED: "" } });
  assert.deepEqual(await h.k.syncNext(), { status: "disabled" });
  assert.deepEqual(h.k.status().missing, ["MOW_KLAVIYO_ENABLED"]);
  assert.equal(h.db.length + h.api.length, 0);
});

test("a consenting owner is subscribed to email and SMS marketing on the list", async () => {
  const h = harness(lead());
  assert.equal((await h.k.syncNext()).status, "accepted");
  assert.deepEqual(
    h.api.map((c) => c[0]),
    ["profile-import", "profile-subscription-bulk-create-jobs"],
  );
  assert.equal(h.api[0][2].Authorization, "Klaviyo-API-Key pk_unit");
  assert.equal(h.api[0][1].data.attributes.phone_number, undefined); // phone only travels with SMS consent
  const p = h.api[1][1].data.attributes.profiles.data[0].attributes;
  assert.deepEqual(p, {
    email: "owner@example.com",
    phone_number: "+13865555678",
    subscriptions: {
      email: { marketing: { consent: "SUBSCRIBED" } },
      sms: { marketing: { consent: "SUBSCRIBED" } },
    },
  });
  assert.equal(h.api[1][1].data.relationships.list.data.id, "LIST1");
  assert.deepEqual(h.db.at(-1), [
    "rpc/mowmatter_klaviyo_done",
    { p_id: "lead-1", p_version: 3, p_ok: true },
  ]);
});

test("withdrawn consent unsubscribes a synced owner; a never-synced non-consenting owner is not created", async () => {
  const withdrawn = harness(
    lead({
      email_marketing: false,
      sms_marketing: false,
      previously_synced: true,
    }),
  );
  await withdrawn.k.syncNext();
  assert.deepEqual(
    withdrawn.api.map((c) => c[0]),
    ["profile-subscription-bulk-delete-jobs"],
  );
  assert.deepEqual(
    withdrawn.api[0][1].data.attributes.profiles.data[0].attributes
      .subscriptions,
    {
      email: { marketing: { consent: "UNSUBSCRIBED" } },
      sms: { marketing: { consent: "UNSUBSCRIBED" } },
    },
  );
  const smsOnly = harness(
    lead({
      email_marketing: true,
      sms_marketing: false,
      previously_synced: true,
    }),
  );
  await smsOnly.k.syncNext();
  assert.deepEqual(
    smsOnly.api.map((c) => c[0]),
    [
      "profile-import",
      "profile-subscription-bulk-create-jobs",
      "profile-subscription-bulk-delete-jobs",
    ],
  );
  assert.deepEqual(
    Object.keys(
      smsOnly.api[2][1].data.attributes.profiles.data[0].attributes
        .subscriptions,
    ),
    ["sms"],
  );
  const never = harness(lead({ email_marketing: false, sms_marketing: false }));
  await never.k.syncNext();
  assert.equal(never.api.length, 0);
  assert.equal(never.db.at(-1)[1].p_ok, true);
});

test("a Klaviyo error marks the row failed and idle stops the worker", async () => {
  const h = harness(lead(), { failKlaviyo: true });
  assert.equal((await h.k.syncNext()).status, "failed");
  assert.equal(h.db.at(-1)[1].p_ok, false);
  assert.equal(
    (await harness({ claimed: false, status: "idle" }).k.syncNext()).status,
    "idle",
  );
});

async function hook(
  k,
  { auth = "Bearer unit-secret", body, type = "application/json" },
) {
  const req = Readable.from([
    Buffer.from(typeof body === "string" ? body : JSON.stringify(body)),
  ]);
  Object.assign(req, {
    url: "/api/marketing/klaviyo/unsubscribe",
    method: "POST",
    headers: { authorization: auth, "content-type": type },
  });
  let code;
  const res = { writeHead: (c) => (code = c), end() {} };
  assert.equal(await k.webhook(req, res), true);
  return code;
}

test("unsubscribe webhook requires the shared secret and a valid email or phone", async () => {
  const h = harness(null);
  assert.equal(
    await hook(h.k, {
      auth: "Bearer wrong-secret",
      body: { channel: "email", email: "a@b.co" },
    }),
    403,
  );
  assert.equal(
    await hook(h.k, { body: { channel: "sms", phone: "386" } }),
    400,
  );
  assert.equal(await hook(h.k, { body: "not json" }), 400);
  assert.equal(h.db.length, 0);
  assert.equal(
    await hook(h.k, {
      body: { channel: "email", email: " Owner@Example.com " },
    }),
    200,
  );
  assert.equal(
    await hook(h.k, { body: { channel: "sms", phone: "+13865555678" } }),
    200,
  );
  assert.deepEqual(
    h.db.map((d) => d[1]),
    [
      { p_channel: "email", p_email: "owner@example.com", p_phone: null },
      { p_channel: "sms", p_email: null, p_phone: "+13865555678" },
    ],
  );
  assert.equal(await h.k.webhook({ url: "/other" }, {}), false);
});

test("migration: settings opt-in, sync queue, version guard, STOP and Klaviyo unsubscribes", async () => {
  const db = new PGlite();
  const owner = "44444444-4444-4444-8444-444444444444";
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema mowmatter_private;
      create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
      create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
      create table public.mowmatter_leads(id uuid primary key default gen_random_uuid(),email text not null unique,first_name text not null default '',company text not null default '',
        marketing_consent boolean not null default false,consent_version text not null default '2026-10-04',source jsonb not null default '{}',launch_updates boolean not null default true);
      create table public.mowmatter_marketing_suppressions(email text primary key);
      create table public.mow_sms_suppressions(phone text primary key);
      create function public.mow_sms_stop(p_phone text) returns boolean language sql as $$ insert into public.mow_sms_suppressions values(p_phone) on conflict do nothing returning true $$;
      insert into public.mowmatter_leads(email,marketing_consent) values('lead@example.com',true),('quiet@example.com',false);
      insert into public.mowmatter_leads(email,consent_version,launch_updates) values('login@example.com','2026-10-08-login',true);
      insert into auth.users values('${owner}','owner@example.com',now());`);
    await db.exec(
      await readFile(
        new URL(
          "../../supabase/migrations/20261103120000_operator_marketing_klaviyo.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const one = async (sql, params) => (await db.query(sql, params)).rows[0];
    const pending = async () =>
      (
        await db.query(
          "select email from public.mowmatter_leads where klaviyo_status='pending' order by email",
        )
      ).rows.map((r) => r.email);
    // Only existing consenting leads are queued; the early-access default without opt-in is not.
    assert.deepEqual(await pending(), [
      "lead@example.com",
      "login@example.com",
    ]);
    await db.exec("update public.mowmatter_leads set klaviyo_status='synced'");

    await db.exec(`set test.uid='${owner}'`);
    await assert.rejects(
      db.query("select public.mm_marketing_preferences(true,true,'386')"),
      /US mobile number/,
    );
    const saved = (
      await one(
        "select public.mm_marketing_preferences(true,true,'+13865555678') as r",
      )
    ).r;
    assert.deepEqual(saved, {
      ok: true,
      email: true,
      sms: true,
      phone: "+13865555678",
    });
    const row = await one(
      "select * from public.mowmatter_leads where email='owner@example.com'",
    );
    assert.equal(row.sms_marketing_notice, "2026-11-03-operator-sms");
    assert.equal(row.klaviyo_status, "pending");

    const claim = (await one("select public.mowmatter_klaviyo_claim() as r")).r;
    assert.equal(claim.email, "owner@example.com");
    assert.equal(claim.sms_marketing, true);
    // A change mid-sync keeps the row pending for another pass.
    await db.query("select public.mm_marketing_preferences(null,false,null)");
    await db.query("select public.mowmatter_klaviyo_done($1,$2,true)", [
      claim.id,
      claim.version,
    ]);
    assert.equal(
      (
        await one(
          "select klaviyo_status s from public.mowmatter_leads where email='owner@example.com'",
        )
      ).s,
      "pending",
    );
    const again = (await one("select public.mowmatter_klaviyo_claim() as r")).r;
    assert.equal(again.sms_marketing, false);
    await db.query("select public.mowmatter_klaviyo_done($1,$2,true)", [
      again.id,
      again.version,
    ]);
    assert.equal(
      (await one("select public.mowmatter_klaviyo_claim() as r")).r.status,
      "idle",
    );

    // STOP on any Mow Matter number ends marketing texts and blocks re-enrolling that number in settings.
    await db.query(
      "select public.mm_marketing_preferences(null,true,'+13865555678')",
    );
    await db.query("select public.mow_sms_stop('+13865555678')");
    assert.equal(
      (
        await one(
          "select sms_marketing_consent c from public.mowmatter_leads where email='owner@example.com'",
        )
      ).c,
      false,
    );
    await assert.rejects(
      db.query(
        "select public.mm_marketing_preferences(null,true,'+13865555678')",
      ),
      /replied STOP/,
    );

    // A Klaviyo email unsubscribe joins the shared suppression list and queues the change.
    await db.query(
      "select public.mowmatter_marketing_unsubscribe('email','Lead@example.com',null)",
    );
    assert.equal(
      (
        await one(
          "select public.mowmatter_lead_email_marketing(l) m from public.mowmatter_leads l where email='lead@example.com'",
        )
      ).m,
      false,
    );
    assert.ok((await pending()).includes("lead@example.com"));
    await assert.rejects(
      db.query(
        "select public.mowmatter_marketing_unsubscribe('push','x@y.co',null)",
      ),
      /Unknown unsubscribe/,
    );
    // An explicit, signed-in opt-out suppresses; an explicit opt-in later restores email marketing.
    assert.equal(
      (
        await one(
          "select public.mm_marketing_preferences(false,null,null) as r",
        )
      ).r.email,
      false,
    );
    assert.equal(
      (await one("select public.mm_marketing_preferences(true,null,null) as r"))
        .r.email,
      true,
    );
    await db.exec("reset test.uid");
    await assert.rejects(
      db.query("select public.mm_marketing_preferences(true,null,null)"),
      /Sign in/,
    );
  } finally {
    await db.close();
  }
});
