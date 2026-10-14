import { test } from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { createRouting } from "./service.mjs";
import { createCommerce } from "../commerce/handler.mjs";
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const cid = id(1),
  user = { id: id(2), email_confirmed_at: "yes" },
  crew = id(3),
  jobs = [4, 5].map((n) => ({
    id: id(n),
    address: n + " Main Street, Orlando FL",
    scheduled_time: "10:00:00",
    planned_minutes: 30,
    status: "scheduled",
    updated_at: "2026-10-14T00:00:00Z",
  }));
const input = {
  company_id: cid,
  crew_id: crew,
  service_date: "2026-10-15",
  time_zone: "America/New_York",
  start_time: "08:00",
  end_time: "17:00",
  depot: "100 Main Street, Orlando FL",
  flexible_ids: jobs.map((j) => j.id),
};
function setup() {
  const calls = [],
    providerCalls = [];
  let current = Date.parse("2026-10-14T12:00Z"),
    quota = true;
  const b = {
    db: async (path, method, body) => {
      calls.push({ path, method, body });
      if (path.startsWith("mow_crew_members")) return [{ user_id: crew }];
      if (path.startsWith("mow_crew_jobs")) return jobs.map((j) => ({ ...j }));
      if (path.includes("reserve")) return quota;
      return { ok: true };
    },
  };
  const run = createRouting({
    backend: b,
    env: {
      GOOGLE_ROUTES_API_KEY: "private",
      MOW_ROUTING_ENABLED: "true",
      ROUTE_SIGNING_SECRET: "test-secret",
    },
    now: () => current,
    fetcher: async (url, opts) => {
      providerCalls.push(opts);
      return {
        ok: true,
        json: async () =>
          [0, 1, 2].flatMap((i) =>
            [0, 1, 2].map((j) => ({
              originIndex: i,
              destinationIndex: j,
              condition: "ROUTE_EXISTS",
              duration: "300s",
              distanceMeters: 1000,
            })),
          ),
      };
    },
  });
  return {
    run,
    calls,
    providerCalls,
    expire: () => (current += 16 * 60000),
    limit: () => (quota = false),
  };
}
test("proposal is read-only apart from quota; signed publication bound to company, owner and expiry", async () => {
  const t = setup(),
    r = await t.run(user, cid, "route-optimize", input);
  assert.equal(t.calls.filter((c) => c.method === "POST").length, 1);
  assert.equal(t.providerCalls.length, 1);
  assert(
    t.calls
      .filter((c) => c.path.startsWith("mow_"))
      .every((c) => c.path.includes("company_id=eq." + cid)),
  );
  await assert.rejects(
    t.run(user, id(9), "route-publish", {
      proposal: r.proposal,
      confirm_review: true,
    }),
    /another account/,
  );
  await assert.rejects(
    t.run({ id: id(9) }, cid, "route-publish", {
      proposal: r.proposal,
      confirm_review: true,
    }),
    /another account/,
  );
  await assert.rejects(
    t.run(user, cid, "route-publish", {
      proposal: r.proposal + "x",
      confirm_review: true,
    }),
    /Invalid/,
  );
  await assert.rejects(
    t.run(user, cid, "route-publish", { proposal: r.proposal }),
    /Review/,
  );
  await t.run(user, cid, "route-publish", {
    proposal: r.proposal,
    confirm_review: true,
  });
  assert.equal(t.calls.at(-1).path, "rpc/mow_route_plan_publish");
  assert.equal(t.calls.at(-1).body.payload.jobs.length, 2);
  t.expire();
  await assert.rejects(
    t.run(user, cid, "route-publish", {
      proposal: r.proposal,
      confirm_review: true,
    }),
    /expired/,
  );
});
test("cost guard prevents provider request; foreign IDs and missing provider fail closed", async () => {
  const t = setup();
  t.limit();
  await assert.rejects(t.run(user, cid, "route-optimize", input), /limit/);
  assert.equal(t.providerCalls.length, 0);
  await assert.rejects(
    t.run(user, cid, "route-optimize", { ...input, flexible_ids: [id(99)] }),
    /list changed/,
  );
  const disabled = createRouting({ env: {} });
  assert.equal(
    (await disabled(user, cid, "route-capabilities", {})).available,
    false,
  );
  await assert.rejects(
    disabled(user, cid, "route-optimize", input),
    /activation/,
  );
});
async function request(handler, path, body) {
  const req = Readable.from([JSON.stringify(body)]);
  req.url = "/api/commerce/" + path;
  req.method = "POST";
  req.headers = { "content-type": "application/json" };
  let result;
  await handler(req, {}, (status, data) => (result = { status, data }));
  return result;
}
test("HTTP routing requires verified owner and crew route order works with SMS disabled", async () => {
  const denied = createCommerce({
    env: {},
    backend: {
      owner: async () => {
        throw Object.assign(Error("denied"), { status: 403 });
      },
    },
  });
  assert.equal((await request(denied, "route-optimize", input)).status, 403);
  const b = {
    user: async () => user,
    db: async (path) =>
      path.startsWith("mow_crew_members")
        ? [{ role: "crew" }]
        : path.startsWith("mow_dispatch_routes")
          ? [{ service_date: "2026-10-15" }]
          : [
              { id: id(4), service_date: "2026-10-15", route_position: 2 },
              { id: id(5), service_date: "2026-10-16", route_position: 1 },
            ],
  };
  const r = await request(
    createCommerce({ env: { MOW_ROUTE_NOTICES_ENABLED: "false" }, backend: b }),
    "crew-order",
    { company_id: cid },
  );
  assert.equal(r.status, 200);
  assert.equal(r.data.positions[0].route_position, 2);
  assert.equal(r.data.positions[1].route_position, null);
});
