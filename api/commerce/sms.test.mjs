import { test } from "node:test";
import assert from "node:assert/strict";
import twilio from "twilio";
import { Readable } from "node:stream";
import { createSMS } from "./sms.mjs";
const env = {
  TWILIO_AUTH_TOKEN: "unit-token",
  TWILIO_ACCOUNT_SID: "ACunit",
  TWILIO_WEBHOOK_URL: "https://example.invalid/api/commerce/sms/webhook",
  TWILIO_STATUS_WEBHOOK_URL: "https://example.invalid/api/commerce/sms/status",
};
async function invoke(sms, params, signature) {
  const req = Readable.from([new URLSearchParams(params).toString()]);
  req.url = "/api/commerce/sms/webhook";
  req.method = "POST";
  req.headers = {
    "content-type": "application/x-www-form-urlencoded",
    "x-twilio-signature": signature,
  };
  let status, body;
  await sms.webhook(req, {
    writeHead: (s) => (status = s),
    end: (b) => (body = b),
  });
  return { status, body };
}
test("forged SMS webhook cannot mutate preferences", async () => {
  let writes = 0;
  const sms = createSMS({ env, backend: { db: async () => writes++ } });
  const r = await invoke(
    sms,
    { AccountSid: "ACunit", Body: "STOP", From: "+13865551234" },
    "forged",
  );
  assert.equal(r.status, 403);
  assert.equal(writes, 0);
});
test("valid STOP applies durable suppression; ordinary YES replies never approve work", async () => {
  const writes = [];
  const sms = createSMS({
    env,
    backend: {
      db: async (path, method, body) => {
        writes.push({ path, body });
        return true;
      },
    },
  });
  for (const Body of ["YES", "STOP"]) {
    const p = {
      AccountSid: "ACunit",
      Body,
      From: "+13865551234",
      MessageSid: "SM00000000000000000000000000000000",
    };
    assert.equal(
      (
        await invoke(
          sms,
          p,
          twilio.getExpectedTwilioSignature(
            env.TWILIO_AUTH_TOKEN,
            env.TWILIO_WEBHOOK_URL,
            p,
          ),
        )
      ).status,
      200,
    );
  }
  assert.equal(writes.length, 1);
  assert.equal(writes[0].path, "rpc/mow_sms_stop");
  assert.equal(writes[0].body.p_phone, "+13865551234");
});
test("uncertain SMS send is not retried", async () => {
  let calls = 0;
  const sms = createSMS({
    env: {
      ...env,
      MOW_SMS_ENABLED: "true",
      TWILIO_REGISTRATION_APPROVED: "true",
      TWILIO_MESSAGING_SERVICE_SID: "MGunit",
    },
    client: {
      messages: {
        create: async () => {
          calls++;
          throw Error("timeout");
        },
      },
    },
    backend: {
      db: async (path) =>
        path.startsWith("mow_customer_quotes")
          ? [{ id: "11111111-1111-4111-8111-111111111111", amount_cents: 2500 }]
          : path.startsWith("mow_crew_companies")
            ? [{ name: "Test business" }]
            : { claimed: true, phone: "+13865551234", customer_id: "customer" },
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
});
