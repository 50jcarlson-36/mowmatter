import { test } from "node:test";
import assert from "node:assert/strict";
import { createRouteNotices, routeNoticeBody } from "./route-notices.mjs";
import { dispatchAction } from "./dispatch.mjs";
const claim = {
  claimed: true,
  id: "notice",
  company_name: "Test Lawn",
  company_id: "company",
  customer_id: "customer",
  job_id: "visit",
  phone: "+13865551234",
  kind: "approaching",
  payload: { ahead: 2 },
};
test("arrival copy uses actual stop count and a scoped service link; no invented ETA", () => {
  assert.match(routeNoticeBody(claim), /two stops away/);
  assert.match(
    routeNoticeBody({ ...claim, payload: { ahead: 1 } }),
    /next on our route/,
  );
  assert.match(routeNoticeBody(claim), /visit=visit#service-today/);
  assert.doesNotMatch(routeNoticeBody(claim), /minutes away/);
});
test("disabled or duplicate notice does not send", async () => {
  let writes = 0,
    sends = 0;
  const b = {
    db: async () => {
      writes++;
      return { claimed: false };
    },
  };
  await createRouteNotices({
    backend: b,
    transport: { configured: () => false },
  })();
  assert.equal(writes, 0);
  await createRouteNotices({
    backend: b,
    transport: {
      configured: () => true,
      send: async () => {
        sends++;
      },
    },
  })();
  assert.equal(sends, 0);
});
test("successful delivery records acceptance, uncertain sends are not retried", async () => {
  const calls = [];
  let sends = 0;
  const b = {
    db: async (...args) => {
      calls.push(args);
      return claim;
    },
  };
  const run = createRouteNotices({
    backend: b,
    transport: {
      configured: () => true,
      send: async () => {
        sends++;
        return { sid: "vonage:message" };
      },
    },
  });
  assert.equal((await run()).status, "accepted");
  assert.equal(calls[1][2].provider_id, "vonage:message");
  assert.equal(sends, 1);
  const uncertain = createRouteNotices({
    backend: b,
    transport: {
      configured: () => true,
      send: async () => {
        throw Error("timeout");
      },
    },
  });
  assert.equal((await uncertain()).status, "needs_review");
  assert.equal(calls.length, 3);
});
test("dispatch rejects malformed and unversioned moves before database mutation", async () => {
  let writes = 0;
  const b = {
    db: async () => {
      writes++;
    },
  };
  await assert.rejects(
    dispatchAction(b, { id: "owner" }, "company", "dispatch-change", {
      command: "move",
    }),
    /crew and date/,
  );
  assert.equal(writes, 0);
});
