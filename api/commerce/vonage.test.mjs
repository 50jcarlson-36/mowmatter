import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { Readable } from "node:stream";
import { createVonage } from "./vonage.mjs";
import { createSMS } from "./sms.mjs";
const id = "11111111-1111-4111-8111-111111111111";
const env = {
  VONAGE_API_KEY: "unit-key",
  VONAGE_APPLICATION_ID: "unit-app",
  VONAGE_PRIVATE_KEY: "unit-private",
  VONAGE_SIGNATURE_SECRET: "unit-signature",
  VONAGE_SMS_FROM: "+13865551234",
  MOW_SMS_ENABLED: "true",
  VONAGE_REGISTRATION_APPROVED: "true",
  VONAGE_WEBHOOKS_VERIFIED: "true",
};
function jwt(raw, claims = {}) {
  const encode = (x) => Buffer.from(JSON.stringify(x)).toString("base64url");
  const p =
    encode({ alg: "HS256", typ: "JWT" }) +
    "." +
    encode({
      api_key: env.VONAGE_API_KEY,
      iat: Math.floor(Date.now() / 1000),
      payload_hash: createHash("sha256").update(raw).digest("hex"),
      ...claims,
    });
  return (
    p +
    "." +
    createHmac("sha256", env.VONAGE_SIGNATURE_SECRET)
      .update(p)
      .digest("base64url")
  );
}
async function call(
  provider,
  data,
  { claims = {}, token, path = "inbound" } = {},
) {
  const raw = JSON.stringify(data),
    req = Readable.from([raw]);
  req.url = "/api/commerce/sms/vonage/" + path;
  req.method = "POST";
  req.headers = {
    "content-type": "application/json",
    authorization: "Bearer " + (token || jwt(raw, claims)),
  };
  let status;
  await provider.webhook(req, { writeHead: (s) => (status = s), end() {} });
  return status;
}
test("Vonage credential presence alone does not activate SMS, invalid US sender blocks readiness", () => {
  assert.equal(
    createSMS({ env: { VONAGE_API_KEY: "unit" } }).status().provider,
    "vonage",
  );
  assert.equal(
    createSMS({ env: { VONAGE_API_KEY: "unit" } }).configured(),
    false,
  );
  assert.equal(
    createVonage({
      env: { ...env, VONAGE_SMS_FROM: "Vonage APIs" },
    }).configured(),
    false,
  );
});
test("Vonage send uses app JWT, exact API, normalized US numbers and provider reference", async () => {
  let request;
  const p = createVonage({
    env,
    makeToken: () => "unit-jwt",
    fetcher: async (url, o) => {
      request = { url, ...o };
      return { ok: true, json: async () => ({ message_uuid: id }) };
    },
  });
  const r = await p.send({ to: "+13865555678", body: "Unit message" });
  assert.equal(r.sid, "vonage:" + id);
  assert.equal(request.url, "https://api.nexmo.com/v1/messages");
  assert.equal(request.headers.Authorization, "Bearer unit-jwt");
  assert.deepEqual(JSON.parse(request.body), {
    from: "13865551234",
    to: "13865555678",
    channel: "sms",
    message_type: "text",
    text: "Unit message",
  });
});
test("Vonage verifies signature, account, body and freshness before durable STOP; YES never approves", async () => {
  const writes = [],
    p = createVonage({
      env,
      backend: { db: async (...args) => writes.push(args) },
    }),
    body = {
      message_uuid: id,
      channel: "sms",
      from: "13865555678",
      to: "13865551234",
      text: "STOP",
    };
  for (const options of [
    { token: "forged" },
    { claims: { api_key: "wrong" } },
    { claims: { payload_hash: "wrong" } },
    { claims: { iat: 1 } },
  ])
    assert.equal(await call(p, body, options), 403);
  assert.equal(writes.length, 0);
  assert.equal(await call(p, body), 200);
  assert.deepEqual(writes[0], [
    "rpc/mow_sms_stop",
    "POST",
    { p_phone: "+13865555678" },
  ]);
  assert.equal(await call(p, { ...body, text: "YES" }), 200);
  assert.equal(writes.length, 1);
});
test("Vonage delivery callbacks update only matching provider message and retain terminal-state protection", async () => {
  const writes = [],
    p = createVonage({
      env,
      backend: { db: async (...args) => writes.push(args) },
    });
  assert.equal(
    await call(
      p,
      { message_uuid: id, channel: "sms", status: "delivered" },
      { path: "status" },
    ),
    200,
  );
  assert.match(writes[0][0], /provider_id=eq.vonage:/);
  assert.match(writes[0][0], /not.in.\(delivered,undelivered,failed\)/);
  assert.equal(writes[0][2].status, "delivered");
});
