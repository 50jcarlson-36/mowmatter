import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { readFile } from "node:fs/promises";
test("route preview requires review; sends only selected flexibility; refreshes after signed publish", async () => {
  const dom = new JSDOM(
      '<div id="dispatch-board"></div><dialog id="dialog"><div id="dialog-content"></div></dialog>',
      {
        runScripts: "outside-only",
        url: "https://office.mowmatter.com/routes.html",
      },
    ),
    w = dom.window;
  w.HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  w.HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
  const day = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 10),
    calls = [];
  let reloads = 0;
  const jobs = [1, 2].map((n) => ({
    id: "job" + n,
    assigned_to: "crew",
    service_date: day,
    scheduled_time: "10:00",
    address: n + " Main Street",
    customer_name: "Fixture",
    services: ["Mow"],
    status: "scheduled",
    planned_minutes: 30,
    updated_at: "v1",
  }));
  w.MowCommerce = {
    request: async (action, body) => {
      calls.push({ action, body });
      if (action === "route-capabilities") return { available: true };
      if (action === "route-optimize")
        return {
          proposal: "signed",
          before: { drive_minutes: 30, miles: 12, feasible: false },
          after: { drive_minutes: 20, miles: 9 },
          return_time: "12:00",
          service_minutes: 60,
          jobs: jobs.map((j) => ({
            ...j,
            original_time: "10:00",
            drive_minutes: 10,
            service_minutes: 30,
          })),
          notice: "Review",
        };
      return { routes: [], notices: [] };
    },
  };
  w.eval(
    await readFile(
      new URL("../../office/dist/dispatch-board.js", import.meta.url),
      "utf8",
    ),
  );
  await w.showDispatchBoard(
    {
      company: { id: "company" },
      members: [{ user_id: "crew", display_name: "Crew" }],
      jobs,
    },
    { reload: async () => reloads++, edit: () => {}, details: () => {} },
  );
  w.document.querySelector("[data-optimize]").click();
  const f = w.document.querySelector("#route-plan");
  f.elements.depot.value = "100 Depot Road, Orlando FL";
  f.querySelector("[name=flexible_ids]").checked = true;
  await f.onsubmit({
    preventDefault() {},
    submitter: f.querySelector("button"),
  });
  assert.deepEqual(
    Array.from(
      calls.find((c) => c.action === "route-optimize").body.flexible_ids,
    ),
    ["job1"],
  );
  assert.equal(w.document.querySelector("#route-apply").disabled, true);
  assert.equal(
    calls.some((c) => c.action === "route-publish"),
    false,
  );
  w.document.querySelector("#route-review").click();
  await w.document.querySelector("#route-apply").onclick();
  const published = calls.find((c) => c.action === "route-publish");
  assert.equal(published.body.proposal, "signed");
  assert.equal(published.body.confirm_review, true);
  assert.equal(reloads, 1);
  dom.window.close();
});
