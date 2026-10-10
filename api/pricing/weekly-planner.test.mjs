import test from "node:test";
import assert from "node:assert/strict";
import { proposeWeek } from "../scheduling/weekly-planner.mjs";
const now = Date.parse("2026-10-10T12:00:00Z");
const input = () => ({
  now,
  jobs: [
    {
      id: "j1",
      zoneId: "north",
      dueDate: "2026-10-12",
      earliestDate: "2026-10-12",
      latestDate: "2026-10-16",
      serviceMinutes: 45,
      travelMinutes: 15,
    },
  ],
  slots: [
    {
      id: "mon",
      crewId: "c1",
      date: "2026-10-12",
      personIds: ["p1"],
      personnelVerified: true,
      capacityMinutes: 120,
    },
    {
      id: "tue",
      crewId: "c1",
      date: "2026-10-13",
      personIds: ["p1"],
      personnelVerified: true,
      capacityMinutes: 120,
    },
  ],
  weather: [
    {
      zoneId: "north",
      date: "2026-10-12",
      status: "clear",
      fetchedAt: "2026-10-10T11:00:00Z",
    },
    {
      zoneId: "north",
      date: "2026-10-13",
      status: "clear",
      fetchedAt: "2026-10-10T11:00:00Z",
    },
  ],
});
test("weather delay proposes a later permitted date and flags lateness", () => {
  const x = input();
  x.weather[0].status = "blocked";
  const q = proposeWeek(x);
  assert.equal(q.proposals[0].date, "2026-10-13");
  assert.equal(q.coverage.late, 1);
  assert.equal(q.status, "owner_review");
});
test("missing and stale forecasts do not imply good weather", () => {
  for (const weather of [
    [],
    input().weather.map((w) => ({ ...w, fetchedAt: "2026-10-09T11:00:00Z" })),
  ]) {
    const q = proposeWeek({ ...input(), weather });
    assert.equal(q.exceptions[0].reason, "weather_review");
    assert.equal(q.coverage.needsAction, 1);
  }
});
test("every due job is accounted for even when capacity fails", () => {
  const x = input();
  x.jobs.push({ ...x.jobs[0], id: "j2", serviceMinutes: 120 });
  const q = proposeWeek(x);
  assert.equal(q.coverage.due, q.coverage.proposed + q.coverage.needsAction);
  assert.equal(q.exceptions[0].reason, "capacity_conflict");
});
test("shared personnel cannot staff different crews on the same day", () => {
  const x = input();
  x.slots = [x.slots[0], { ...x.slots[0], id: "mon2", crewId: "c2" }];
  x.jobs[0].allowedCrewIds = ["c1"];
  x.jobs.push({ ...x.jobs[0], id: "j2", allowedCrewIds: ["c2"] });
  assert.equal(proposeWeek(x).exceptions[0].reason, "capacity_conflict");
});
test("locked visits and unverified rosters require owner action", () => {
  const x = input();
  x.jobs[0].locked = true;
  assert.equal(proposeWeek(x).exceptions[0].reason, "locked_visit_review");
  x.jobs[0].locked = false;
  x.slots.forEach((s) => (s.personnelVerified = false));
  assert.equal(proposeWeek(x).exceptions[0].reason, "no_eligible_crew");
});
test("growth influences priority without removing low-growth service obligations", () => {
  const x = input();
  x.jobs.push({ ...x.jobs[0], id: "fast", growthPriority: 3 });
  const q = proposeWeek(x);
  assert.equal(q.proposals[0].jobId, "fast");
  assert.equal(q.coverage.due, 2);
  assert.equal(q.coverage.proposed, 2);
});
test("confirmed appointment capacity is reserved before proposing new work", () => {
  const x = input();
  x.jobs[0].locked = true;
  x.jobs[0].lockedSlotId = "mon";
  x.jobs.push({ ...x.jobs[0], id: "j2", locked: false, serviceMinutes: 60 });
  const q = proposeWeek(x);
  assert.equal(q.proposals[0].date, "2026-10-13");
  assert.equal(q.remainingCapacity.find((s) => s.slotId === "mon").minutes, 60);
});
