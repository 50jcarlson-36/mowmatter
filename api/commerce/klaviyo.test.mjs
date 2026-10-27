import test from "node:test";
import assert from "node:assert/strict";
import { createKlaviyoSMS } from "./klaviyo.mjs";
import { createSMS } from "./sms.mjs";
const cid = "11111111-1111-4111-8111-111111111111";
const customer = "22222222-2222-4222-8222-222222222222";
const env = {
  KLAVIYO_PRIVATE_API_KEY: "unit-private",
  MOW_SMS_ENABLED: "true",
  KLAVIYO_REGISTRATION_APPROVED: "true",
  KLAVIYO_FLOWS_VERIFIED: "true",
};
const message = {
  to: "+13865551234",
  companyId: cid,
  customerId: customer,
  body: "Test Lawn — powered by Mowmatter: Visit complete. Reply STOP to opt out, HELP for help.",
  idempotencyKey: "visit:unit",
};
const subscribed = {
  marketing: { consent: "SUBSCRIBED", can_receive_sms_marketing: true },
  transactional: { consent: "SUBSCRIBED", can_receive_sms_transactional: true },
};
function fixture(subscriptions = subscribed, status = 202) {
  const requests = [];
  const fetcher = async (url, options) => {
    requests.push({ url, options });
    if (options.method === "GET")
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            {
              id: "profile-unit",
              attributes: { subscriptions: { sms: subscriptions } },
            },
          ],
        }),
      };
    return { ok: status === 202, status };
  };
  return { requests, fetcher };
}
test("Klaviyo is the sole runtime provider; Bird keys cannot activate it", () => {
  assert.equal(
    createSMS({ env: { BIRD_API_KEY: "legacy" } }).status().provider,
    "klaviyo",
  );
  for (const key of Object.keys(env))
    assert.equal(
      createKlaviyoSMS({ env: { ...env, [key]: "" } }).configured(),
      false,
    );
  assert.equal(createKlaviyoSMS({ env }).configured(), true);
});
test("service events retain tenant scope and deterministic IDs without modifying shared profile branding", async () => {
  const f = fixture();
  const sms = createKlaviyoSMS({ env, fetcher: f.fetcher });
  const a = await sms.send(message),
    b = await sms.send(message);
  assert.deepEqual(a, b);
  assert.match(a.sid, /^klaviyo:[a-f0-9]{64}$/);
  assert.equal(f.requests.length, 4);
  const event = JSON.parse(f.requests[1].options.body).data.attributes;
  assert.equal(event.properties.company_id, cid);
  assert.equal(event.properties.customer_id, customer);
  assert.equal(event.properties.message, message.body);
  assert.equal(event.profile.data.id, "profile-unit");
  assert.equal(event.profile.data.attributes, undefined);
  assert.equal(
    event.metric.data.attributes.name,
    "MowMatter SMS Service Requested",
  );
  assert.equal(f.requests[1].options.headers.revision, "2026-10-15");
  assert.equal(f.requests[1].options.redirect, "error");
  assert.match(
    decodeURIComponent(f.requests[0].url),
    /equals\(phone_number,"\+13865551234"\)/,
  );
});
test("service-only consent cannot authorize upsells; current STOP and provider blocks prevent events", async () => {
  for (const smsSubscriptions of [
    { transactional: subscribed.transactional },
    {
      ...subscribed,
      marketing: { consent: "UNSUBSCRIBED", can_receive_sms_marketing: false },
    },
    {
      ...subscribed,
      marketing: { consent: "SUBSCRIBED", can_receive_sms_marketing: false },
    },
  ]) {
    const f = fixture(smsSubscriptions);
    await assert.rejects(
      createKlaviyoSMS({ env, fetcher: f.fetcher }).send({
        ...message,
        category: "marketing",
      }),
      /consent required/,
    );
    assert.equal(f.requests.length, 1);
  }
  const f = fixture({});
  await assert.rejects(
    createKlaviyoSMS({ env, fetcher: f.fetcher }).send(message),
    /consent required/,
  );
  assert.equal(f.requests.length, 1);
});
test("marketing consent permits offers and transaction-only consent permits service", async () => {
  const f = fixture({ transactional: subscribed.transactional });
  await createKlaviyoSMS({ env, fetcher: f.fetcher }).send(message);
  const g = fixture({ marketing: subscribed.marketing });
  await createKlaviyoSMS({ env, fetcher: g.fetcher }).send({
    ...message,
    category: "marketing",
  });
  assert.equal(
    JSON.parse(g.requests[1].options.body).data.attributes.metric.data
      .attributes.name,
    "MowMatter SMS Offer Requested",
  );
});
test("disabled sends and invalid tenant/phone data never call Klaviyo", async () => {
  const f = fixture();
  await assert.rejects(
    createKlaviyoSMS({ env: {}, fetcher: f.fetcher }).send(message),
    /awaiting activation/,
  );
  for (const override of [
    { to: "3865551234" },
    { companyId: "other" },
    { customerId: "" },
    { idempotencyKey: "" },
    { body: "" },
    { category: "other" },
  ])
    await assert.rejects(
      createKlaviyoSMS({ env, fetcher: f.fetcher }).send({
        ...message,
        ...override,
      }),
    );
  assert.equal(f.requests.length, 0);
});
test("uncertain submissions are attempted once; retired callbacks cannot mutate data", async () => {
  let calls = 0;
  const f = fixture();
  const fetcher = async (...args) => {
    if (args[1].method === "POST") {
      calls++;
      throw Error("timeout");
    }
    return f.fetcher(...args);
  };
  await assert.rejects(
    createKlaviyoSMS({ env, fetcher }).send(message),
    /timeout/,
  );
  assert.equal(calls, 1);
  let status;
  const sms = createKlaviyoSMS({ env: {} });
  assert.equal(
    await sms.webhook(
      { url: "/api/commerce/sms/bird/webhook" },
      { writeHead: (s) => (status = s), end() {} },
    ),
    true,
  );
  assert.equal(status, 410);
  assert.equal(await sms.webhook({ url: "/unrelated" }, {}), false);
});
test("quote integration uses server-owned company, customer, brand and marketing category", async () => {
  const f = fixture();
  const writes = [];
  const sms = createSMS({
    env,
    fetcher: f.fetcher,
    backend: {
      db: async (path, method, body) => {
        if (path.startsWith("mow_customer_quotes?"))
          return [{ amount_cents: 2500 }];
        if (path.startsWith("mow_crew_companies?"))
          return [{ name: "Test Lawn" }];
        if (path.startsWith("rpc/"))
          return { claimed: true, phone: message.to, customer_id: customer };
        writes.push({ path, method, body });
      },
    },
  });
  assert.equal(
    (await sms.sendQuote({ cid, user: { id: "owner" }, quoteId: cid })).status,
    "accepted",
  );
  const payload = JSON.parse(f.requests[1].options.body).data.attributes
    .properties;
  assert.equal(payload.company_id, cid);
  assert.equal(payload.customer_id, customer);
  assert.equal(payload.category, "marketing");
  assert.match(payload.message, /Test Lawn — powered by Mowmatter/);
  assert.match(writes[0].body.provider_id, /^klaviyo:/);
});

