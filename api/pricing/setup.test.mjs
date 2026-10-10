import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import {
  estimateLabor,
  loadedHourlyCents,
  actualLabor,
} from "../../office/dist/labor-engine.mjs";
import {
  setupSuggestions,
  applyConfiguration,
} from "../../office/dist/setup-engine.mjs";
import { createSetupAI, validateSuggestion } from "./setup-ai.mjs";
const labor = () => ({
  people: [
    {
      id: "a",
      name: "Owner",
      payBasis: "owner",
      hourlyCents: 2000,
      weeklyHours: 40,
    },
    {
      id: "b",
      name: "Worker",
      payBasis: "hourly",
      hourlyCents: 3000,
      burdenBps: 2000,
      benefitsHourlyCents: 400,
      weeklyHours: 30,
    },
  ],
  crews: [{ id: "c", name: "North", personIds: ["a", "b"] }],
});
const catalog = () => ({
  version: 1,
  visitMinimumCents: 4500,
  services: [{ id: "mow", name: "Mowing", mode: "area", priceCents: 800 }],
  packages: [],
});
const profile = () => ({
  city: "Palm Coast, FL",
  workers: 2,
  crewHourlyCostCents: 6000,
  visitCostCents: 6000,
  minutes: 45,
  areaSqft: 5000,
  targetMarginPercent: 30,
});
const ai = () => ({
  summary: "Confirm scope before quoting.",
  recommendations: [
    {
      serviceId: "mow",
      mode: "area",
      hourBasis: "crew",
      reason: "Use confirmed lawn area.",
    },
  ],
  checklist: ["Review access."],
});
test("loaded costs distinguish wage, burden and benefit costs", () =>
  assert.equal(loadedHourlyCents(labor().people[1]), 4000));
test("salary uses configured paid hours instead of an invented billable-hour divisor", () =>
  assert.equal(
    loadedHourlyCents({
      payBasis: "salary",
      annualSalaryCents: 5200000,
      annualPaidHours: 2080,
    }),
    2500,
  ));
test("crew cost uses each assigned person and includes travel", () => {
  const q = estimateLabor(labor(), "c", {
    onsiteMinutes: 60,
    travelMinutes: 15,
    otherCostCents: 500,
  });
  assert.equal(q.workerMinutes, 120);
  assert.equal(q.travelWorkerMinutes, 30);
  assert.equal(q.totalCostCents, 8000);
  assert.equal(q.theoreticalWeeklyCrewHours, 30);
});
test("solo work and inactive assignment handling", () => {
  const l = labor();
  l.crews[0].personIds = ["a"];
  assert.equal(
    estimateLabor(l, "c", { onsiteMinutes: 30 }).totalCostCents,
    1000,
  );
  l.people[0].active = false;
  assert.throws(() => estimateLabor(l, "c", { onsiteMinutes: 30 }), /inactive/);
});
test("actual labor snapshots support different personnel durations", () => {
  const entries = [
    {
      id: "1",
      personId: "a",
      startedAt: "2026-10-10T10:00Z",
      endedAt: "2026-10-10T11:00Z",
      loadedHourlyCents: 2000,
    },
    {
      id: "2",
      personId: "b",
      startedAt: "2026-10-10T10:30Z",
      endedAt: "2026-10-10T11:00Z",
      loadedHourlyCents: 4000,
    },
  ];
  assert.deepEqual(actualLabor(entries), {
    workerMinutes: 90,
    totalCents: 4000,
  });
  assert.throws(() => actualLabor([...entries, entries[0]]), /Duplicate/);
  assert.throws(
    () => actualLabor([...entries, { ...entries[0], id: "3" }]),
    /Overlapping/,
  );
});
test("cost reference uses margin division, not markup multiplication", () =>
  assert.equal(setupSuggestions(profile(), catalog()).visitMinimumCents, 8600));
