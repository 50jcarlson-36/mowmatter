import { test } from "node:test";
import assert from "node:assert/strict";
import { planRoute, minute } from "./planner.mjs";
import { roadMatrix } from "./google.mjs";
const jobs = [1, 2, 3].map((i) => ({
  id: "" + i,
  address: i + " Main Street",
  scheduled_time: `${8 + i}:00`,
  planned_minutes: 30,
  updated_at: "version",
}));
jobs[0].scheduled_time = "09:00";
const matrix = Array.from({ length: 4 }, (_, a) =>
  Array.from({ length: 4 }, (_, b) => ({
    seconds: a === b ? 0 : 1200,
    meters: a === b ? 0 : 10000,
  })),
);
for (const [a, b] of [
  [0, 2],
  [2, 1],
  [1, 3],
  [3, 0],
])
  matrix[a][b] = { seconds: 300, meters: 1000 };
test("road cost optimizer reduces driving, keeps every job and includes return travel", () => {
  const result = planRoute(jobs, matrix, {
    start: 480,
    end: 1020,
    flexible: ["1", "2", "3"],
  });
  assert.deepEqual(
    result.jobs.map((j) => j.id),
    ["2", "1", "3"],
  );
  assert.equal(result.after.drive_minutes, 20);
  assert.equal(result.before.drive_minutes, 65);
  assert.equal(result.return_time, "10:05");
});
test("fixed appointments never move and infeasible constraints do not produce a publishable plan", () => {
  const result = planRoute(jobs, matrix, {
    start: 480,
    end: 1020,
    flexible: [],
  });
  assert.deepEqual(
    result.jobs.map((j) => j.scheduled_time),
    ["09:00", "10:00", "11:00"],
  );
  assert.throws(
    () => planRoute(jobs, matrix, { start: 600, end: 620, flexible: [] }),
    /No feasible/,
  );
  assert.throws(() => minute("24:00"), /valid time/);
});
test("asymmetric costs respected and a feasible baseline is never worsened", () => {
  const result = planRoute(jobs, matrix, {
    start: 480,
    end: 1020,
    flexible: ["2", "3"],
  });
  assert.equal(result.jobs.find((j) => j.id === "1").scheduled_time, "09:00");
  assert(result.after.drive_minutes <= result.before.drive_minutes);
});
function response(entries) {
  return async (url, options) => {
    assert.match(url, /routes.googleapis.com/);
    assert.equal(JSON.parse(options.body).routingPreference, "TRAFFIC_UNAWARE");
    assert.equal(options.headers["X-Goog-Api-Key"], "test");
    return { ok: true, json: async () => entries };
  };
}
const entries = [0, 1].flatMap((i) =>
  [0, 1].map((j) => ({
    originIndex: i,
    destinationIndex: j,
    status: {},
    condition: "ROUTE_EXISTS",
    duration: "60s",
    distanceMeters: 400,
  })),
);
test("provider indexes are honored regardless of response order; no coordinate fallback", async () => {
  const m = await roadMatrix(["A", "B"], {
    key: "test",
    fetcher: response(entries.toReversed()),
  });
  assert.equal(m[0][1].seconds, 60);
  await assert.rejects(
    roadMatrix(["A", "B"], {
      key: "test",
      fetcher: response(entries.slice(1)),
    }),
    /Incomplete/,
  );
  await assert.rejects(
    roadMatrix(["A", "B"], {
      key: "test",
      fetcher: response(
        entries.map((e, i) =>
          i === 1 ? { ...e, condition: "ROUTE_NOT_FOUND" } : e,
        ),
      ),
    }),
    /connection/,
  );
  await assert.rejects(
    roadMatrix(["A", "B"], {
      key: "test",
      fetcher: async () => ({ ok: false }),
    }),
    /provider is unavailable/,
  );
  await assert.rejects(
    roadMatrix(["A", "B"], {
      key: "test",
      fetcher: async () => {
        throw Error("secret provider response");
      },
    }),
    /timed out/,
  );
});
