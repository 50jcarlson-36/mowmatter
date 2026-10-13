import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { Readable } from "node:stream";
import { createSMS } from "./sms.mjs";
const env = {
  BIRD_API_KEY: "bk_us1_unit",
  BIRD_SMS_FROM: "+13865551234",
  BIRD_WORKSPACE_ID: "ws_unit",
  BIRD_WEBHOOK_SECRET: "whsec_" + Buffer.from("unit-secret").toString("base64"),
  MOW_SMS_ENABLED: "true",
  BIRD_REGISTRATION_APPROVED: "true",
  BIRD_WEBHOOKS_VERIFIED: "true",
};
const id = "sms_unit";
async function invoke(
  sms,
  type,
  data,
  {
    forged = false,
    timestamp = Math.floor(Date.now() / 1000),
    tamper = false,
  } = {},
) {
  const raw = JSON.stringify({
    type,
    data,
    timestamp: new Date().toISOString(),
  });
  const signature = createHmac("sha256", Buffer.from("unit-secret"))
    .update(`evt_unit.${timestamp}.${raw}`)
    .digest("base64");
  const req = Readable.from([tamper ? raw + " " : raw]);
  req.url = "/api/commerce/sms/bird/webhook";
  req.method = "POST";
  req.headers = {
    "content-type": "application/json",
    "webhook-id": "evt_unit",
    "webhook-timestamp": String(timestamp),
    "webhook-signature": "v1," + (forged ? "forged" : signature),
  };
  let status;
  await sms.webhook(req, { writeHead: (s) => (status = s), end() {} });
  return status;
}
const inbound = {
  sms_id: id,
  workspace_id: "ws_unit",
  from: "+13865555678",
  to: env.BIRD_SMS_FROM,
  text: "STOP",
};
test("Bird signature, freshness, body and workspace checks prevent forged preference changes", async () => {
  const writes = [];
  const sms = createSMS({
    env,
    backend: { db: async (...args) => writes.push(args) },
  });
  for (const options of [{ forged: true }, { timestamp: 1 }, { tamper: true }])
    assert.equal(await invoke(sms, "sms.received", inbound, options), 403);
  assert.equal(
    await invoke(sms, "sms.received", { ...inbound, workspace_id: "other" }),
    403,
  );
  assert.equal(writes.length, 0);
  assert.equal(await invoke(sms, "sms.received", inbound), 200);
  assert.deepEqual(writes[0], [
    "rpc/mow_sms_stop",
    "POST",
    { p_phone: inbound.from },
  ]);
  for (const text of ["YES", "START", "HELP"])
    assert.equal(await invoke(sms, "sms.received", { ...inbound, text }), 200);
  assert.equal(writes.length, 1);
});
test("Bird suppressions mirror durable STOP and callbacks protect terminal and sent states", async () => {
  const writes = [];
  const sms = createSMS({
    env,
    backend: { db: async (...args) => writes.push(args) },
  });
  await invoke(sms, "sms_suppression.created", {
    workspace_id: "ws_unit",
    originator: env.BIRD_SMS_FROM,
    destination: inbound.from,
  });
  assert.equal(writes[0][0], "rpc/mow_sms_stop");
  await invoke(sms, "sms.delivered", {
    ...inbound,
    from: env.BIRD_SMS_FROM,
    to: inbound.from,
  });
  assert.equal(writes.length, 4);
  for (const write of writes.slice(1, 4)) {
    assert.match(write[0], /provider_id=eq.bird:sms_unit/);
    assert.match(write[0], /not.in.\(delivered,undelivered,failed\)/);
    assert.equal(write[2].status, "delivered");
  }
  await invoke(sms, "sms.accepted", { ...inbound, from: env.BIRD_SMS_FROM });
  assert.match(writes[4][0], /status=eq.sending/);
});
test("Bird is the only provider and activation requires all gates", () => {
  assert.equal(createSMS({ env: {} }).status().provider, "bird");
  assert.equal(
    createSMS({ env: { BIRD_API_KEY: "unit" } }).configured(),
    false,
  );
  assert.equal(
    createSMS({ env: { ...env, BIRD_SMS_FROM: "bad" } }).configured(),
    false,
  );
  assert.equal(createSMS({ env }).configured(), true);
});
test("quote sends use Bird with stable idempotency and uncertain sends are never retried", async () => {
  let calls = 0;
  let request;
  const sms = createSMS({
    env,
    client: {
      sms: {
        send: async (...args) => {
          calls++;
          request = args;
          throw Error("timeout");
        },
      },
    },
    backend: {
      db: async (path) =>
        path.startsWith("mow_customer_quotes")
          ? [{ amount_cents: 2500 }]
          : path.startsWith("mow_crew_companies")
            ? [{ name: "Test" }]
            : { claimed: true, phone: inbound.from, customer_id: "customer" },
    },
  });
  await assert.rejects(
    () =>
      sms.sendQuote({
        cid: "company",
        user: { id: "owner" },
        quoteId: "11111111-1111-4111-8111-111111111111",
      }),
    /delivery needs review/,
  );
  assert.equal(calls, 1);
  assert.equal(request[0].from, env.BIRD_SMS_FROM);
  assert.equal(request[0].category, "marketing");
  assert.equal(request[1].maxRetries, 0);
  assert.match(request[1].idempotencyKey, /^quote:/);
});

test("Bird transport preserves E.164, saves provider ID and rejects unaccepted sends", async () => {
  const { createBirdSMS } = await import("./bird.mjs");
  let request;
  let result = { id, status: "accepted" };
  const bird = createBirdSMS({
    env,
    client: {
      sms: {
        send: async (...args) => {
          request = args;
          return result;
        },
      },
    },
  });
  assert.deepEqual(
    await bird.send({
      to: inbound.from,
      body: "Visit notice",
      idempotencyKey: "visit:unit",
    }),
    { sid: "bird:" + id },
  );
  assert.deepEqual(request[0], {
    from: env.BIRD_SMS_FROM,
    to: inbound.from,
    text: "Visit notice",
    category: "service",
  });
  await assert.rejects(
    () => bird.send({ to: "3865555678", body: "Invalid" }),
    /E.164/,
  );
  result = { id, status: "rejected" };
  await assert.rejects(
    () => bird.send({ to: inbound.from, body: "Rejected" }),
    /did not accept/,
  );
});
