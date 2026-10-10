import {
  calculateQuote,
  homeownerQuote,
  validateCatalog,
} from "./pricing-engine.mjs";
import { mountSetupWizard } from "./setup-wizard.mjs";
const $ = (id) => document.getElementById(id);
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
const money = (cents) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    cents / 100,
  );
const dollarsToCents = (value) => Math.round(Number(value) * 100);
const key = "mm-services-preview-v1";
const starter = {
  version: 1,
  visitMinimumCents: 4500,
  services: [
    {
      id: "mowing",
      name: "Mowing",
      mode: "area",
      priceCents: 800,
      minimumCents: 3500,
    },
    {
      id: "trimming",
      name: "String trimming",
      mode: "fixed",
      priceCents: 1000,
      minimumCents: 0,
    },
    {
      id: "edging",
      name: "Edging",
      mode: "fixed",
      priceCents: 1000,
      minimumCents: 0,
    },
    {
      id: "weeding",
      name: "Bed weeding",
      mode: "hourly",
      hourBasis: "worker",
      priceCents: 5000,
      minimumCents: 1500,
    },
    {
      id: "shrubs",
      name: "Shrub trimming",
      mode: "unit",
      unitLabel: "shrubs",
      priceCents: 1500,
      minimumCents: 0,
    },
    {
      id: "cleanup",
      name: "Yard cleanup",
      mode: "hourly",
      hourBasis: "crew",
      priceCents: 9000,
      minimumCents: 6000,
    },
  ],
  packages: [
    {
      id: "essential",
      name: "Essential lawn care",
      mode: "fixed",
      priceCents: 5000,
      serviceIds: ["mowing", "trimming", "edging"],
    },
  ],
};
let catalog = structuredClone(starter);
try {
  const stored = JSON.parse(localStorage.getItem(key));
  if (stored?.schema === 1) catalog = validateCatalog(stored.catalog);
} catch {}
let audience = "customer";
let serial = 0;
let statusTimer;
let lastQuote;
function status(text) {
  $("status").textContent = text;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => ($("status").textContent = ""), 4500);
}
function uid(prefix) {
  return prefix + "-" + Date.now().toString(36) + "-" + ++serial;
}
const methods = [
  ["fixed", "Flat price"],
  ["area", "Per 1,000 sq ft of lawn"],
  ["bands", "Lawn-size bands"],
  ["hourly", "Hourly"],
  ["unit", "Per unit"],
  ["inspection", "Owner inspection required"],
];
const numInput = (attr, value, step = "0.01") =>
  `<input ${attr} type="number" min="0" step="${step}" value="${value}" inputmode="decimal">`;
