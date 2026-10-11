import test from "node:test";
import assert from "node:assert/strict";
import {
  canAccessJob,
  jobWindow,
} from "../supabase/functions/mowmatter-crew/job-window.mjs";
test("lead access is limited to their crew or personally assigned visits", () => {
  const lead = {
    company_id: "a",
    role: "lead",
    user_id: "lead",
    crew_id: "north",
  };
  assert(
    canAccessJob(lead, {
      company_id: "a",
      crew_id: "north",
      assigned_to: "worker",
    }),
  );
  assert(
    !canAccessJob(lead, {
      company_id: "a",
      crew_id: "south",
      assigned_to: "worker",
    }),
  );
  assert(
    !canAccessJob(lead, {
      company_id: "b",
      crew_id: "north",
      assigned_to: "lead",
    }),
  );
  assert(
    !canAccessJob(
      { ...lead, crew_id: null },
      { company_id: "a", crew_id: null, assigned_to: "worker" },
    ),
  );
  assert(
    canAccessJob(lead, {
      company_id: "a",
      crew_id: "south",
      assigned_to: "lead",
    }),
  );
});
test("field window includes today despite old history and uses business timezone", () => {
  const w = jobWindow({}, new Date("2026-10-12T02:00:00Z"));
  assert.equal(w.from, "2026-10-04");
  assert.equal(w.to, "2026-11-15");
  assert.throws(() => jobWindow({ from_date: "2026-02-30" }));
  assert.throws(() =>
    jobWindow({ from_date: "2026-01-01", to_date: "2026-12-31" }),
  );
  assert.throws(() =>
    jobWindow({ cursor: { date: "bad", time: "bad", id: "bad" } }),
  );
});
