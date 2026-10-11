import { test } from "node:test";
import { JSDOM } from "jsdom";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
test("dispatch cards publish a versioned order and customer view links to care", async () => {
  const dom = new JSDOM(
    '<div id="dispatch-board"></div><dialog id="dialog"><div id="dialog-content"></div></dialog><section id="service"></section>',
    {
      url: "https://office.mowmatter.com/routes.html",
      runScripts: "outside-only",
    },
  );
  const w = dom.window;
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
  const data = {
    company: { id: "company" },
    members: [
      { user_id: "crew1", display_name: "North crew" },
      { user_id: "crew2", display_name: "South crew" },
    ],
    jobs: [1, 2, 3].map((n) => ({
      id: "job" + n,
      assigned_to: "crew1",
      service_date: day,
      scheduled_time: `${String(8 + n).padStart(2, "0")}:00`,
      address: n + " Oak Drive",
      customer_name: "Test Customer",
      services: ["Mow", "Edge"],
      status: "scheduled",
      planned_minutes: 30,
      updated_at: "2026-10-11T12:00:00Z",
    })),
  };
  w.MowCommerce = {
    request: async (action, body) => {
      calls.push({ action, body });
      return action === "service-status"
        ? {
            visits: [
              {
                id: "job3",
                date: day,
                time: "11:00",
                status: "scheduled",
                stops_ahead: 2,
              },
            ],
            updated_at: new Date().toISOString(),
          }
        : { routes: [], notices: [] };
    },
  };
  w.eval(
    await readFile(
      new URL("../../office/dist/dispatch-board.js", import.meta.url),
      "utf8",
    ),
  );
  await w.showDispatchBoard(data, {
    details: () => {},
    edit: () => {},
    reload: async () => {},
  });
  assert.equal(w.document.querySelectorAll(".dispatch-job").length, 3);
  w.document.querySelector('[data-order="job2"][data-delta="-1"]').click();
  assert.equal(w.MowDispatchDirty, true);
  w.document.querySelector('[data-publish="crew1"]').click();
  await new Promise((r) => setTimeout(r, 0));
  const published = calls.find((c) => c.action === "dispatch-change");
  assert.deepEqual(
    Array.from(published.body.jobs, (j) => j.id),
    ["job2", "job1", "job3"],
  );
  assert(published.body.time_zone);
  assert.equal(w.MowDispatchDirty, false);
  w.document.querySelector('[data-move="job1"]').click();
  assert.equal(w.document.querySelector("#dialog").open, true);
  assert.match(
    w.document.querySelector("#dialog-content").textContent,
    /This visit only/,
  );
  w.eval(
    await readFile(
      new URL("../../office/dist/customer-service.js", import.meta.url),
      "utf8",
    ),
  );
  await w.showCustomerService(
    { company: "company", customer: "customer" },
    w.document.querySelector("#service"),
  );
  assert.match(
    w.document.querySelector("#service-today").textContent,
    /two stops away/,
  );
  assert.equal(
    w.document.querySelector("#service-today a").hash,
    "#care-options",
  );
  console.log(
    "PASS DOM: crew columns, reorder draft/publish, time zone, move confirmation and homeowner service/care navigation",
  );
  dom.window.close();
});
