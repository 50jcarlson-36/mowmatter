import { test } from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { createCommerce } from "./handler.mjs";
const co = "11111111-1111-4111-8111-111111111111",
  cu = "22222222-2222-4222-8222-222222222222",
  id = "33333333-3333-4333-8333-333333333333",
  actor = "44444444-4444-4444-8444-444444444444";
function harness({
  email = "customer@example.invalid",
  verified = true,
  owner = false,
} = {}) {
  const writes = [];
  const backend = {
    user: async () => ({
      id: actor,
      email,
      email_confirmed_at: verified ? "confirmed" : null,
    }),
    owner: async () => {
      if (!owner) throw Object.assign(Error("Owner required"), { status: 403 });
      return { id: actor, email, email_confirmed_at: "confirmed" };
    },
    db: async (path, method, body) => {
      if (method === "POST") {
        writes.push({ path, body });
        return { ok: true };
      }
      if (path.startsWith("mow_customers"))
        return [{ id: cu, email: "customer@example.invalid" }];
      return [];
    },
  };
  const h = createCommerce({ backend, env: {} });
  return {
    writes,
    call: async (action, input = {}) => {
      const req = Readable.from([
        JSON.stringify({ company_id: co, customer_id: cu, id, ...input }),
      ]);
      req.url = "/api/commerce/" + action;
      req.method = "POST";
      req.headers = { "content-type": "application/json" };
      let result;
      await h(req, {}, (status, body) => (result = { status, body }));
      return result;
    },
  };
}
test("unconfirmed and other customer identities cannot read or change commerce records", async () => {
  for (const options of [
    { verified: false },
    { email: "other@example.invalid" },
  ]) {
    const h = harness(options);
    assert([401, 403].includes((await h.call("customer")).status));
    assert(
      [401, 403].includes(
        (
          await h.call("request", {
            kind: "service",
            message: "Cleanup please",
          })
        ).status,
      ),
    );
    assert.equal(h.writes.length, 0);
  }
});
test("customer cannot publish, book or resolve owner work", async () => {
  const h = harness();
  for (const action of ["quote", "book", "resolve", "apply-addon"])
    assert.equal((await h.call(action)).status, 403);
  assert.equal(h.writes.length, 0);
});
test("approval requires explicit checkbox and forwards server identity, never browser actor", async () => {
  const h = harness();
  assert.equal(
    (await h.call("respond", { choice: "accepted", confirm_quote: false }))
      .status,
    400,
  );
  assert.equal(h.writes.length, 0);
  assert.equal(
    (
      await h.call("respond", {
        choice: "accepted",
        confirm_quote: true,
        actor: "attacker",
      })
    ).status,
    200,
  );
  assert.equal(h.writes[0].body.actor, actor);
  assert.equal(h.writes[0].body.actor_email, "customer@example.invalid");
});
test("SMS preferences require explicit boolean and US number; disabled preference save cannot request a message", async () => {
  const h = harness();
  assert.equal(
    (await h.call("sms-preferences", { phone: "123", consent: true })).status,
    400,
  );
  assert.equal(
    (
      await h.call("sms-preferences", {
        phone: "+13865551234",
        consent: "true",
      })
    ).status,
    400,
  );
  assert.equal(h.writes.length, 0);
  assert.equal(
    (
      await h.call("sms-preferences", {
        phone: "+13865551234",
        consent: false,
        service_consent: false,
      })
    ).status,
    200,
  );
  assert.equal(h.writes[0].body.consent, false);
  assert.equal(h.writes[0].path, "rpc/mow_sms_preferences_confirm");
  assert.equal(h.writes[0].body.send_confirmation, false);
  assert.equal(h.writes[0].body.route_enabled, false);
});
test("disabled SMS prevents provider send and quote claim", async () => {
  const h = harness({ owner: true });
  assert.equal((await h.call("send-quote-sms")).status, 503);
  assert.equal(h.writes.length, 0);
});
test("visit photo endpoints deny other customers and reject unrelated jobs before reading storage", async () => {
  assert.equal(
    (
      await harness({ email: "wrong@example.invalid" }).call("visit-photos", {
        job_id: id,
      })
    ).status,
    403,
  );
  assert.equal(
    (await harness().call("visit-photos", { job_id: id })).status,
    404,
  );
  assert.equal(
    (await harness().call("visit-photo", { job_id: id, photo_id: id })).status,
    404,
  );
});