test("configuration requires approval and preserves unrelated data", () => {
  const c = catalog();
  const change = {
    visitMinimumCents: 5000,
    services: [
      {
        id: "mow",
        mode: "area",
        priceCents: 1000,
        minimumCents: 4000,
        hourBasis: "crew",
      },
    ],
  };
  assert.throws(() => applyConfiguration(c, change, false), /approve/);
  const next = applyConfiguration(c, change, true);
  assert.equal(next.services[0].priceCents, 1000);
  assert.equal(c.services[0].priceCents, 800);
  assert.equal(next.version, 1);
});
test("AI cannot invent service IDs or return prices in sanitized results", () => {
  assert.throws(() =>
    validateSuggestion(
      {
        ...ai(),
        recommendations: [{ ...ai().recommendations[0], serviceId: "fake" }],
      },
      catalog().services,
    ),
  );
  const out = validateSuggestion(
    { ...ai(), priceCents: 99999 },
    catalog().services,
  );
  assert.equal(out.priceCents, undefined);
});
const userId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const mockFetch = (role) => async (url) =>
  new Response(
    JSON.stringify(
      url.includes("/auth/")
        ? { id: userId }
        : role === "owner"
          ? [{ company_id: "company-a", role: "owner" }]
          : [],
    ),
    { status: 200 },
  );
const env = {
  SETUP_AI_ENABLED: "true",
  AI_GATEWAY_API_KEY: "test-only",
  AI_GATEWAY_MODEL: "mock-model",
};
async function call(
  handler,
  body,
  authorization = "Bearer test",
  method = "POST",
) {
  const req = Readable.from([JSON.stringify(body)]);
  req.url = "/api/setup/suggest";
  req.method = method;
  req.headers = { "content-type": "application/json", authorization };
  let response;
  await handler(req, {}, (status, data) => (response = { status, data }));
  return response;
}
test("AI endpoint requires authentication and owner membership before generating", async () => {
  let generated = 0;
  const h = createSetupAI({
    env,
    fetcher: mockFetch("crew"),
    generate: async () => {
      generated++;
      return ai();
    },
  });
  assert.equal(
    (await call(h, { profile: profile(), services: catalog().services }))
      .status,
    403,
  );
  assert.equal((await call(h, {}, "")).status, 401);
  assert.equal(generated, 0);
});
test("AI receives only allowlisted aggregate inputs, not names or wage records", async () => {
  let received;
  const h = createSetupAI({
    env,
    fetcher: mockFetch("owner"),
    generate: async (input) => {
      received = input;
      return ai();
    },
  });
  const r = await call(h, {
    profile: {
      ...profile(),
      employeeNames: ["PRIVATE"],
      customerList: ["SECRET"],
    },
    services: catalog().services,
    people: labor().people,
  });
  assert.equal(r.status, 200);
  assert.equal(JSON.stringify(received).includes("PRIVATE"), false);
  assert.equal(received.services[0].priceCents, undefined);
  assert.equal(r.data.requires_owner_approval, true);
});
test("daily suggestion quota blocks additional spend", async () => {
  let calls = 0;
  const h = createSetupAI({
    env,
    fetcher: mockFetch("owner"),
    generate: async () => {
      calls++;
      return ai();
    },
  });
  for (let i = 0; i < 5; i++)
    assert.equal(
      (await call(h, { profile: profile(), services: catalog().services }))
        .status,
      200,
    );
  assert.equal(
    (await call(h, { profile: profile(), services: catalog().services }))
      .status,
    429,
  );
  assert.equal(calls, 5);
});
test("disabled connection and invalid model result fail without changing drafts", async () => {
  const off = createSetupAI({ env: {}, generate: async () => ai() });
  assert.equal((await call(off, { profile: profile() })).status, 503);
  const bad = createSetupAI({
    env,
    fetcher: mockFetch("owner"),
    generate: async () => ({}),
  });
  assert.equal(
    (await call(bad, { profile: profile(), services: catalog().services }))
      .status,
    502,
  );
});
