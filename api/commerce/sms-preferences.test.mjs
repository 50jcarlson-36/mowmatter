import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { createSMSPreferences } from "./sms-preferences.mjs";
const actor = "11111111-1111-4111-8111-111111111111",
  cid = "22222222-2222-4222-8222-222222222222",
  customer = "33333333-3333-4333-8333-333333333333";
const prefs = {
  actor,
  actor_email: "customer@example.com",
  cid,
  customer,
  p_phone: "+13865551234",
  consent: false,
  service_consent: true,
  route_consent: false,
};
test("preference RPC enforces ownership, disabled/no-consent gates, duplicate and STOP protection", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);create table mow_customers(company_id uuid,id uuid,email text,primary key(company_id,id));create table mow_crew_companies(id uuid primary key);create table mow_customer_quotes(id uuid primary key);create table mow_crew_jobs(id uuid primary key);create table mow_crew_events(id uuid primary key);`,
    );
    for (const [file, end] of [
      ["sms-schema.sql", "create function public.mow_quote_sms_claim"],
      ["visit-sms.sql", "create function public.mow_visit_sms_claim"],
      [
        "route-notices.sql",
        "create table if not exists public.mow_dispatch_routes",
      ],
    ]) {
      const sql = await readFile(new URL(file, import.meta.url), "utf8");
      await db.exec(sql.slice(0, sql.indexOf(end)));
    }
    await db.exec(
      await readFile(
        new URL(
          "../../supabase/migrations/20261016192355_sms_opt_in_confirmation.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.query("insert into auth.users values($1)", [actor]);
    await db.query(
      "insert into mow_customers values($1,$2,'customer@example.com')",
      [cid, customer],
    );
    const save = async (overrides = {}) => {
      const p = {
        ...prefs,
        route_enabled: false,
        send_confirmation: true,
        ...overrides,
      };
      return (
        await db.query(
          "select mow_sms_preferences_confirm($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) as result",
          Object.values(p),
        )
      ).rows[0].result;
    };
    await assert.rejects(
      save({ actor_email: "intruder@example.com" }),
      /access denied/,
    );
    assert.equal(
      (await save({ send_confirmation: false })).status,
      "pending_activation",
    );
    assert.equal(
      (await db.query("select count(*)::int as n from mow_sms_confirmations"))
        .rows[0].n,
      0,
    );
    assert.equal((await save({ service_consent: false })).status, "no_consent");
    const claims = await Promise.all([save(), save()]);
    assert.equal(claims.filter((c) => c.claimed).length, 1);
    assert.equal(claims.find((c) => !c.claimed).status, "needs_review");
    await db.exec("update mow_sms_confirmations set status='accepted'");
    assert.equal((await save()).status, "already_confirmed");
    await db.query("select mow_sms_stop($1)", [prefs.p_phone]);
    await assert.rejects(save(), /opted out/);
    assert.equal(
      (await db.query("select sms_service_consent from mow_customer_channels"))
        .rows[0].sms_service_consent,
      false,
    );
    assert.equal(
      (
        await db.query(
          "select has_function_privilege('authenticated','mow_sms_preferences_confirm(uuid,text,uuid,uuid,text,boolean,boolean,boolean,boolean,boolean)','execute') as allowed",
        )
      ).rows[0].allowed,
      false,
    );
  } finally {
    await db.close();
  }
});
test("welcome uses claimed phone and required copy; uncertain sends never retry", async () => {
  let enabled = false,
    claimed = false,
    sends = 0;
  const save = createSMSPreferences({
    backend: {
      db: async (path, method, body) => {
        if (!path.startsWith("rpc/")) return;
        assert.equal(body.route_enabled, false);
        if (!body.send_confirmation)
          return { claimed: false, status: "pending_activation" };
        if (claimed) return { claimed: false, status: "needs_review" };
        claimed = true;
        return { claimed: true, id: "claim-id", phone: "+12015551234" };
      },
    },
    transport: {
      configured: () => enabled,
      send: async (message) => {
        sends++;
        assert.equal(message.to, "+12015551234");
        for (const term of [
          "MowMatter",
          "HELP",
          "STOP",
          "2 per visit",
          "3 per day",
          "Message and data rates may apply",
        ])
          assert.ok(message.body.includes(term));
        assert.equal(message.idempotencyKey, "opt-in:claim-id");
        throw Error("unknown delivery");
      },
    },
  });
  assert.equal((await save(prefs)).confirmation, "pending_activation");
  assert.equal(sends, 0);
  enabled = true;
  assert.equal((await save(prefs)).confirmation, "needs_review");
  assert.equal((await save(prefs)).confirmation, "needs_review");
  assert.equal(sends, 1);
});

test("Klaviyo consent sync follows authorization, has no disabled backlog, and mirrors provider STOP", async () => {
  const writes = [];
  let synced = 0;
  let status = "provider_pending";
  const save = createSMSPreferences({
    backend: {
      db: async (...args) => {
        writes.push(args);
        return { claimed: false, status: "pending_activation" };
      },
    },
    transport: {
      configured: () => true,
      syncPreferences: async (p) => {
        synced++;
        assert.equal(p.marketing, false);
        assert.equal(p.service, true);
        return { status };
      },
    },
  });
  assert.equal((await save(prefs)).confirmation, "provider_pending");
  assert.equal(writes[0][2].send_confirmation, false);
  assert.equal(synced, 1);
  status = "provider_opt_out";
  assert.equal((await save(prefs)).confirmation, "provider_opt_out");
  assert.equal(writes.at(-1)[0], "rpc/mow_sms_stop");
  const denied = createSMSPreferences({
    backend: {
      db: async () => {
        throw Error("access denied");
      },
    },
    transport: {
      syncPreferences: async () => {
        synced++;
      },
    },
  });
  await assert.rejects(denied(prefs), /access denied/);
  assert.equal(synced, 2);
});
