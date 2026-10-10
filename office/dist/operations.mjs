const $ = (id) => document.getElementById(id),
  esc = (s) =>
    String(s ?? "").replace(
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
let data,
  settings,
  currentAssessment,
  requestId,
  analysisAvailable = false;
async function api(action, body = {}) {
  const session = await window.MM.ensureSession();
  const r = await fetch(window.MM_PROPERTY_API + "/api/operations/" + action, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + session.access_token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ company_id: data?.company?.id, ...body }),
    signal: AbortSignal.timeout(60000),
  });
  const d = await r.json();
  if (!r.ok) throw Error(d.error || "Action unavailable");
  return d;
}
async function run(button, action) {
  button.disabled = true;
  $("status").textContent = "Working…";
  try {
    await action();
    $("status").textContent = "Updated.";
  } catch (e) {
    $("status").textContent = e.message;
  } finally {
    button.disabled = button.id === "analyze" && !analysisAvailable;
  }
}
async function loadInsights() {
  const decisions = await api("offers");
  $("decisions").innerHTML =
    decisions.offers
      .map(
        (o) =>
          `<p><strong>${esc(o.title)}</strong> · ${esc(o.state)}${o.state === "accepted" ? " — Confirm capacity, schedule and payment separately." : ""}</p>`,
      )
      .join("") || "<p>No optional offers yet.</p>";
  const d = await api("insights");
  $("allowance").textContent = d.allowance.enabled
    ? `${d.allowance.remaining} assessments available.`
    : "Paid photo analysis is not activated for this business. Uploading completion photos remains available.";
  analysisAvailable = d.allowance.enabled && d.allowance.remaining > 0;
  $("analyze").disabled = !analysisAvailable;
  $("assessments").innerHTML = d.assessments
    .map(
      (a) =>
        `<article class="service"><h3>${esc(a.state.replaceAll("_", " "))}</h3><p>${esc(a.result?.summary || "No completed findings yet.")}</p>${(a.result?.findings || []).map((f) => `<p><strong>${esc(f.observation)}</strong><br>${esc(f.possibleIdentification)} · ${esc(f.confidence)}<br>${esc(f.uncertainty)}</p>`).join("")}${a.state === "owner_review" ? `<button data-review="${esc(a.id)}">Review optional service</button>` : ""}</article>`,
    )
    .join("");
}
$("weather").onclick = () =>
  run($("weather"), async () => {
    const d = await api("weather", { job_id: $("jobs").value });
    $("forecast").innerHTML =
      `<p><strong>${esc(d.provider)}</strong> · Updated ${esc(new Date(d.issuedAt).toLocaleString())}</p><p>${esc(d.notice)}</p>${d.alerts.map((a) => `<p class="notice">${esc(a.headline || a.event)}</p>`).join("")}<div class="service-list">${d.hours
        .slice(0, 48)
        .map(
          (h) =>
            `<article class="service"><strong>${esc(new Date(h.start).toLocaleString("en-US", { timeZone: d.timeZone }))}</strong><p>${esc(h.description)} · ${h.temperatureF ?? "Unknown"}°F · Rain ${h.rainProbability ?? "Unknown"}%</p><span>${esc(h.status)}${h.reasons.length ? " — " + esc(h.reasons.join("; ")) : ""}</span></article>`,
        )
        .join("")}</div>`;
  });
$("jobs").onchange = () => {
  requestId = undefined;
  $("forecast").replaceChildren();
  $("photo-picker").innerHTML =
    "<legend>Select up to three photos</legend><p>Load photos for this visit.</p>";
};
$("photo-picker").onchange = () => {
  requestId = undefined;
};
$("load-photos").onclick = () =>
  run($("load-photos"), async () => {
    const d = await api("photos", { job_id: $("jobs").value });
    $("photo-picker").innerHTML =
      "<legend>Select up to three photos</legend>" +
      d.photos
        .map(
          (p, i) =>
            `<label><input type="checkbox" data-photo="${esc(p.id)}"> Photo ${i + 1} · ${esc(new Date(p.created_at).toLocaleString())}</label><button type="button" data-view-photo="${esc(p.id)}">View photo ${i + 1}</button>`,
        )
        .join("");
    if (!d.photos.length)
      $("photo-picker").insertAdjacentHTML(
        "beforeend",
        "<p>No crew photos uploaded for this visit yet.</p>",
      );
  });
$("analyze").onclick = () =>
  run($("analyze"), async () => {
    if (!$("analysis-consent").checked)
      throw Error("Confirm analysis usage first");
    requestId ||= crypto.randomUUID();
    await api("analyze", {
      job_id: $("jobs").value,
      request_id: requestId,
      photo_ids: Array.from(
        $("photo-picker").querySelectorAll("[data-photo]:checked"),
      ).map((x) => x.dataset.photo),
      confirm_analysis: true,
    });
    await loadInsights();
  });
