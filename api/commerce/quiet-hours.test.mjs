import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import {
  nextSendTime,
  quietHoursConfig,
  recipientTimeZone,
} from "./quiet-hours.mjs";
import { createSMS } from "./sms.mjs";
const hours = quietHoursConfig({});
const at = (iso, tz = "America/New_York") =>
  nextSendTime(new Date(iso), tz, hours)?.toISOString() ?? null;

test("inside the window sends now", () => {
  assert.deepEqual(hours, {
    start: 480,
    end: 1200,
    fallbackTimeZone: "America/New_York",
  });
  assert.equal(at("2026-06-15T12:00:00Z"), null); // 8:00am EDT, window opens
  assert.equal(at("2026-06-15T16:00:00Z"), null); // noon EDT
  assert.equal(at("2026-06-15T23:59:00Z"), null); // 7:59pm EDT
});

test("outside the window defers to the next opening in recipient time", () => {
  assert.equal(at("2026-06-16T00:00:00Z"), "2026-06-16T12:00:00.000Z"); // 8:00pm EDT -> next 8am
  assert.equal(at("2026-06-15T10:30:00Z"), "2026-06-15T12:00:00.000Z"); // 6:30am EDT -> same day 8am
  // Noon in New York is 6am in Los Angeles: the recipient's zone decides.
  assert.equal(
    at("2026-06-15T13:00:00Z", "America/Los_Angeles"),
    "2026-06-15T15:00:00.000Z",
  );
  // Month and year rollover.
  assert.equal(at("2026-12-31T03:00:00Z"), "2026-12-31T13:00:00.000Z");
  assert.equal(at("2027-01-01T02:00:00Z"), "2027-01-01T13:00:00.000Z");
  const custom = quietHoursConfig({ MOW_SMS_SEND_WINDOW: "09:00-17:30" });
  assert.equal(custom.start, 540);
  assert.equal(custom.end, 1050);
  assert.equal(
    nextSendTime(
      new Date("2026-06-15T21:45:00Z"),
      "America/New_York",
      custom,
    ).toISOString(),
    "2026-06-16T13:00:00.000Z",
  );
  for (const bad of ["20:00-08:00", "8-20", "08:00-25:00", ""])
    assert.equal(quietHoursConfig({ MOW_SMS_SEND_WINDOW: bad }).start, 480);
});

test("DST transition days resolve the opening in local wall-clock time", () => {
  // Spring forward, March 8 2026: 10pm EST Saturday defers to 8am EDT Sunday (UTC-4).
  assert.equal(at("2026-03-08T03:00:00Z"), "2026-03-08T12:00:00.000Z");
  // 1:30am EST on the transition morning.
  assert.equal(at("2026-03-08T06:30:00Z"), "2026-03-08T12:00:00.000Z");
  // Fall back, November 1 2026: 9pm EDT Saturday defers to 8am EST Sunday (UTC-5).
  assert.equal(at("2026-11-01T01:00:00Z"), "2026-11-01T13:00:00.000Z");
  // 1:30am during the repeated hour (second pass, EST).
  assert.equal(at("2026-11-01T06:30:00Z"), "2026-11-01T13:00:00.000Z");
  // On the transition day, 7:59pm local is still inside, 8:00pm is outside.
  assert.equal(at("2026-11-02T00:59:00Z"), null);
  assert.equal(at("2026-11-02T01:00:00Z"), "2026-11-02T13:00:00.000Z");
  // Zones without DST are unaffected.
  assert.equal(
    at("2026-03-08T13:00:00Z", "America/Phoenix"),
    "2026-03-08T15:00:00.000Z",
  );
});

test("missing or invalid time zones fall back customer -> business -> configured default", () => {
  assert.equal(
    recipientTimeZone({
      customer: "America/Chicago",
      business: "America/Denver",
    }),
    "America/Chicago",
  );
  assert.equal(
    recipientTimeZone({ customer: undefined, business: "America/Denver" }),
    "America/Denver",
  );
  assert.equal(
    recipientTimeZone(
      { customer: "Mars/Olympus", business: "" },
      "America/Phoenix",
    ),
    "America/Phoenix",
  );
  assert.equal(recipientTimeZone({}, undefined), "America/New_York");
  assert.equal(
    quietHoursConfig({ MOW_SMS_DEFAULT_TIMEZONE: "Not/AZone" })
      .fallbackTimeZone,
    "America/New_York",
  );
  assert.equal(
    quietHoursConfig({ MOW_SMS_DEFAULT_TIMEZONE: "America/Chicago" })
      .fallbackTimeZone,
    "America/Chicago",
  );
});

const env = {
  BIRD_API_KEY: "bk_us1_unit",
  BIRD_SMS_FROM: "+13865551234",
  BIRD_WORKSPACE_ID: "ws_unit",
  BIRD_WEBHOOK_SECRET: "whsec_" + Buffer.from("unit-secret").toString("base64"),
  MOW_SMS_ENABLED: "true",
  BIRD_REGISTRATION_APPROVED: "true",
  BIRD_WEBHOOKS_VERIFIED: "true",
};
const quoteId = "11111111-1111-4111-8111-111111111111";
function harness({ now, timezone, claimDue }) {
  const writes = [];
  let sent = 0;
  const sms = createSMS({
    env,
    now: () => new Date(now),
    client: {
      sms: {
        send: async () => {
          sent++;
          return { id: "sms_unit", status: "accepted" };
        },
      },
    },
    backend: {
      db: async (path, method, body) => {
        if (method === "PATCH") return writes.push([path, body]);
        if (path.startsWith("mow_customer_quotes"))
          return [{ amount_cents: 2500 }];
        if (path.startsWith("mow_crew_companies"))
          return [{ name: "Test", communication_timezone: timezone }];
        if (path === "rpc/mow_quote_sms_claim_due") return claimDue;
        return {
          claimed: true,
          phone: "+13865555678",
          customer_id: "customer",
        };
      },
    },
  });
  return { sms, writes, sent: () => sent };
}

