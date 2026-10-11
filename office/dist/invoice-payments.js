(() => {
  "use strict";
  const base = "https://mowmatter-property.onrender.com/api/billing";
  async function call(action, body) {
    const session = await MM.ensureSession();
    const r = await fetch(base + "/" + action, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + session.access_token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
    const d = await r.json();
    if (!r.ok) throw Error(d.error || "Unable to connect payments");
    return d;
  }
  window.showInvoicePayments = async (
    { company, customer, invoices },
    main,
  ) => {
    const scope = { company_id: company, customer_id: customer };
    const plansTarget = document.createElement("section");
    plansTarget.className = "card";
    main.append(plansTarget);
    void showRecurring(scope, plansTarget);
    try {
      const d = await call("invoice-status", scope);
      for (const invoice of invoices) {
        const view = main.querySelector(`[data-invoice="${invoice.id}"]`);
        if (!view) continue;
        const row = view.closest("li"),
          state =
            d.invoices.find((i) => i.id === invoice.id)?.status || "unpaid";
        const text = document.createElement("small");
        text.textContent =
          state === "void"
            ? "Void — no payment due"
            : state === "paid_external"
              ? "Payment recorded by provider"
              : state === "recurring"
                ? "Billed through your recurring plan — see plan billing below"
                : state === "paid"
                  ? "Paid · confirmed by payment processor"
                  : state === "pending"
                    ? "Payment confirmation pending"
                    : state === "failed"
                      ? "Payment failed — you may retry"
                      : "Payment outstanding";
        row.append(text);
        if (!["paid", "paid_external", "void", "recurring"].includes(state)) {
          const button = document.createElement("button");
          button.className = "button primary";
          button.textContent =
            state === "pending" ? "Check / continue payment" : "Pay securely";
          button.disabled = !d.payments_enabled;
          const status = document.createElement("p");
          status.setAttribute("role", "status");
          row.append(button, status);
          if (!d.payments_enabled)
            status.textContent =
              "Online payment setup is pending. Contact your provider.";
          button.onclick = async () => {
            button.disabled = true;
            try {
              const r = await call("invoice-payment", {
                ...scope,
                invoice_id: invoice.id,
              });
              const url = new URL(r.url);
              if (
                url.protocol !== "https:" ||
                url.hostname !== "checkout.stripe.com"
              )
                throw Error("Unexpected payment destination");
              location.assign(url.href);
            } catch (e) {
              status.textContent = e.message;
              button.disabled = false;
            }
          };
        }
      }
    } catch (e) {
      const notice = document.createElement("p");
      notice.setAttribute("role", "status");
      notice.textContent =
        "Payment status unavailable. Contact your provider before paying again.";
      main.append(notice);
    }
  };
  async function showRecurring(scope, target) {
    try {
      const d = await call("recurring-status", scope);
      target.innerHTML = "<h2>Your recurring payment plan</h2>";
      if (!d.plans.length) {
        target.insertAdjacentHTML(
          "beforeend",
          "<p>Your provider has not offered a recurring payment plan yet.</p>",
        );
        return;
      }
      for (const p of d.plans) {
        const section = document.createElement("article");
        const total = new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
        }).format(p.monthly_cents / 100);
        section.innerHTML =
          '<h3></h3><p data-cadence></p><p data-terms style="white-space:pre-wrap"></p><p data-state></p><form class="form"><label class="check"><input name="confirm_recurring" type="checkbox">I authorize ' +
          total +
          ' each month, starting at checkout and renewing until canceled. Additional work needs separate approval. I can cancel through Manage recurring billing, effective at the end of the paid period.</label><button class="button primary">Authorize recurring payment</button><p role="status"></p></form>';
        section.querySelector("h3").textContent = total + " / month";
        section.querySelector("[data-cadence]").textContent =
          "Service every " +
          p.snapshot.interval_days +
          " days · " +
          p.snapshot.services.join(", ") +
          ". First scheduled service: " + p.snapshot.first_date + ". Fixed monthly billing; the number of visits in a calendar month may vary.";
        section.querySelector("[data-terms]").textContent = p.terms;
        section.querySelector("[data-state]").textContent =
          p.status +
          (p.cancel_at_period_end
            ? " · Cancellation scheduled at paid period end"
            : "");
        const form = section.querySelector("form");
        const existing = p.status !== "proposed";
        if (existing) {
          form.querySelector("label").hidden = true;
          form.querySelector("button").textContent = "Manage recurring billing";
        }
        form.querySelector("button").disabled = !d.payments_enabled;
        form.onsubmit = async (e) => {
          e.preventDefault();
          const button = e.submitter;
          const status = form.querySelector("[role=status]");
          if (!existing && !form.elements.confirm_recurring.checked) {
            status.textContent =
              "Review the amount, terms and monthly authorization first.";
            return;
          }
          button.disabled = true;
          try {
            const r = await call(
              existing ? "recurring-portal" : "recurring-checkout",
              {
                ...scope,
                plan_id: p.plan_id,
                confirm_recurring: form.elements.confirm_recurring.checked,
                notice_version: "2026-10-11",
                expected_monthly_cents: p.monthly_cents,
              },
            );
            const url = new URL(r.url);
            if (
              url.protocol !== "https:" ||
              !["checkout.stripe.com", "billing.stripe.com"].includes(
                url.hostname,
              )
            )
              throw Error("Unexpected payment destination");
            location.assign(url.href);
          } catch (err) {
            status.textContent = err.message;
            button.disabled = false;
          }
        };
        target.append(section);
      }
    } catch (e) {
      target.textContent =
        "Recurring billing unavailable. Contact your provider.";
    }
  }
})();
