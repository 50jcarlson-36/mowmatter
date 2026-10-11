import { test } from "node:test";
import assert from "node:assert/strict";
import { createVisitSMS } from "./visit-sms.mjs";
const eventId = "11111111-1111-4111-8111-111111111111",
  user = { id: "owner" };
test("disabled status SMS does not claim or send; suppressed/duplicate claim does not send", async () => {
  const writes = [],
    messages = [];
  const backend = {
    db: async (...args) => {
      writes.push(args);
      return { claimed: false, status: "held_opt_out" };
    },
  };
  const send = createVisitSMS({
    backend,
    transport: { configured: () => false, send: async (x) => messages.push(x) },
  });
  assert.deepEqual(await send({ user, eventId }), {
    status: "pending_provider",
  });
  assert.equal(writes.length, 0);
  const active = createVisitSMS({
    backend,
    transport: { configured: () => true, send: async (x) => messages.push(x) },
  });
  assert.equal((await active({ user, eventId })).status, "held_opt_out");
  assert.equal(messages.length, 0);
});
test("completion status SMS uses server-owned destination and account photo link; uncertain sends cannot be retried by transport", async () => {
  const writes = [],
    messages = [];
  const backend = {
    db: async (path, method, body) => {
      writes.push({ path, method, body });
      return {
        claimed: true,
        id: eventId,
        phone: "+13865551234",
        kind: "completion",
        company_name: "Test Lawn",
        company_id: eventId,
        customer_id: eventId,
      };
    },
  };
  const active = createVisitSMS({
    backend,
    transport: {
      configured: () => true,
      send: async (x) => {
        messages.push(x);
        return { sid: "vonage:unit" };
      },
    },
  });
  assert.equal((await active({ user, eventId })).status, "accepted");
  assert.match(messages[0].body, /We finished.*photos:/);
  assert.match(messages[0].body, /customer-account.html\?business=/);
  assert.equal(messages[0].to, "+13865551234");
  assert.equal(writes[1].body.provider_id, "vonage:unit");
  const uncertain = createVisitSMS({
    backend,
    transport: {
      configured: () => true,
      send: async () => {
        throw Error("timeout");
      },
    },
  });
  await assert.rejects(uncertain({ user, eventId }), /delivery needs review/);
});