test("offer texts outside the business window are deferred, not sent or dropped", async () => {
  const h = harness({
    now: "2026-06-16T02:00:00Z",
    timezone: "America/Chicago",
  }); // 9pm CDT
  const r = await h.sms.sendQuote({
    cid: "company",
    user: { id: "owner" },
    quoteId,
  });
  assert.deepEqual(r, {
    ok: true,
    status: "deferred",
    send_after: "2026-06-16T13:00:00.000Z",
  });
  assert.equal(h.sent(), 0);
  assert.equal(h.writes[0][1].status, "deferred");
  assert.equal(h.writes[0][1].send_after, "2026-06-16T13:00:00.000Z");
  const inside = harness({
    now: "2026-06-16T02:00:00Z",
    timezone: "America/Los_Angeles",
  }); // 7pm PDT
  assert.equal(
    (
      await inside.sms.sendQuote({
        cid: "company",
        user: { id: "owner" },
        quoteId,
      })
    ).status,
    "accepted",
  );
  assert.equal(inside.sent(), 1);
});

test("the worker sends due deferred offers and re-defers if still in quiet hours", async () => {
  const claimDue = {
    claimed: true,
    quote_id: quoteId,
    company_id: "company",
    customer_id: "customer",
    phone: "+13865555678",
    company_name: "Test",
    amount_cents: 2500,
    business_time_zone: "America/New_York",
  };
  const due = harness({ now: "2026-06-16T12:00:00Z", claimDue });
  assert.equal((await due.sms.sendDeferredQuote()).status, "accepted");
  assert.equal(due.sent(), 1);
  assert.equal(due.writes[0][1].status, "accepted");
  const early = harness({ now: "2026-06-16T11:00:00Z", claimDue });
  assert.equal((await early.sms.sendDeferredQuote()).status, "deferred");
  assert.equal(early.sent(), 0);
  const idle = harness({
    now: "2026-06-16T12:00:00Z",
    claimDue: { claimed: false, status: "idle" },
  });
  assert.equal((await idle.sms.sendDeferredQuote()).status, "idle");
});

test("due-claim RPC rechecks consent and STOP before releasing a deferred offer", async () => {
  const db = new PGlite();
  const cid = "22222222-2222-4222-8222-222222222222",
    customer = "33333333-3333-4333-8333-333333333333",
    actor = "44444444-4444-4444-8444-444444444444";
  try {
    await db.exec(
      `create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);create table public.mow_customers(company_id uuid,id uuid,email text,primary key(company_id,id));create table public.mow_crew_companies(id uuid primary key,name text,communication_timezone text);create table public.mow_customer_quotes(id uuid primary key,company_id uuid,customer_id uuid,state text,expires_at timestamptz,amount_cents int);`,
    );
    const schema = await readFile(
      new URL("sms-schema.sql", import.meta.url),
      "utf8",
    );
    await db.exec(
      schema.slice(
        0,
        schema.indexOf("create function public.mow_sms_preferences"),
      ),
    );
    await db.exec(
      await readFile(
        new URL(
          "../../supabase/migrations/20261102120000_quote_sms_quiet_hours.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.exec(
      `insert into auth.users values('${actor}');insert into public.mow_crew_companies values('${cid}','Test','America/New_York');insert into public.mow_customers values('${cid}','${customer}','c@example.com');insert into public.mow_customer_channels(company_id,customer_id,phone,sms_offer_consent,consented_by,notice_version) values('${cid}','${customer}','+13865555678',true,'${actor}','2026-10-11');`,
    );
    const quote = async (id) => {
      await db.exec(
        `insert into public.mow_customer_quotes values('${id}','${cid}','${customer}','sent',now()+interval '7 days',2500);insert into public.mow_quote_messages(quote_id,company_id,status,send_after) values('${id}','${cid}','deferred',now()-interval '1 minute');`,
      );
    };
    const claim = async () =>
      (await db.query("select public.mow_quote_sms_claim_due() as r")).rows[0]
        .r;
    const status = async (id) =>
      (
        await db.query(
          "select status from public.mow_quote_messages where quote_id=$1",
          [id],
        )
      ).rows[0].status;
    await quote(quoteId);
    const first = await claim();
    assert.equal(first.claimed, true);
    assert.equal(first.business_time_zone, "America/New_York");
    assert.equal(await status(quoteId), "sending");
    assert.equal((await claim()).status, "idle");
    const stopped = "55555555-5555-4555-8555-555555555555";
    await quote(stopped);
    await db.exec(
      "insert into public.mow_sms_suppressions(phone) values('+13865555678')",
    );
    assert.equal((await claim()).status, "cancelled");
    assert.equal(await status(stopped), "failed");
  } finally {
    await db.close();
  }
});
