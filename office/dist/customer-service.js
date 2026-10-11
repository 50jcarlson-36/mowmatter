(() => {
  "use strict";
  const esc = (v) =>
    String(v ?? "").replace(
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
  window.showCustomerService = async ({ company, customer }, target) => {
    target.className = "card";
    target.id = "service-today";
    target.style.scrollMarginTop = "100px";
    target.innerHTML =
      '<h2>Your service, at a glance</h2><p role="status">Checking your visit…</p>';
    try {
      const d = await window.MowCommerce.request("service-status", {
        company_id: company,
        customer_id: customer,
      });
      const date = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 10),
        requested = new URLSearchParams(location.search).get("visit");
      const visit =
        d.visits.find((v) => v.id === requested) ||
        d.visits.find((v) => v.date === date) ||
        d.visits
          .filter((v) => v.date >= date && v.status !== "cancelled")
          .sort(
            (a, b) =>
              a.date.localeCompare(b.date) || a.time.localeCompare(b.time),
          )[0];
      if (!visit) {
        target.innerHTML =
          '<h2>Your service, at a glance</h2><p>No upcoming visit found. Ask your provider to arrange your next service.</p><a class="button" href="#request-service">Request service</a>';
        return;
      }
      const title =
        visit.status === "completed"
          ? "Your yard is ready."
          : visit.status === "in_progress"
            ? "Your lawn care is underway."
            : visit.status === "arrived"
              ? "Your crew has arrived."
              : visit.status === "cancelled"
                ? "This visit was cancelled."
                : visit.status === "blocked"
                  ? "Your provider is reviewing this visit."
                  : visit.stops_ahead === 2
                    ? "We're two stops away."
                    : visit.stops_ahead === 1
                      ? "You're next on our route."
                      : "Your lawn care is scheduled.";
      target.innerHTML = `<p class="eyebrow">YOUR SERVICE STATUS</p><h2>${esc(title)}</h2><p>${esc(visit.date)} · ${esc(visit.time.slice(0, 5))} (property local time)</p><p>${visit.stops_ahead === 1 || visit.stops_ahead === 2 ? "Please unlock your gate and bring pets inside. Stop order can change; this is not a guaranteed arrival time." : "See your service details below, or contact your provider if you need a change."}</p><div class="actions"><a class="button primary" href="#care-options">Review care options</a><a class="button" href="#request-service">Request a change</a><button class="button" data-refresh-service>Refresh status</button></div><small>Updated ${esc(new Date(d.updated_at).toLocaleTimeString())}. Your original bill is separate from optional work.</small>`;
      target.querySelector("[data-refresh-service]").onclick = () =>
        window.showCustomerService({ company, customer }, target);
      if (location.hash === "#service-today")
        target.scrollIntoView({ block: "start" });
    } catch (e) {
      target.innerHTML =
        '<h2>Your service status</h2><p role="status"></p><a href="#request-service">Contact your provider about your visit →</a>';
      target.querySelector("p").textContent = e.message;
    }
  };
})();