$("link-customer").onclick = () =>
  run($("link-customer"), async () => {
    if (!$("access-consent").checked) throw Error("Confirm access first");
    await api("link-customer", {
      customer_id: $("customers").value,
      confirm_customer_access: true,
    });
  });
$("assessments").onclick = (e) => {
  const b = e.target.closest("[data-review]");
  if (!b) return;
  if (!settings) {
    $("status").textContent = "Publish company pricing first.";
    return;
  }
  currentAssessment = b.dataset.review;
  $("offer-form").dataset.offerId = crypto.randomUUID();
  $("offer-form").reset();
  $("offer-form").elements.service.innerHTML = settings.catalog.services
    .filter((s) => s.active !== false)
    .map((s) => `<option value="${esc(s.id)}">${esc(s.name)}</option>`)
    .join("");
  $("offer-dialog").showModal();
};
$("close-offer").onclick = () => $("offer-dialog").close();
$("offer-form").onsubmit = async (e) => {
  e.preventDefault();
  const f = e.target;
  if (!f.reportValidity()) return;
  const button = f.querySelector("[type=submit]");
  button.disabled = true;
  try {
    const request = {
      serviceIds: [f.elements.service.value],
      visitsPerYear: 1,
      inputs: {
        areaSqft: Number(f.elements.area.value) || undefined,
        minutes: Number(f.elements.minutes.value) || undefined,
        workers: Number(f.elements.workers.value),
        units: {
          [f.elements.service.value]: Number(f.elements.quantity.value),
        },
      },
    };
    const preview = await api("preview-offer", { request });
    const amount = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(preview.quote.perVisitCents / 100);
    if (
      !window.confirm(
        "Publish this optional one-time quote for " +
          amount +
          "? No payment or booking will be created.",
      )
    )
      return;
    await api("publish-offer", {
      assessment_id: currentAssessment,
      offer_id: f.dataset.offerId,
      title: f.elements.title.value,
      description: f.elements.description.value,
      confirm_owner_review: true,
      request,
      expected_total_cents: preview.quote.perVisitCents,
    });
    await loadInsights();
    $("offer-dialog").close();
    $("status").textContent =
      "Optional quote published to the connected customer. No charge or booking created.";
  } catch (err) {
    $("offer-status").textContent = err.message;
  } finally {
    button.disabled = false;
  }
};
try {
  await window.MM.ready;
  data = await window.MM.api({ action: "list" });
  if (!data.company || data.profile?.role !== "owner")
    throw Error("Sign in as the business owner in Office first.");
  $("jobs").innerHTML = data.jobs
    .filter((j) => !j.cancelled_at)
    .map(
      (j) =>
        `<option value="${esc(j.id)}">${esc(j.address)} · ${esc(j.service_date)}</option>`,
    )
    .join("");
  $("customers").innerHTML = data.customers
    .map(
      (c) =>
        `<option value="${esc(c.id)}">${esc(c.name)} · ${esc(c.email)}</option>`,
    )
    .join("");
  settings = (await api("settings")).settings;
  await loadInsights();
  $("status").textContent = "Your business is connected.";
} catch (e) {
  $("status").textContent = e.message;
  for (const id of ["weather", "analyze", "link-customer"])
    $(id).disabled = true;
}

$("week-start").value = new Date(
  Date.now() - new Date().getTimezoneOffset() * 60000,
)
  .toISOString()
  .slice(0, 10);
$("week").onclick = () =>
  run($("week"), async () => {
    const d = await api("week", { start_date: $("week-start").value });
    $("week-output").innerHTML =
      `<p>${d.coverage.total} visits · ${d.coverage.needsReview} need review</p><p>${esc(d.notice)}</p>` +
      d.visits
        .map(
          (v) =>
            `<article class="service"><strong>${esc(v.address)}</strong><p>${esc(v.date)} · ${esc(v.time)} · ${esc(v.status)}</p><p>${esc(v.reasons.join("; "))}</p><a href="routes.html">Review in Visits →</a></article>`,
        )
        .join("");
  });

$("photo-picker").onclick = async (e) => {
  const button = e.target.closest("[data-view-photo]");
  if (!button) return;
  await run(button, async () => {
    const d = await api("photo", { photo_id: button.dataset.viewPhoto });
    const img = document.createElement("img");
    img.alt = "Selected visit photo";
    img.src = d.image;
    img.style.maxWidth = "100%";
    button.replaceWith(img);
  });
};