test("fresh consent sync preserves category boundaries and never silently restores provider STOP", async () => {
  const f = fixture({});
  const sync = createKlaviyoSMS({ env, fetcher: f.fetcher }).syncPreferences;
  assert.equal(
    (
      await sync({
        phone: message.to,
        companyId: cid,
        customerId: customer,
        marketing: false,
        service: true,
      })
    ).status,
    "provider_pending",
  );
  const request = JSON.parse(f.requests[1].options.body).data.attributes;
  assert.deepEqual(request.profiles.data[0].attributes.subscriptions.sms, {
    transactional: { consent: "SUBSCRIBED" },
  });
  assert.equal(request.historical_import, false);
  const stopped = fixture({
    marketing: { consent: "UNSUBSCRIBED", can_receive_sms_marketing: false },
  });
  assert.equal(
    (
      await createKlaviyoSMS({ env, fetcher: stopped.fetcher }).syncPreferences(
        {
          phone: message.to,
          companyId: cid,
          customerId: customer,
          marketing: true,
        },
      )
    ).status,
    "provider_opt_out",
  );
  assert.equal(stopped.requests.length, 1);
});

test("provider delivery blocks are not cleared by a preference save", async () => {
  const f = fixture({
    marketing: { consent: "SUBSCRIBED", can_receive_sms_marketing: false },
  });
  const result = await createKlaviyoSMS({
    env,
    fetcher: f.fetcher,
  }).syncPreferences({
    phone: message.to,
    companyId: cid,
    customerId: customer,
    marketing: true,
  });
  assert.equal(result.status, "provider_blocked");
  assert.equal(f.requests.length, 1);
});