function serviceFields(s) {
  let fields = `<label>Service name<input data-field="name" value="${escape(s.name)}" maxlength="80"></label><label>Pricing method<select data-field="mode">${methods.map(([v, l]) => `<option value="${v}" ${s.mode === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>`;
  if (!["inspection", "bands"].includes(s.mode))
    fields += `<label>${s.mode === "area" ? "Rate per 1,000 sq ft ($)" : s.mode === "hourly" ? "Hourly rate ($)" : s.mode === "unit" ? "Price per unit ($)" : "Price per visit ($)"}${numInput('data-field="priceCents"', (s.priceCents ?? 0) / 100)}</label>`;
  if (s.mode === "hourly")
    fields += `<label>Hourly basis<select data-field="hourBasis"><option value="worker" ${s.hourBasis === "worker" ? "selected" : ""}>Per worker-hour</option><option value="crew" ${s.hourBasis === "crew" ? "selected" : ""}>Per crew-hour</option></select></label><p class="hint">Worker-hour: rate × hours × workers. Crew-hour: rate × hours, regardless of worker count.</p>`;
  if (s.mode === "unit")
    fields += `<label>Unit name<input data-field="unitLabel" value="${escape(s.unitLabel || "units")}" maxlength="40"></label>`;
  if (s.mode === "bands")
    fields += `<div class="wide"><div class="band-title">Up to lawn area (sq ft) · Price ($)</div><div class="bands">${(s.bands || []).map((b, i) => `<div class="band">${numInput(`data-band="${i}" data-band-field="upToSqft" aria-label="Band ${i + 1} maximum lawn area"`, b.upToSqft, "1")}${numInput(`data-band="${i}" data-band-field="priceCents" aria-label="Band ${i + 1} price"`, b.priceCents / 100)}<button type="button" class="remove" data-delete-band="${i}" aria-label="Remove band ${i + 1}">×</button></div>`).join("")}</div><button type="button" class="button secondary" data-add-band>Add band</button></div>`;
  if (s.mode !== "inspection")
    fields += `<label>Minimum for this service ($)${numInput('data-field="minimumCents"', (s.minimumCents ?? 0) / 100)}</label>`;
  else
    fields += `<p class="hint">No automatic service price. An owner must assess and price this work.</p>`;
  return fields;
}
function renderServices() {
  $("service-list").innerHTML = catalog.services
    .map(
      (s) =>
        `<article class="service" data-service="${escape(s.id)}"><div class="item-head"><h3>${escape(s.name)}</h3><button class="remove" type="button" data-delete-service>Remove</button></div><div class="service-fields">${serviceFields(s)}</div></article>`,
    )
    .join("");
}
function renderPackages() {
  $("package-list").innerHTML = catalog.packages.length
    ? catalog.packages
        .map(
          (p) =>
            `<article class="package" data-package="${escape(p.id)}"><div class="item-head"><h3>${escape(p.name)}</h3><button type="button" class="remove" data-delete-package>Remove</button></div><div class="form-grid"><label>Package name<input data-package-field="name" value="${escape(p.name)}" maxlength="80"></label><label>Package pricing<select data-package-field="mode"><option value="fixed" ${p.mode === "fixed" ? "selected" : ""}>Fixed visit price</option><option value="discount" ${p.mode === "discount" ? "selected" : ""}>Service rates minus discount</option></select></label><label>${p.mode === "fixed" ? "Package price ($)" : "Package discount (%)"}${numInput(`data-package-field="${p.mode === "fixed" ? "priceCents" : "discountBps"}"`, (p.mode === "fixed" ? p.priceCents || 0 : p.discountBps || 0) / 100)}</label><fieldset class="wide"><legend>Included services</legend><div class="included">${catalog.services.map((s) => `<label><input type="checkbox" data-include="${escape(s.id)}" ${(p.serviceIds || []).includes(s.id) ? "checked" : ""}>${escape(s.name)}</label>`).join("")}</div></fieldset></div></article>`,
        )
        .join("")
    : '<p class="hint">No packages yet. Add one, or quote services individually.</p>';
}
function renderOffers() {
  const old = $("offer").value;
  $("offer").innerHTML =
    '<option value="">Build from individual services</option>' +
    catalog.packages
      .map((p) => `<option value="${escape(p.id)}">${escape(p.name)}</option>`)
      .join("");
  if (catalog.packages.some((p) => p.id === old)) $("offer").value = old;
  renderAddons();
}
function renderAddons() {
  const selected = new Map(
    [...$("addons").querySelectorAll("[data-addon]")].map((el) => [
      el.dataset.addon,
      {
        checked: el.checked,
        qty: Number(
          $("addons").querySelector(
            `[data-units="${CSS.escape(el.dataset.addon)}"]`,
          )?.value || 1,
        ),
      },
    ]),
  );
  const included =
    catalog.packages.find((p) => p.id === $("offer").value)?.serviceIds || [];
  $("addons").innerHTML = catalog.services
    .map(
      (s) =>
        `<div class="addon-row"><label class="check"><input type="checkbox" data-addon="${escape(s.id)}" ${included.includes(s.id) ? "disabled checked" : selected.get(s.id)?.checked ? "checked" : ""}>${escape(s.name)}${included.includes(s.id) ? ' <span class="pill">Included</span>' : ""}</label>${s.mode === "unit" ? `<label class="units">${escape(s.unitLabel || "Units")}<input type="number" min="1" max="100000" step="1" data-units="${escape(s.id)}" value="${selected.get(s.id)?.qty || 1}" inputmode="numeric"></label>` : ""}</div>`,
    )
    .join("");
}
function request() {
  const units = {};
  $("addons")
    .querySelectorAll("[data-units]")
    .forEach((el) => (units[el.dataset.units] = Number(el.value)));
  return {
    packageId: $("offer").value || null,
    serviceIds: [
      ...$("addons").querySelectorAll("[data-addon]:checked:not(:disabled)"),
    ].map((el) => el.dataset.addon),
    inputs: {
      areaConfirmed: $("area-confirmed").checked,
      areaSqft: Number($("area").value),
      minutes: Number($("minutes").value),
      workers: Number($("workers").value),
      units,
    },
    visitsPerYear: Number($("frequency").value),
    accessAdjustmentCents: dollarsToCents($("adjustment").value),
    estimatedCostCents: dollarsToCents($("job-cost").value),
    taxBps: Math.round(Number($("tax").value) * 100),
  };
}
function quote() {
  catalog.visitMinimumCents = dollarsToCents($("visit-minimum").value);
  lastQuote = null;
  try {
    const result = calculateQuote(catalog, request(), {
      tier: $("tier").value,
      processingBps: Math.round(Number($("processing-rate").value) * 100),
      processingFixedCents: dollarsToCents($("processing-fixed").value),
    });
    lastQuote = result;
    const publicQuote = homeownerQuote(result);
    const visitLabel =
      result.visitsPerYear === 1
        ? "one-time visit"
        : $("frequency")
            .selectedOptions[0].textContent.split(" · ")[0]
            .toLowerCase();
    $("quote-output").innerHTML =
      `<p class="quote-status">Draft estimate · Owner review required</p><h3>${escape($("property-label").value || "Your lawn care estimate")}</h3><div class="quote-total"><span>${escape(visitLabel)}</span><strong>${money(result.perVisitCents)}</strong><span>per visit${result.taxCents ? " · includes estimated tax" : ""}</span></div>${publicQuote.lines.map((l) => `<div class="quote-line"><div>${escape(l.name)}${l.includedNames ? `<small>Includes ${l.includedNames.map(escape).join(", ")}</small>` : ""}</div><strong>${money(l.amountCents)}</strong></div>`).join("")}<div class="quote-line"><span>Subtotal</span><strong>${money(result.subtotalCents)}</strong></div>${result.taxCents ? `<div class="quote-line"><span>Estimated tax</span><strong>${money(result.taxCents)}</strong></div>` : ""}<p class="hint">${result.visitsPerYear === 1 ? "One visit. No recurring plan." : `${result.visitsPerYear} planned visits per year. Price is per visit. Seasonal schedules and service dates need confirmation.`}</p>${audience === "owner" ? ownerView(result) : ""}<p class="hint">This is an estimate, not a booking or payment request. Confirm scope and access before accepting a final quote.</p>`;
  } catch (error) {
    $("quote-output").innerHTML =
      `<div class="error"><strong>Review needed</strong><p>${escape(error.message)}</p><p class="hint">No price will be shown until these inputs are resolved.</p></div>`;
  }
}
function ownerView(q) {
  const o = q.ownerOnly;
  const rows = [
    ["Annual planning total", q.annualCents],
    ["Monthly average · not a bill", q.monthlyAverageCents],
    ["Package savings", q.packageDiscountCents],
    ["Estimated platform fee / visit", o.platformFeeCents],
    ["Estimated processor fee / visit", o.processingFeeCents],
    ["Estimated job costs / visit", o.estimatedCostCents],
    ["Contribution / visit", o.contributionCents],
  ];
  return `<div class="internal"><p class="eyebrow">OWNER ONLY · ESTIMATES</p>${rows.map(([label, value]) => `<div class="quote-line"><span>${label}</span><strong>${money(value)}</strong></div>`).join("")}<div class="quote-line"><span>Estimated contribution margin</span><strong>${o.contributionMarginPercent === null ? "—" : o.contributionMarginPercent.toFixed(1) + "%"}</strong></div><p class="hint">Contribution is not net profit. Add all labor, travel, fuel, materials and overhead to job costs. Platform fee preview uses service subtotal; confirm the billing fee basis before production.</p></div>`;
}
function save() {
  quote();
  if (!lastQuote) {
    status("Resolve the quote inputs before saving this draft.");
    return;
  }
  try {
    localStorage.setItem(
      key,
      JSON.stringify({ schema: 1, catalog, savedAt: new Date().toISOString() }),
    );
    status("Pricing draft saved on this device. Nothing published.");
  } catch {
    status("Browser storage is unavailable. Export your draft to keep it.");
  }
}
$("service-list").addEventListener("input", (event) => {
  const node = event.target.closest("[data-service]");
  if (!node) return;
  const s = catalog.services.find((s) => s.id === node.dataset.service);
  if (event.target.dataset.field && event.target.dataset.field !== "mode") {
    const field = event.target.dataset.field;
    s[field] = field.endsWith("Cents")
      ? dollarsToCents(event.target.value)
      : event.target.value;
    if (field === "name") {
      node.querySelector("h3").textContent = s.name;
      renderPackages();
      renderOffers();
    }
  }
  if (event.target.dataset.bandField) {
    const field = event.target.dataset.bandField;
    s.bands[Number(event.target.dataset.band)][field] =
      field === "priceCents"
        ? dollarsToCents(event.target.value)
        : Number(event.target.value);
  }
  quote();
});
$("service-list").addEventListener("change", (event) => {
  if (event.target.dataset.field !== "mode") return;
  const s = catalog.services.find(
    (s) => s.id === event.target.closest("[data-service]").dataset.service,
  );
  s.mode = event.target.value;
  s.hourBasis = s.hourBasis || "worker";
  s.unitLabel = s.unitLabel || "units";
  s.bands = s.bands || [
    { upToSqft: 5000, priceCents: 4500 },
    { upToSqft: 10000, priceCents: 6500 },
  ];
  renderServices();
  renderAddons();
  quote();
});
$("service-list").addEventListener("click", (event) => {
  const node = event.target.closest("[data-service]");
  if (!node) return;
  const s = catalog.services.find((s) => s.id === node.dataset.service);
  if (event.target.hasAttribute("data-delete-service")) {
    if (catalog.services.length === 1) {
      status("Keep at least one service.");
      return;
    }
    if (catalog.packages.some((p) => p.serviceIds.includes(s.id))) {
      status("Remove this service from its packages first.");
      return;
    }
    catalog.services = catalog.services.filter((v) => v !== s);
    renderServices();
    renderPackages();
    renderAddons();
    quote();
  } else if (event.target.hasAttribute("data-add-band")) {
    const last = s.bands.at(-1);
    s.bands.push({
      upToSqft: (last?.upToSqft || 0) + 5000,
      priceCents: (last?.priceCents || 4500) + 1500,
    });
    renderServices();
    quote();
  } else if (event.target.hasAttribute("data-delete-band")) {
    s.bands.splice(Number(event.target.dataset.deleteBand), 1);
    renderServices();
    quote();
  }
});
$("package-list").addEventListener("input", (event) => {
  const node = event.target.closest("[data-package]");
  if (!node) return;
  const p = catalog.packages.find((p) => p.id === node.dataset.package);
  const field = event.target.dataset.packageField;
  if (field && field !== "mode") {
    p[field] =
      field === "name"
        ? event.target.value
        : Math.round(Number(event.target.value) * 100);
    if (field === "name") {
      node.querySelector("h3").textContent = p.name;
      renderOffers();
    }
  }
  if (event.target.dataset.include) {
    p.serviceIds = [...node.querySelectorAll("[data-include]:checked")].map(
      (el) => el.dataset.include,
    );
    renderAddons();
  }
  quote();
});
$("package-list").addEventListener("change", (event) => {
  if (event.target.dataset.packageField !== "mode") return;
  const p = catalog.packages.find(
    (p) => p.id === event.target.closest("[data-package]").dataset.package,
  );
  p.mode = event.target.value;
  p.discountBps = p.discountBps ?? 1000;
  p.priceCents = p.priceCents ?? 5000;
  renderPackages();
  quote();
});
$("package-list").addEventListener("click", (event) => {
  if (!event.target.hasAttribute("data-delete-package")) return;
  const id = event.target.closest("[data-package]").dataset.package;
  catalog.packages = catalog.packages.filter((p) => p.id !== id);
  renderPackages();
  renderOffers();
  quote();
});
$("add-service").onclick = () => {
  catalog.services.push({
    id: uid("service"),
    name: "New service",
    mode: "fixed",
    priceCents: 2000,
    minimumCents: 0,
  });
  renderServices();
  renderPackages();
  renderAddons();
  quote();
  $("service-list").lastElementChild.querySelector("input").focus();
};
$("add-package").onclick = () => {
  catalog.packages.push({
    id: uid("package"),
    name: "New care package",
    mode: "fixed",
    priceCents: 5000,
    serviceIds: [catalog.services[0].id],
  });
  renderPackages();
  renderOffers();
  quote();
  $("package-list").lastElementChild.querySelector("input").focus();
};
$("quote-inputs").addEventListener("submit", (event) => event.preventDefault());
$("quote-inputs").addEventListener("input", () => quote());
$("offer").addEventListener("change", () => {
  renderAddons();
  quote();
});
for (const [id, view] of [
  ["customer-view", "customer"],
  ["owner-view", "owner"],
])
  $(id).onclick = () => {
    audience = view;
    for (const [other, v] of [
      ["customer-view", "customer"],
      ["owner-view", "owner"],
    ]) {
      $(other).classList.toggle("active", v === view);
      $(other).setAttribute("aria-pressed", String(v === view));
    }
    quote();
  };
$("save").onclick = save;
$("export").onclick = () => {
  quote();
  if (!lastQuote) {
    status("Resolve the quote inputs before exporting.");
    return;
  }
  const blob = new Blob(
    [
      JSON.stringify(
        {
          schema: 1,
          previewOnly: true,
          catalog,
          request: request(),
          quote: lastQuote,
        },
        null,
        2,
      ),
    ],
    { type: "application/json" },
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "mowmatter-pricing-draft.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  status(
    "Draft exported. It contains internal cost estimates; keep it private.",
  );
};
window.addEventListener("pagehide", () => clearTimeout(statusTimer));
renderServices();
renderPackages();
renderOffers();
$("visit-minimum").value = catalog.visitMinimumCents / 100;
$("offer").value = catalog.packages[0]?.id || "";
renderAddons();
if (!catalog.packages.length)
  $("addons").querySelector("[data-addon]").checked = true;
quote();
mountSetupWizard({
  getCatalog: () => catalog,
  onApply: (next, labor, job) => {
    catalog = next;
    renderServices();
    renderPackages();
    renderOffers();
    $("visit-minimum").value = next.visitMinimumCents / 100;
    $("minutes").value = job.minutes;
    $("workers").value = job.workers;
    $("area").value = job.areaSqft;
    $("job-cost").value = job.costCents / 100;
    $("offer").value = job.packageId || "";
    renderAddons();
    if (!job.packageId)
      $("addons").querySelector("[data-addon]").checked = true;
    quote();
    save();
    try {
      localStorage.setItem("mm-labor-preview-v1", JSON.stringify(labor));
    } catch {
      status(
        "Configuration applied for this session. Device saving is unavailable.",
      );
    }
  },
});

// Company publishing is explicit; loading never silently replaces a local draft.
let companyRevision = null;
async function companyAction(action, body = {}) {
  if (!window.MM) throw Error("Open this workspace from Office.");
  const session = await window.MM.ensureSession();
  const workspace = await window.MM.api({ action: "list" });
  if (workspace.profile?.role !== "owner")
    throw Error("Business owner access required.");
  const response = await fetch(
    window.MM_PROPERTY_API + "/api/operations/" + action,
    {
      method: "POST",
      headers: {
        Authorization: "Bearer " + session.access_token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ company_id: workspace.company.id, ...body }),
      signal: AbortSignal.timeout(20000),
    },
  );
  const value = await response.json();
  if (!response.ok) throw Error(value.error || "Company settings unavailable.");
  return value;
}
if ($("load-company"))
  $("load-company").onclick = async () => {
    try {
      const value = await companyAction("settings");
      companyRevision = value.settings?.revision || 0;
      if (value.settings) {
        if (
          !window.confirm(
            "Replace this device draft with your published company rates?",
          )
        )
          return;
        catalog = validateCatalog(value.settings.catalog);
        renderServices();
        renderPackages();
        renderOffers();
        $("visit-minimum").value = catalog.visitMinimumCents / 100;
        renderAddons();
        quote();
        localStorage.setItem(
          "mm-labor-preview-v1",
          JSON.stringify(value.settings.labor),
        );
        save();
      }
      status(
        value.settings
          ? "Published company rates loaded."
          : "No published rates yet. Review your draft and publish when ready.",
      );
    } catch (e) {
      status(e.message);
    }
  };
if ($("publish-company"))
  $("publish-company").onclick = async () => {
    const button = $("publish-company");
    button.disabled = true;
    try {
      if (companyRevision === null)
        throw Error("Load company rates first to check the current revision.");
      if (
        !window.confirm(
          "Publish these reviewed rates for your business? Existing customer contracts will remain unchanged.",
        )
      )
        return;
      const labor = JSON.parse(
        localStorage.getItem("mm-labor-preview-v1") || "{}",
      );
      const value = await companyAction("save-settings", {
        catalog: validateCatalog(catalog),
        labor,
        expected_revision: companyRevision,
        confirm_owner_review: true,
      });
      companyRevision = value.revision;
      status(
        "Company rates published. Quote previews still require owner review.",
      );
    } catch (e) {
      status(e.message);
    } finally {
      button.disabled = false;
    }
  };
