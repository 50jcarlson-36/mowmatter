import { calculateQuote } from "./pricing-engine.mjs";
import {
  validateLabor,
  estimateLabor,
  loadedHourlyCents,
} from "./labor-engine.mjs";
import { setupSuggestions, applyConfiguration } from "./setup-engine.mjs";
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const money = (c) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    c / 100,
  );
const $ = (id) => document.getElementById(id);
const methods = ["fixed", "area", "hourly", "unit", "inspection"];
const labels = {
  fixed: "Flat visit price",
  area: "Per 1,000 lawn sq ft",
  hourly: "Hourly",
  unit: "Per unit",
  inspection: "Owner inspection",
  bands: "Existing lawn-size bands",
};
const numeric = (id, label, value, step = "1") =>
  `<label>${label}<input id="${id}" type="number" min="0" step="${step}" value="${value}" inputmode="decimal" required></label>`;
const initialLabor = () => ({
  people: [
    {
      id: "owner",
      name: "Owner",
      role: "Owner / field operator",
      payBasis: "owner",
      hourlyCents: 0,
      burdenBps: 0,
      benefitsHourlyCents: 0,
      weeklyHours: 40,
    },
  ],
  crews: [{ id: "crew-1", name: "My first crew", personIds: ["owner"] }],
});
export function mountSetupWizard({ getCatalog, onApply }) {
  const dialog = $("setup-dialog");
  let step = 0,
    base,
    draft,
    labor,
    crewId,
    ai = null,
    pending = false,
    aborter;
  let inputs = {
    city: "",
    minutes: 45,
    travelMinutes: 15,
    areaSqft: 5000,
    otherCostCents: 0,
    targetMarginPercent: 30,
  };
  let changes;
  const steps = [
    "Your business",
    "Personnel & crews",
    "Costs & rates",
    "Your package",
    "Review quote",
  ];
  function costing() {
    return estimateLabor(labor, crewId, {
      onsiteMinutes: inputs.minutes,
      travelMinutes: inputs.travelMinutes,
      otherCostCents: inputs.otherCostCents,
    });
  }
  function profile() {
    const c = costing();
    return {
      city: inputs.city,
      workers: c.lines.length,
      crewHourlyCostCents: c.crewHourlyCents,
      visitCostCents: c.totalCostCents,
      minutes: inputs.minutes,
      areaSqft: inputs.areaSqft,
      targetMarginPercent: inputs.targetMarginPercent,
    };
  }
  function error(e) {
    $("setup-error").textContent = e?.message || String(e);
  }
  function render() {
    $("setup-error").textContent = "";
    $("setup-progress").innerHTML = steps
      .map(
        (s, i) =>
          `<span class="${i === step ? "current" : ""}" ${i === step ? 'aria-current="step"' : ""}>${i + 1}. ${s}</span>`,
      )
      .join("");
    $("setup-back").hidden = step === 0;
    $("setup-next").textContent =
      step === 4 ? "Apply reviewed browser draft" : "Continue →";
    if (step === 0)
      $("setup-body").innerHTML =
        `<h3>Start with how you actually work.</h3><p>Keep your existing services and rates, then configure your labor and a useful package.</p><div class="form-grid"><label class="wide">City / service market<input id="setup-city" value="${esc(inputs.city)}" maxlength="100" placeholder="Palm Coast, FL"></label></div><p class="notice">No customer lists, employee names or individual pay rates are sent to AI. AI can receive your city, service names and aggregate cost assumptions only after you request suggestions.</p><ul>${base.services.map((s) => `<li>${esc(s.name)} · ${esc(labels[s.mode])}</li>`).join("")}</ul><p class="hint">Add or remove services on the main pricing page. This wizard preserves services and packages it does not explicitly update.</p>`;
    if (step === 1) renderLabor();
    if (step === 2) renderRates();
    if (step === 3) renderPackage();
    if (step === 4) renderReview();
    $("setup-body")
      .querySelector("input,select,button")
      ?.focus({ preventScroll: true });
    dialog.scrollTop = 0;
  }
  function renderLabor() {
    $("setup-body").innerHTML =
      `<h3>Account for every person doing the work.</h3><p>Wages, labor burden and benefits are costs. Your customer-facing hourly rate is a separate price.</p><p class="hint">Enter your actual costs. Owner field time uses an opportunity-cost estimate; this tool does not calculate payroll, withholding or worker classification.</p>${labor.people
        .map(
          (p) =>
            `<article class="person-card" data-person="${esc(p.id)}"><div class="item-head"><h3>${esc(p.name)}</h3><button type="button" class="remove" data-remove-person>Remove</button></div><div class="form-grid"><label>Name / planning label<input data-person-field="name" value="${esc(p.name)}" maxlength="80"></label><label>Job role<input data-person-field="role" value="${esc(p.role)}" maxlength="80"></label><label>Cost basis<select data-person-field="payBasis">${[
              ["owner", "Owner field-time estimate"],
              ["hourly", "Hourly wage cost"],
              ["salary", "Annual salary allocation"],
            ]
              .map(
                ([v, l]) =>
                  `<option value="${v}" ${p.payBasis === v ? "selected" : ""}>${l}</option>`,
              )
              .join(
                "",
              )}</select></label><label>Hourly wage / owner cost ($)<input data-person-field="hourlyCents" type="number" min="0" step="0.01" value="${(p.hourlyCents || 0) / 100}" inputmode="decimal"></label><label>Annual salary ($; salary basis only)<input data-person-field="annualSalaryCents" type="number" min="0" step="0.01" value="${(p.annualSalaryCents || 0) / 100}" inputmode="decimal"></label><label>Annual paid hours (salary basis only)<input data-person-field="annualPaidHours" type="number" min="1" max="8760" value="${p.annualPaidHours || 2080}" inputmode="numeric"></label><label>Employer burden assumption (%)<input data-person-field="burdenBps" type="number" min="0" max="100" step="0.01" value="${(p.burdenBps || 0) / 100}" inputmode="decimal"></label><label>Benefits / insurance cost ($ per hour)<input data-person-field="benefitsHourlyCents" type="number" min="0" step="0.01" value="${(p.benefitsHourlyCents || 0) / 100}" inputmode="decimal"></label><label>Available hours per week<input data-person-field="weeklyHours" type="number" min="0" max="168" value="${p.weeklyHours}" inputmode="numeric"></label></div></article>`,
        )
        .join(
          "",
        )}<button type="button" id="add-person" class="button secondary">+ Add person</button><h3 style="margin-top:24px">Build crews from your personnel.</h3>${labor.crews.map((c) => `<fieldset class="person-card" data-crew="${esc(c.id)}"><legend>${esc(c.name)}</legend><label>Crew name<input data-crew-name value="${esc(c.name)}" maxlength="80"></label><div class="included">${labor.people.map((p) => `<label><input type="checkbox" data-crew-person="${esc(p.id)}" ${c.personIds.includes(p.id) ? "checked" : ""}>${esc(p.name)}</label>`).join("")}</div></fieldset>`).join("")}<button type="button" id="add-crew" class="button secondary">+ Add crew</button><p class="hint">A person may be listed on more than one planning crew. Production scheduling must check for overlapping assignments and time off.</p>`;
    $("add-person").onclick = () => {
      capture();
      labor.people.push({
        id: crypto.randomUUID(),
        name: "New worker",
        role: "Crew member",
        payBasis: "hourly",
        hourlyCents: 0,
        burdenBps: 0,
        benefitsHourlyCents: 0,
        weeklyHours: 40,
      });
      render();
    };
    $("add-crew").onclick = () => {
      capture();
      labor.crews.push({
        id: crypto.randomUUID(),
        name: "New crew",
        personIds: [labor.people[0].id],
      });
      render();
    };
    $("setup-body")
      .querySelectorAll("[data-remove-person]")
      .forEach(
        (button) =>
          (button.onclick = () => {
            capture();
            const id = button.closest("[data-person]").dataset.person;
            if (labor.people.length === 1) {
              error("Keep at least one person.");
              return;
            }
            labor.people = labor.people.filter((p) => p.id !== id);
            labor.crews.forEach(
              (c) => (c.personIds = c.personIds.filter((v) => v !== id)),
            );
            render();
          }),
      );
  }
  function renderRates() {
    const c = costing();
    const suggestions = setupSuggestions(profile(), base);
    $("setup-body").innerHTML =
      `<h3>Turn crew costs into informed prices.</h3><div class="form-grid"><label class="wide">Crew used for this sample<select id="setup-crew">${labor.crews.map((c) => `<option value="${esc(c.id)}" ${c.id === crewId ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></label>${numeric("setup-minutes", "On-site minutes", inputs.minutes)}${numeric("setup-travel", "Allocated travel minutes", inputs.travelMinutes)}${numeric("setup-area", "Confirmed sample lawn sq ft", inputs.areaSqft)}${numeric("setup-other", "Fuel, materials and allocated overhead ($ per visit)", inputs.otherCostCents / 100, "0.01")}${numeric("setup-margin", "Target contribution before platform / processor fees (%)", inputs.targetMarginPercent)}${numeric("setup-minimum", "Company minimum visit price ($)", changes.visitMinimumCents / 100, "0.01")}</div><div class="labor-result"><p><strong>${money(c.crewHourlyCents)} loaded crew cost / hour</strong> · ${c.lines.length} people</p><p>${inputs.minutes} minutes on site = ${c.workerMinutes} worker-minutes. Travel adds ${c.travelWorkerMinutes} worker-minutes.</p><p>Estimated total job costs: <strong>${money(c.totalCostCents)}</strong></p><p class="hint">Cost-based visit-price reference: ${money(suggestions.visitMinimumCents)}. A planning reference, not a local market price or guaranteed profit.</p></div><button type="button" id="recalculate-cost" class="button secondary">Update cost reference</button><div class="ai-panel"><h3>Ask AI for setup suggestions</h3><p>Suggest suitable pricing methods and configuration checks. Your rates stay under your control.</p><button type="button" id="ask-setup-ai" class="button secondary" ${pending ? "disabled" : ""}>${pending ? "Getting suggestions…" : "Get AI suggestions"}</button><p class="hint">Requires an Office owner session and the configured AI service. The standard setup works without AI.</p><div id="ai-results"></div></div>${changes.services.map((s) => `<article class="service" data-rate="${esc(s.id)}"><h3>${esc(base.services.find((v) => v.id === s.id).name)}</h3><div class="form-grid"><label>Pricing method<select data-rate-field="mode">${[...methods, ...(s.mode === "bands" ? ["bands"] : [])].map((m) => `<option value="${m}" ${s.mode === m ? "selected" : ""}>${esc(labels[m])}</option>`).join("")}</select></label><label>Rate ($; according to selected method)<input type="number" min="0" step="0.01" data-rate-field="priceCents" value="${s.priceCents / 100}" inputmode="decimal"></label><label>Service minimum ($)<input type="number" min="0" step="0.01" data-rate-field="minimumCents" value="${s.minimumCents / 100}" inputmode="decimal"></label><label>Hourly basis (hourly services only)<select data-rate-field="hourBasis"><option value="crew" ${s.hourBasis === "crew" ? "selected" : ""}>Per crew-hour</option><option value="worker" ${s.hourBasis === "worker" ? "selected" : ""}>Per worker-hour</option></select></label></div><p class="hint">${esc(s.mode === "bands" ? "Existing bands are preserved. Edit their limits on the main page." : suggestions.recommendations.find((r) => r.serviceId === s.id)?.reason)}</p></article>`).join("")}`;
    $("recalculate-cost").onclick = () => {
      try {
        capture();
        render();
      } catch (e) {
        error(e);
      }
    };
    $("ask-setup-ai").onclick = askAI;
    renderAI();
  }
  function renderAI() {
    const node = $("ai-results");
    if (!node || !ai) return;
    node.innerHTML = `<p><strong>${esc(ai.summary)}</strong></p>${ai.recommendations.map((r) => `<div class="ai-result"><p><strong>${esc(base.services.find((s) => s.id === r.serviceId)?.name || "Service")}: ${esc(labels[r.mode])}</strong></p><p>${esc(r.reason)}</p><button type="button" class="button secondary" data-ai-service="${esc(r.serviceId)}">Use this method in draft</button></div>`).join("")}<ul>${ai.checklist.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>`;
    node.querySelectorAll("[data-ai-service]").forEach(
      (b) =>
        (b.onclick = () => {
          capture();
          const r = ai.recommendations.find(
            (r) => r.serviceId === b.dataset.aiService,
          );
          const s = changes.services.find((s) => s.id === r.serviceId);
          if (s.mode !== r.mode) s.priceCents = 0;
          s.mode = r.mode;
          s.hourBasis = r.hourBasis;
          render();
          error(
            "Review the rate for the selected method. A different rate basis needs a new price.",
          );
        }),
    );
  }
  async function askAI() {
    try {
      capture();
      if (!window.MM)
        throw Error(
          "Open this preview on the Office host and sign in to request AI suggestions.",
        );
      const session = await MM.ensureSession();
      pending = true;
      $("ask-setup-ai").disabled = true;
      $("ask-setup-ai").textContent = "Getting suggestions…";
      aborter = new AbortController();
      const timer = setTimeout(() => aborter.abort(), 30000);
      let response;
      try {
        response = await fetch(
          (window.MM_PROPERTY_API || "") + "/api/setup/suggest",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer " + session.access_token,
            },
            body: JSON.stringify({
              profile: profile(),
              services: base.services.map(({ id, name, mode }) => ({
                id,
                name,
                mode,
              })),
            }),
            signal: aborter.signal,
          },
        );
      } finally {
        clearTimeout(timer);
      }
      const data = await response.json();
      if (!response.ok)
        throw Error(
          data.error ||
            "AI suggestions are unavailable. Continue with your current configuration.",
        );
      ai = data.suggestions;
      renderAI();
    } catch (e) {
      error(
        e.name === "AbortError"
          ? "AI request stopped. You can continue without AI."
          : e,
      );
    } finally {
      pending = false;
      if ($("ask-setup-ai")) {
        $("ask-setup-ai").disabled = false;
        $("ask-setup-ai").textContent = "Get AI suggestions";
      }
    }
  }
  function renderPackage() {
    const p = changes.package;
    $("setup-body").innerHTML =
      `<h3>Make the offer easy to understand.</h3><p>A fixed-price package is a simple starting point. It applies to this approved scope, not every property.</p><div class="form-grid"><label class="wide">Package name<input id="setup-package-name" value="${esc(p.name)}" maxlength="80"></label>${numeric("setup-package-price", "Package price per visit ($)", p.priceCents / 100, "0.01")}<fieldset class="wide"><legend>Included services</legend><div class="included">${base.services.map((s) => `<label><input type="checkbox" data-package-include="${esc(s.id)}" ${p.serviceIds.includes(s.id) ? "checked" : ""}>${esc(s.name)}</label>`).join("")}</div></fieldset></div><ul><li>Use separate estimates for one-time cleanup and recurring care.</li><li>Confirm lawn area, access, overgrowth and service boundaries.</li><li>Included services cannot also be charged as add-ons.</li></ul>`;
  }
  function renderReview() {
    draft = applyConfiguration(base, changes, true);
    const c = costing();
    const q = calculateQuote(draft, {
      packageId: changes.package.id,
      serviceIds: [],
      inputs: {
        areaConfirmed: true,
        areaSqft: inputs.areaSqft,
        minutes: inputs.minutes,
        workers: c.lines.length,
      },
      visitsPerYear: 26,
      estimatedCostCents: c.totalCostCents,
    });
    $("setup-body").innerHTML =
      `<h3>Check the numbers before applying.</h3><div class="quote-total"><span>${esc(changes.package.name)}</span><strong>${money(q.perVisitCents)}</strong><span>per visit · every 2 weeks · 26 planned annual visits</span></div><div class="wizard-review"><p>${esc(labor.crews.find((c) => c.id === crewId).name)} · ${c.lines.length} personnel · ${inputs.minutes} crew minutes / ${c.workerMinutes} worker-minutes</p><p>Estimated labor + travel + other job costs: <strong>${money(c.totalCostCents)}</strong></p><p>Estimated contribution after Free-plan platform fee: <strong>${money(q.ownerOnly.contributionCents)}</strong>. Processor fees and tax are not included in this wizard example.</p></div><ul><li>This configuration is a browser draft, not a published catalog.</li><li>Existing accepted customer agreements remain separate.</li><li>Rates, costs, availability and package eligibility require owner review.</li><li>Personnel compensation stays internal; Crew and homeowners should not receive it.</li></ul><label class="check"><input id="setup-approved" type="checkbox">I reviewed these rates, labor assumptions and package scope. Apply them to this browser draft.</label>`;
  }
  function capture() {
    if (step === 0) inputs.city = $("setup-city").value.trim();
    if (step === 1) {
      $("setup-body")
        .querySelectorAll("[data-person]")
        .forEach((node) => {
          const p = labor.people.find((p) => p.id === node.dataset.person);
          node.querySelectorAll("[data-person-field]").forEach((el) => {
            const f = el.dataset.personField;
            p[f] = ["name", "role", "payBasis"].includes(f)
              ? el.value.trim()
              : f.endsWith("Cents") || f === "burdenBps"
                ? Math.round(Number(el.value) * 100)
                : Number(el.value);
          });
        });
      $("setup-body")
        .querySelectorAll("[data-crew]")
        .forEach((node) => {
          const c = labor.crews.find((c) => c.id === node.dataset.crew);
          c.name = node.querySelector("[data-crew-name]").value.trim();
          c.personIds = [
            ...node.querySelectorAll("[data-crew-person]:checked"),
          ].map((el) => el.dataset.crewPerson);
        });
    }
    if (step === 2) {
      crewId = $("setup-crew").value;
      inputs.minutes = Number($("setup-minutes").value);
      inputs.travelMinutes = Number($("setup-travel").value);
      inputs.areaSqft = Number($("setup-area").value);
      inputs.otherCostCents = Math.round(Number($("setup-other").value) * 100);
      inputs.targetMarginPercent = Number($("setup-margin").value);
      changes.visitMinimumCents = Math.round(
        Number($("setup-minimum").value) * 100,
      );
      $("setup-body")
        .querySelectorAll("[data-rate]")
        .forEach((node) => {
          const s = changes.services.find((s) => s.id === node.dataset.rate);
          node
            .querySelectorAll("[data-rate-field]")
            .forEach(
              (el) =>
                (s[el.dataset.rateField] = el.dataset.rateField.endsWith(
                  "Cents",
                )
                  ? Math.round(Number(el.value) * 100)
                  : el.value),
            );
        });
      profile();
      setupSuggestions(profile(), base);
    }
    if (step === 3) {
      changes.package.name = $("setup-package-name").value.trim();
      changes.package.priceCents = Math.round(
        Number($("setup-package-price").value) * 100,
      );
      changes.package.serviceIds = [
        ...$("setup-body").querySelectorAll("[data-package-include]:checked"),
      ].map((el) => el.dataset.packageInclude);
      applyConfiguration(base, changes, true);
    }
  }
  $("start-setup").onclick = () => {
    base = structuredClone(getCatalog());
    changes = {
      visitMinimumCents: base.visitMinimumCents,
      services: base.services.map((s) => ({
        id: s.id,
        mode: s.mode,
        priceCents: s.priceCents || 0,
        minimumCents: s.minimumCents || 0,
        hourBasis: s.hourBasis || "crew",
      })),
      package: {
        id: "guided-care",
        name: "My recurring lawn care",
        mode: "fixed",
        priceCents: 5000,
        serviceIds: base.services
          .filter((s) => ["mowing", "trimming", "edging"].includes(s.id))
          .map((s) => s.id),
      },
    };
    if (base.packages.some((p) => p.id === "guided-care"))
      changes.package = structuredClone(
        base.packages.find((p) => p.id === "guided-care"),
      );
    if (!changes.package.serviceIds.length)
      changes.package.serviceIds = [base.services[0].id];
    try {
      labor = validateLabor(
        JSON.parse(localStorage.getItem("mm-labor-preview-v1")),
      );
    } catch {
      labor = initialLabor();
    }
    crewId = labor.crews[0]?.id;
    step = 0;
    ai = null;
    dialog.showModal();
    render();
  };
  $("close-setup").onclick = () => dialog.close();
  dialog.addEventListener("close", () => {
    aborter?.abort();
    $("start-setup").focus();
  });
  $("setup-body").addEventListener("change", (event) => {
    if (step !== 2 || event.target.dataset.rateField !== "mode") return;
    try {
      const id = event.target.closest("[data-rate]").dataset.rate;
      capture();
      changes.services.find((s) => s.id === id).priceCents = 0;
      render();
      error("Enter a new rate for this pricing method before applying.");
    } catch (e) {
      error(e);
    }
  });
  $("setup-back").onclick = () => {
    if (pending) {
      error("Wait for suggestions or close setup to cancel.");
      return;
    }
    try {
      capture();
      step--;
      render();
    } catch (e) {
      error(e);
    }
  };
  $("setup-next").onclick = () => {
    if (pending) {
      error("Wait for suggestions or close setup to cancel.");
      return;
    }
    try {
      capture();
      if (step === 1) {
        validateLabor(labor);
        crewId = labor.crews[0].id;
      }
      if (step === 4) {
        if (!$("setup-approved").checked)
          throw Error("Review and approve the configuration first.");
        const cost = costing();
        if (
          changes.services.some(
            (s) =>
              !["inspection", "bands"].includes(s.mode) && s.priceCents <= 0,
          )
        )
          throw Error(
            "Enter a positive rate for each priced service before applying.",
          );
        if (!cost.crewHourlyCents)
          throw Error("Enter labor costs before applying this setup.");
        onApply(applyConfiguration(base, changes, true), labor, {
          minutes: inputs.minutes,
          workers: cost.lines.length,
          areaSqft: inputs.areaSqft,
          costCents: cost.totalCostCents,
          packageId: changes.package.id,
        });
        dialog.close();
      } else {
        step++;
        render();
      }
    } catch (e) {
      error(e);
    }
  };
}
