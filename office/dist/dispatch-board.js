(() => {
  "use strict";
  const esc = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const today = () =>
    new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 10);
  let timeZone =
    Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York";
  let day = today(),
    mode = "day",
    drafts = new Map();
  async function api(action, body) {
    return window.MowCommerce.request(action, body);
  }
  window.showDispatchBoard = async (data, { edit, details, reload }) => {
    const root = document.getElementById("dispatch-board");
    if (!root) return;
    const scope = { company_id: data.company.id };
    let capabilities = { available: false };
    let state = { routes: [], notices: [] },
      error = "";
    try {
      state = await api("dispatch-status", scope);
      capabilities = await api("route-capabilities", scope).catch(() => ({
        available: false,
      }));
    } catch (e) {
      error = e.message;
    }
    if (!root.isConnected) return;
    const legacy = document.getElementById("legacy-visits");
    if (legacy) legacy.hidden = !error;
    if (error) {
      root.innerHTML = `<section class="card"><h2>Dispatch board setup pending</h2><p>Your existing visit list below remains available. The published-route database needs activation before moving cards and sending approach notices.</p></section>`;
      return;
    }
    const active = data.jobs.filter(
      (j) => !j.cancelled_at && j.status !== "completed",
    );
    const sort = (a, b) =>
      (a.route_position ?? 1e9) - (b.route_position ?? 1e9) ||
      a.scheduled_time.localeCompare(b.scheduled_time) ||
      a.id.localeCompare(b.id);
    function list(crew, date) {
      const key = crew + ":" + date;
      const jobs = active
        .filter((j) => j.assigned_to === crew && j.service_date === date)
        .sort(sort);
      const order = drafts.get(key);
      return order
        ? jobs.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))
        : jobs;
    }
    function render() {
      const dates = Array.from({ length: mode === "week" ? 7 : 1 }, (_, i) => {
        const d = new Date(day + "T12:00:00Z");
        d.setUTCDate(d.getUTCDate() + i);
        return d.toISOString().slice(0, 10);
      });
      const columns =
        mode === "day"
          ? data.members.map((m) => ({
              id: m.user_id,
              date: day,
              label: m.display_name,
            }))
          : dates.map((date) => ({
              id: null,
              date,
              label: new Date(date + "T12:00:00Z").toLocaleDateString(
                undefined,
                {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  timeZone: "UTC",
                },
              ),
            }));
      root.innerHTML = `<section class="card"><div class="section-head"><h2>Your dispatch board</h2><button class="button primary" id="dispatch-new-job">+ One-time visit</button><a class="button" href="operations.html">Weather &amp; care suggestions</a></div><div class="actions"><label>Business time zone <select id="dispatch-zone">${[...new Set([timeZone, "America/New_York", "America/Chicago", "America/Denver", "America/Phoenix", "America/Los_Angeles", "Pacific/Honolulu", "America/Anchorage"])].map((zone) => `<option value="${esc(zone)}" ${zone === timeZone ? "selected" : ""}>${esc(zone.replaceAll("_", " "))}</option>`).join("")}</select></label><label>Starting date <input id="dispatch-day" type="date" value="${esc(day)}"></label><button class="button" data-mode="day" aria-pressed="${mode === "day"}">Crews today</button><button class="button" data-mode="week" aria-pressed="${mode === "week"}">Next 7 days</button></div><p class="help">${capabilities.available ? "Route planner: Google Maps road estimates · up to 12 stops per crew." : "Road route planning is awaiting provider activation. Manual dispatch is available."}</p><p class="help">Drag pending cards between columns, or use Move. Reorder with the arrows, then publish the remaining route. Customer date/time changes queue an opted-in SMS. Moves affect this visit only.</p><p role="status" id="dispatch-status">${esc(error)}</p><div class="dispatch-columns">${columns
        .map((c) => {
          const jobs = c.id
            ? list(c.id, c.date)
            : active.filter((j) => j.service_date === c.date).sort(sort);
          const minutes = jobs.reduce(
              (n, j) => n + (j.planned_minutes || 30),
              0,
            ),
            published =
              c.id &&
              state.routes.some(
                (r) => r.crew_id === c.id && r.service_date === c.date,
              ),
            dirty = c.id && drafts.has(c.id + ":" + c.date);
          return `<section class="dispatch-column" data-crew="${esc(c.id || "")}" data-day="${c.date}" aria-label="${esc(c.label)}"><h3>${esc(c.label)}</h3><p class="help">${jobs.length} stops · ${minutes} service minutes (travel excluded)${minutes > 480 ? " · Over 8 service hours" : ""}</p>${c.id ? `<span class="pill">${dirty ? "Unpublished order" : published ? "Published route" : "Needs publishing"}</span><button class="button" data-optimize="${esc(c.id)}" ${!capabilities.available || jobs.length < 2 || jobs.length > 12 || jobs.some((j) => j.status !== "scheduled") ? "disabled" : ""}>Optimize route</button><button class="button" data-publish="${esc(c.id)}" ${!jobs.length ? "disabled" : ""}>Publish route</button>` : ""}${
            jobs
              .map(
                (j, index) =>
                  `<article class="dispatch-job" data-id="${esc(j.id)}" draggable="${["scheduled", "blocked"].includes(j.status)}"><strong>${esc(j.address)}</strong><p>${esc(j.customer_name)} · ${esc(j.scheduled_time.slice(0, 5))}</p><p>${esc(j.services.join(" · "))}</p><span class="pill">${esc(j.status.replaceAll("_", " "))}</span><div class="actions"><button class="button" data-detail="${esc(j.id)}">Details</button>${["scheduled", "blocked"].includes(j.status) ? `<button class="button" data-move="${esc(j.id)}">Move</button><button class="button" data-edit="${esc(j.id)}">Edit / Cancel</button>${c.id ? `<button class="button" data-order="${esc(j.id)}" data-delta="-1" aria-label="Move ${esc(j.address)} earlier" ${index === 0 ? "disabled" : ""}>↑</button><button class="button" data-order="${esc(j.id)}" data-delta="1" aria-label="Move ${esc(j.address)} later" ${index === jobs.length - 1 ? "disabled" : ""}>↓</button>` : ""}` : ""}</div>${state.notices
                    .filter((n) => n.job_id === j.id)
                    .slice(0, 2)
                    .map(
                      (n) =>
                        `<small>${esc(n.kind)} notice: ${esc(n.status)}</small>`,
                    )
                    .join("")}</article>`,
              )
              .join("") || "<p>No pending visits.</p>"
          }</section>`;
        })
        .join(
          "",
        )}</div><p class="help">Arrival notices use published stops and confirmed crew progress. They do not promise a GPS ETA. Uncertain SMS sends stay flagged for review.</p></section>`;
      root.querySelector("#dispatch-new-job").onclick = () => edit();
      root.querySelector("#dispatch-zone").onchange = (e) => {
        timeZone = e.target.value;
      };
      root.querySelector("#dispatch-day").onchange = (e) => {
        day = e.target.value || today();
        render();
      };
      root.querySelectorAll("[data-mode]").forEach(
        (b) =>
          (b.onclick = () => {
            mode = b.dataset.mode;
            render();
          }),
      );
      root
        .querySelectorAll("[data-detail],[data-edit]")
        .forEach(
          (b) =>
            (b.onclick = () =>
              details(
                data.jobs.find(
                  (j) => j.id === (b.dataset.detail || b.dataset.edit),
                ),
              )),
        );
      root
        .querySelectorAll("[data-move]")
        .forEach(
          (b) =>
            (b.onclick = () =>
              move(data.jobs.find((j) => j.id === b.dataset.move))),
        );
      root.querySelectorAll("[data-order]").forEach(
        (b) =>
          (b.onclick = () => {
            const j = data.jobs.find((j) => j.id === b.dataset.order),
              jobs = list(j.assigned_to, j.service_date),
              i = jobs.findIndex((x) => x.id === j.id),
              to = i + Number(b.dataset.delta);
            if (to < 0 || to >= jobs.length) return;
            if (["arrived", "in_progress"].includes(jobs[to].status)) {
              root.querySelector("#dispatch-status").textContent =
                "Work underway stays first.";
              return;
            }
            [jobs[i], jobs[to]] = [jobs[to], jobs[i]];
            drafts.set(
              j.assigned_to + ":" + j.service_date,
              jobs.map((x) => x.id),
            );
            window.MowDispatchDirty = true;
            render();
          }),
      );
      root
        .querySelectorAll("[data-optimize]")
        .forEach((b) => (b.onclick = () => optimize(b.dataset.optimize)));
      root.querySelectorAll("[data-publish]").forEach(
        (b) =>
          (b.onclick = async () => {
            b.disabled = true;
            try {
              await api("dispatch-change", {
                ...scope,
                command: "publish",
                time_zone: timeZone,
                crew_id: b.dataset.publish,
                service_date: day,
                jobs: list(b.dataset.publish, day).map((j) => ({
                  id: j.id,
                  updated_at: j.updated_at,
                })),
              });
              drafts.delete(b.dataset.publish + ":" + day);
              window.MowDispatchDirty = drafts.size > 0;
              await reload();
            } catch (e) {
              root.querySelector("#dispatch-status").textContent = e.message;
              b.disabled = false;
            }
          }),
      );
      root.querySelectorAll(".dispatch-job").forEach((card) => {
        card.ondragstart = (e) =>
          e.dataTransfer.setData("text/plain", card.dataset.id);
      });
      root.querySelectorAll(".dispatch-column").forEach((col) => {
        col.ondragover = (e) => e.preventDefault();
        col.ondrop = (e) => {
          e.preventDefault();
          const j = data.jobs.find(
            (x) => x.id === e.dataTransfer.getData("text/plain"),
          );
          if (j && ["scheduled", "blocked"].includes(j.status))
            move(j, {
              crew: col.dataset.crew || j.assigned_to,
              date: col.dataset.day,
            });
        };
      });
    }
    function optimize(crew) {
      const dialog = document.getElementById("dialog"),
        content = document.getElementById("dialog-content"),
        routeDay = day;
      const jobs = list(crew, routeDay);
      content.innerHTML = `<h2>Plan this crew’s route</h2><p>${esc(routeDay)} · ${esc(timeZone)}</p><form id="route-plan" class="form"><label>Start and return address<input name="depot" required minlength="10" maxlength="300" autocomplete="street-address" placeholder="Street, city, state, ZIP"></label><div class="route-plan-hours"><label>Depart at<input name="start_time" type="time" required value="08:00"></label><label>Return by<input name="end_time" type="time" required value="17:00"></label></div><fieldset><legend>Which visits have flexible arrival times?</legend><p>Leave confirmed appointments unchecked. Only select visits whose timing you may change. All visits must fit, including travel, service and return to base.</p>${jobs.map((j) => `<label class="route-plan-choice"><input type="checkbox" name="flexible_ids" value="${esc(j.id)}"><span>${esc(j.address)}<small>${esc(j.scheduled_time.slice(0, 5))} · ${j.planned_minutes || 30} service minutes</small></span></label>`).join("")}</fieldset><p>Addresses are sent to Google Maps to estimate road travel. <a href="https://maps.google.com/help/terms_maps/" target="_blank" rel="noopener">Google Maps terms</a> · <a href="https://policies.google.com/privacy" target="_blank" rel="noopener">Google privacy policy</a>. Live traffic, weather, breaks and trailer restrictions are not included. Each stop includes a 5-minute buffer. Allow time for breaks when choosing your workday.</p><p role="status"></p><button class="button primary">Calculate route</button></form><section id="route-result" aria-live="polite"></section>`;
      dialog.showModal();
      const form = content.querySelector("form"),
        result = content.querySelector("#route-result");
      let proposal = null;
      form.oninput = () => {
        proposal = null;
        result.replaceChildren();
      };
      form.onsubmit = async (e) => {
        e.preventDefault();
        const button = e.submitter;
        button.disabled = true;
        proposal = null;
        result.replaceChildren();
        form.querySelector("[role=status]").textContent =
          "Calculating road travel and checking appointments…";
        const values = new FormData(form);
        // Freeze inputs while the request is running so results match the reviewed constraints.
        for (const el of form.elements) el.disabled = true;
        try {
          const r = await api("route-optimize", {
            ...scope,
            crew_id: crew,
            service_date: routeDay,
            time_zone: timeZone,
            depot: values.get("depot"),
            start_time: values.get("start_time"),
            end_time: values.get("end_time"),
            flexible_ids: values.getAll("flexible_ids"),
          });
          proposal = r.proposal;
          form.querySelector("[role=status]").textContent =
            "Review the full route below. Nothing has changed yet.";
          result.innerHTML = `<h3>Before → proposed route</h3><button type="button" class="button" id="route-revise">Change planning settings</button><div class="route-plan-comparison"><p><strong>Current order</strong><br>${r.before.drive_minutes} drive minutes · ${r.before.miles} miles<br>${r.before.feasible ? "Fits these constraints" : "Does not fit these constraints"}</p><p><strong>Proposed order</strong><br>${r.after.drive_minutes} drive minutes · ${r.after.miles} miles<br>Return by ${esc(r.return_time)}</p></div><p>${r.service_minutes} service minutes · travel estimates by <span class="maps-attribution" translate="no">Google Maps</span></p><ol class="route-plan-stops">${r.jobs.map((j) => `<li><strong>${esc(j.address)}</strong><br>${esc(j.original_time)} → ${esc(j.scheduled_time)} · ${j.flexible ? "Flexible" : "Fixed appointment"}<br><small>${j.drive_minutes} min drive + 5 min buffer · ${j.service_minutes} min service</small></li>`).join("")}</ol><p>${esc(r.notice)}</p><p>Publishing updates crew order and the flexible appointment times shown above. Contact customers about changes; SMS delivery may be disabled. Preview expires in 15 minutes.</p><label class="route-plan-choice"><input id="route-review" type="checkbox"><span>I reviewed the stops, customer agreements, access and breaks.</span></label><p role="status"></p><button type="button" class="button primary" id="route-apply" disabled>Approve &amp; publish route</button>`;
          form.hidden = true;
          result.querySelector("#route-revise").onclick = () => {
            proposal = null;
            form.hidden = false;
            result.replaceChildren();
            form.elements.depot.focus();
          };
          result.scrollIntoView?.({ block: "start" });
          const apply = result.querySelector("#route-apply");
          result.querySelector("#route-review").onchange = (e) =>
            (apply.disabled = !e.target.checked);
          apply.onclick = async () => {
            apply.disabled = true;
            try {
              await api("route-publish", {
                ...scope,
                proposal,
                confirm_review: true,
              });
              drafts.delete(crew + ":" + routeDay);
              window.MowDispatchDirty = drafts.size > 0;
              dialog.close();
              await reload();
            } catch (err) {
              result.querySelector("[role=status]").textContent =
                err.message +
                " If the visit list changed, calculate a fresh route.";
              apply.disabled = false;
            }
          };
        } catch (err) {
          form.querySelector("[role=status]").textContent = err.message;
        } finally {
          for (const el of form.elements) el.disabled = false;
        }
      };
    }
    function move(j, destination = {}) {
      const dialog = document.getElementById("dialog"),
        content = document.getElementById("dialog-content");
      content.innerHTML = `<h2>Move this visit</h2><p>${esc(j.address)}</p><form id="dispatch-move" class="form"><label>Crew<select name="crew_id">${data.members.map((m) => `<option value="${esc(m.user_id)}" ${m.user_id === (destination.crew || j.assigned_to) ? "selected" : ""}>${esc(m.display_name)}</option>`).join("")}</select></label><label>Date<input type="date" name="service_date" required value="${esc(destination.date || j.service_date)}"></label><label>Time<input type="time" name="scheduled_time" required value="${esc(j.scheduled_time.slice(0, 5))}"></label><p>This visit only. Your provider’s agreed arrival time should match this time. Date/time changes queue a notice for opted-in customers; reassigning a crew alone does not.</p><p>Publish the affected routes again after moving.</p><p role="status"></p><button class="button primary">Confirm move</button></form>`;
      dialog.showModal();
      content.querySelector("form").onsubmit = async (e) => {
        e.preventDefault();
        e.submitter.disabled = true;
        try {
          await api("dispatch-change", {
            ...scope,
            command: "move",
            id: j.id,
            expected_updated_at: j.updated_at,
            ...Object.fromEntries(new FormData(e.target)),
          });
          drafts.clear();
          window.MowDispatchDirty = false;
          dialog.close();
          await reload();
        } catch (err) {
          e.target.querySelector("[role=status]").textContent = err.message;
          e.submitter.disabled = false;
        }
      };
    }
    render();
  };
})();
