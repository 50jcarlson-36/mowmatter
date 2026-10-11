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
      ),
    money = (v) =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(v / 100),
    date = () =>
      new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(
        new Date(),
      );
  async function request(action, body) {
    const s = await MM.ensureSession();
    const r = await fetch(
      "https://mowmatter-property.onrender.com/api/commerce/" + action,
      {
        method: "POST",
        headers: {
          Authorization: "Bearer " + s.access_token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(20000),
      },
    );
    const d = await r.json();
    if (!r.ok) throw Error(d.error || "Unable to connect");
    return d;
  }
  function bind(form, fn) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      const button = e.submitter;
      button.disabled = true;
      try {
        await fn(new FormData(form), button);
      } catch (err) {
        form.querySelector("[role=status]").textContent = err.message;
      } finally {
        button.disabled = false;
      }
    };
  }
  function quoteCard(q, customer) {
    const expired = Date.parse(q.expires_at) <= Date.now();
    return `<article class="card"><h3>${esc(q.title)} · ${money(q.amount_cents)}</h3><p>${esc(q.scope)}</p><p>${esc(q.services.join(", "))}</p><p style="white-space:pre-wrap">${esc(q.terms)}</p><p>Expires ${esc(new Date(q.expires_at).toLocaleDateString())} · ${esc(q.state === "sent" && expired ? "expired" : q.state)}</p>${customer && q.state === "sent" && !expired ? `<form data-quote-response="${q.id}" class="form"><label class="check"><input name="confirm_quote" type="checkbox">I approve this scope, price and terms. My provider will confirm the service date. This does not authorize an automatic payment.</label><div class="actions"><button class="button primary" value="accepted">Approve quote</button><button class="button" value="declined">Decline</button></div><p role="status"></p></form>` : ""}</article>`;
  }
  window.MowCommerce = { request };
  window.showCustomerCommerce = async (
    { company, customer, jobs, invoices },
    target,
  ) => {
    try {
      const scope = { company_id: company, customer_id: customer };
      const d = await request("customer", scope);
      target.innerHTML = `<section class="card"><h2>Request a service or account change</h2><p>Your provider reviews requests. A request does not change your booking until confirmed.</p><form id="customer-request" class="form"><label>Request type<select name="kind"><option value="service">New service</option><option value="reschedule">Reschedule a visit</option><option value="cancel">Cancel a visit</option><option value="account">Account or property change</option></select></label><label>Related visit<select name="job_id"><option value="">No visit selected</option>${jobs
        .filter(
          (j) => !j.cancelled_at && ["scheduled", "blocked"].includes(j.status),
        )
        .map(
          (j) =>
            `<option value="${j.id}">${esc(j.service_date)} · ${esc(j.services.join(", "))}</option>`,
        )
        .join(
          "",
        )}</select></label><label>Preferred date (optional)<input name="preferred_date" type="date" min="${date()}"></label><label>Details<textarea name="message" required minlength="3" maxlength="1500"></textarea></label><p class="help">Do not include passwords, card details or access codes.</p><button class="button primary">Send request</button><p role="status"></p></form></section><section class="card"><h2>Your requests</h2>${d.requests.map((r) => `<article><h3>${esc(r.kind)} · ${esc(r.state)}</h3><p>${esc(r.message)}</p>${r.owner_response ? `<p>Provider response: ${esc(r.owner_response)}</p>` : ""}</article>`).join("") || "<p>No requests yet.</p>"}</section><section class="card"><h2>Text updates and optional offers</h2><form id="sms-preferences" class="form"><label>My US mobile number<input name="phone" type="tel" required pattern="\\+1[2-9][0-9]{9}" placeholder="+13865551234" value="${esc(d.channels[0]?.phone || "")}"></label><label class="check"><input name="service_consent" type="checkbox" ${d.channels[0]?.sms_service_consent ? "checked" : ""}>I own this number and agree to automated arrival and completion texts from this provider through MowMatter. Up to 2 status texts per visit. Message and data rates may apply. Reply STOP to opt out or HELP for help.</label><label class="check"><input name="consent" type="checkbox" ${d.channels[0]?.sms_offer_consent ? "checked" : ""}>I own this number and agree to receive automated optional service offers from this provider through MowMatter. Up to 3 offer texts per day. Message and data rates may apply. Reply STOP to opt out or HELP for help. Consent is not required to purchase service.</label><p><a href="https://mowmatter.com/terms.html">Terms</a> · <a href="https://mowmatter.com/privacy.html">Privacy</a></p><button class="button">Save SMS preference</button><p role="status"></p>${d.sms_enabled ? "" : "<p>SMS sending is awaiting activation. Your preference does not approve any additional work.</p>"}</form></section><section><h2>Your quotes</h2>${d.quotes.map((q) => quoteCard(q, true)).join("") || "<p>No quotes yet.</p>"}</section>`;
      bind(target.querySelector("#sms-preferences"), async (f) => {
        await request("sms-preferences", {
          ...scope,
          phone: f.get("phone"),
          consent: f.has("consent"),
          service_consent: f.has("service_consent"),
        });
        target.querySelector("#sms-preferences [role=status]").textContent =
          "SMS preference saved.";
      });
      const photoSection = document.createElement("section");
      photoSection.className = "card";
      photoSection.innerHTML = `<h2>Your visit photos</h2><p>Photos from your provider are available here. Sign in to your account to view them.</p>${jobs.map((j) => `<article><h3>${esc(j.service_date)} · ${esc(j.services.join(", "))}</h3><button class="button" data-visit-photos="${j.id}">View photos</button><div data-photo-gallery="${j.id}" role="status"></div></article>`).join("")}`;
      target.prepend(photoSection);
      photoSection.querySelectorAll("[data-visit-photos]").forEach(
        (button) =>
          (button.onclick = async () => {
            const gallery = photoSection.querySelector(
              `[data-photo-gallery="${button.dataset.visitPhotos}"]`,
            );
            button.disabled = true;
            gallery.textContent = "Loading photos…";
            try {
              const body = { ...scope, job_id: button.dataset.visitPhotos };
              const result = await request("visit-photos", body);
              gallery.replaceChildren();
              if (!result.photos.length)
                gallery.textContent = "No photos uploaded for this visit yet.";
              for (const photo of result.photos) {
                const session = await MM.ensureSession();
                const response = await fetch(
                  "https://mowmatter-property.onrender.com/api/commerce/visit-photo",
                  {
                    method: "POST",
                    headers: {
                      Authorization: "Bearer " + session.access_token,
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ ...body, photo_id: photo.id }),
                    signal: AbortSignal.timeout(30000),
                  },
                );
                if (!response.ok) throw Error("Photo unavailable. Try again.");
                const img = document.createElement("img");
                const url = URL.createObjectURL(await response.blob());
                img.onload = () => URL.revokeObjectURL(url);
                img.onerror = () => URL.revokeObjectURL(url);
                img.src = url;
                img.alt = "Visit photo from your lawn care provider";
                img.style.cssText =
                  "max-width:100%;height:auto;margin:12px 0;border-radius:12px";
                gallery.append(img);
              }
            } catch (e) {
              gallery.textContent = e.message;
            } finally {
              button.disabled = false;
            }
          }),
      );
      let id = crypto.randomUUID();
      bind(target.querySelector("#customer-request"), async (f) => {
        await request("request", { ...scope, id, ...Object.fromEntries(f) });
        await window.showCustomerCommerce(
          { company, customer, jobs, invoices },
          target,
        );
      });
      target.querySelectorAll("[data-quote-response]").forEach((form) =>
        bind(form, async (f, button) => {
          const q = d.quotes.find((q) => q.id === form.dataset.quoteResponse);
          if (button.value === "accepted" && !f.has("confirm_quote"))
            throw Error("Review and approve the scope, terms and price first.");
          await request("respond", {
            ...scope,
            id: q.id,
            choice: button.value,
            confirm_quote: f.has("confirm_quote"),
            expected_amount_cents: q.amount_cents,
            notice_version: "2026-10-11",
          });
          await window.showCustomerCommerce(
            { company, customer, jobs, invoices },
            target,
          );
        }),
      );
    } catch (e) {
      target.innerHTML =
        '<section class="card"><h2>Requests and quotes unavailable</h2><p role="alert"></p></section>';
      target.querySelector("p").textContent = e.message;
    }
  };
  window.showOwnerCommerce = async (data, target) => {
    try {
      const scope = { company_id: data.company.id };
      const d = await request("owner", scope);
      const names = new Map(data.customers.map((c) => [c.id, c.name]));
      target.innerHTML = `<section class="card"><h2>Additional work found during visits</h2>${(d.proposals || []).map((p) => `<article><h3>${esc(names.get(p.customer_id))} · ${esc(p.title)}</h3><p>${esc(p.scope)} · ${esc(p.state)}</p>${p.state === "pending" ? `<button class="button" data-proposal="${p.id}">Review and price quote</button>` : ""}</article>`).join("") || "<p>No crew suggestions yet.</p>"}</section><section class="card"><h2>Customer requests</h2>${d.requests.map((r) => `<article><h3>${esc(names.get(r.customer_id) || "Customer")} · ${esc(r.kind)} · ${esc(r.state)}</h3><p>${esc(r.message)}${r.preferred_date ? " · Preferred " + esc(r.preferred_date) : ""}</p>${r.job_id ? "<p>Review the related visit in Routes before confirming a schedule change.</p>" : ""}${r.owner_response ? `<p>${esc(r.owner_response)}</p>` : ""}${r.state === "pending" ? `<form data-request-response="${r.id}" class="form"><label>Response<textarea name="response" required minlength="3" maxlength="1500"></textarea></label><label>Result<select name="state"><option value="resolved">Resolved</option><option value="declined">Declined</option></select></label><p class="help">Update the visit or account first. Saving this response does not change a schedule.</p><button class="button">Save response</button><p role="status"></p></form>` : ""}</article>`).join("") || "<p>No customer requests yet.</p>"}</section><section class="card"><h2>Create a customer quote</h2><p>A one-time scope and price for customer approval. Withdraw an unanswered quote and create a replacement to revise it.</p><form id="owner-quote" class="form"><label>Customer<select name="customer_id" required>${data.customers.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join("")}</select></label><label>Title<input name="title" required minlength="3" maxlength="100"></label><label>Scope<textarea name="scope" required minlength="3" maxlength="1500"></textarea></label><label>Price (USD, total for this visit)<input name="price" type="number" min="0.01" max="100000" step="0.01" required></label><label>Planned minutes<input name="planned_minutes" type="number" min="15" max="480" value="60" required></label><fieldset><legend>Services</legend>${["Mow", "Edge", "Trim", "Blow", "Cleanup"].map((s) => `<label class="check"><input type="checkbox" name="services" value="${s}">${s}</label>`).join("")}</fieldset><label>Additional service label (optional)<input name="extra_service" maxlength="80"></label><label>Expires on (UTC)<input name="expires" type="date" min="${date()}" required></label><label>Service terms, taxes and exclusions<textarea name="terms" required minlength="3" maxlength="1500" placeholder="Describe what the total covers, any exclusions, and your cancellation terms."></textarea></label><label class="check"><input name="confirm_review" type="checkbox" required>I reviewed the scope, total, taxes and terms.</label><button class="button primary">Publish quote to customer account</button><p role="status"></p></form></section><section><h2>Quotes and booking</h2>${
        d.quotes
          .map(
            (q) =>
              `<div>${quoteCard(q, false)}<p>${esc(names.get(q.customer_id) || "Customer")} · <a href="${esc(MowBusiness.portal(data.company.id, q.customer_id))}">Customer account link</a></p>${q.state === "sent" ? `<button class="button" data-withdraw="${q.id}">Withdraw quote</button><button class="button" data-sms="${q.id}" ${d.sms_enabled ? "" : "disabled"}>Send SMS approval link</button>` : ""}${
                q.state === "accepted"
                  ? `<form data-book="${q.id}" class="form"><label>Confirmed service date<input name="service_date" type="date" min="${date()}" required></label><label>Start time<input name="scheduled_time" type="time" required value="09:00"></label><label>Crew member<select name="assigned_to">${data.members.map((m) => `<option value="${m.user_id}">${esc(m.display_name)}</option>`).join("")}</select></label><label class="check"><input name="confirm_booking" type="checkbox" required>I confirmed this date with the customer and reviewed crew capacity, travel and weather.</label><button class="button primary">Book approved work</button><p role="status"></p></form><form data-addon="${q.id}" class="form"><label>Or add during an active visit<select name="job_id" required>${(
                      data.jobs || []
                    )
                      .filter(
                        (j) =>
                          j.customer_id === q.customer_id &&
                          !j.cancelled_at &&
                          j.status !== "completed",
                      )
                      .map(
                        (j) =>
                          `<option value="${j.id}">${esc(j.service_date)} · ${esc(j.address)}</option>`,
                      )
                      .join(
                        "",
                      )}</select></label><label class="check"><input name="confirm_addon" type="checkbox" required>I reviewed the customer approval and the added work can be completed during this visit. Extras on recurring visits are billed separately.</label><button class="button">Add approved work to visit</button><p role="status"></p></form>`
                  : ""
              }<p data-quote-status="${q.id}" role="status"></p></div>`,
          )
          .join("") || "<p>No quotes yet.</p>"
      }</section>`;
      const recurring = document.createElement("section");
      recurring.className = "card";
      target.prepend(recurring);
      await showOwnerRecurring(data, recurring);
      const reload = () => window.showOwnerCommerce(data, target);
      let quoteId = crypto.randomUUID();
      bind(target.querySelector("#owner-quote"), async (f) => {
        await request("quote", {
          ...scope,
          id: quoteId,
          source_proposal_id:
            target.querySelector("#owner-quote").dataset.proposal || null,
          ...Object.fromEntries(f),
          services: [
            ...f.getAll("services"),
            ...(f.get("extra_service")?.trim()
              ? [f.get("extra_service").trim()]
              : []),
          ],
          amount_cents: Math.round(Number(f.get("price")) * 100),
          planned_minutes: Number(f.get("planned_minutes")),
          expires_at: f.get("expires") + "T23:59:59Z",
          confirm_review: f.has("confirm_review"),
        });
        await reload();
      });
      target.querySelectorAll("[data-proposal]").forEach(
        (button) =>
          (button.onclick = () => {
            const p = d.proposals.find((p) => p.id === button.dataset.proposal),
              form = target.querySelector("#owner-quote");
            form.elements.customer_id.value = p.customer_id;
            form.elements.title.value = p.title;
            form.elements.scope.value = p.scope;
            form.dataset.proposal = p.id;
            form.elements.title.focus();
          }),
      );
      target.querySelectorAll("[data-request-response]").forEach((form) =>
        bind(form, async (f) => {
          const r = d.requests.find(
            (r) => r.id === form.dataset.requestResponse,
          );
          await request("resolve", {
            ...scope,
            customer_id: r.customer_id,
            id: r.id,
            ...Object.fromEntries(f),
          });
          await reload();
        }),
      );
      target.querySelectorAll("[data-book]").forEach((form) =>
        bind(form, async (f) => {
          const q = d.quotes.find((q) => q.id === form.dataset.book);
          await request("book", {
            ...scope,
            customer_id: q.customer_id,
            id: q.id,
            ...Object.fromEntries(f),
            confirm_booking: f.has("confirm_booking"),
          });
          await reload();
        }),
      );
      target.querySelectorAll("[data-addon]").forEach((form) =>
        bind(form, async (f) => {
          const q = d.quotes.find((q) => q.id === form.dataset.addon);
          await request("apply-addon", {
            ...scope,
            customer_id: q.customer_id,
            id: q.id,
            ...Object.fromEntries(f),
            confirm_addon: f.has("confirm_addon"),
          });
          await reload();
        }),
      );
      target.querySelectorAll("[data-sms]").forEach(
        (button) =>
          (button.onclick = async () => {
            button.disabled = true;
            try {
              await request("send-quote-sms", {
                ...scope,
                id: button.dataset.sms,
              });
              target.querySelector(
                `[data-quote-status="${button.dataset.sms}"]`,
              ).textContent =
                "SMS accepted by provider. Approval is still required in the customer account.";
            } catch (e) {
              target.querySelector(
                `[data-quote-status="${button.dataset.sms}"]`,
              ).textContent = e.message;
              button.disabled = false;
            }
          }),
      );
      target.querySelectorAll("[data-withdraw]").forEach(
        (button) =>
          (button.onclick = async () => {
            button.disabled = true;
            const q = d.quotes.find((q) => q.id === button.dataset.withdraw);
            try {
              await request("withdraw", {
                ...scope,
                customer_id: q.customer_id,
                id: q.id,
              });
              await reload();
            } catch (e) {
              target.querySelector(
                `[data-quote-status="${q.id}"]`,
              ).textContent = e.message;
              button.disabled = false;
            }
          }),
      );
    } catch (e) {
      target.innerHTML =
        '<section class="card"><h2>Customer workflow unavailable</h2><p role="alert"></p></section>';
      target.querySelector("p").textContent = e.message;
    }
  };
  async function billing(action, body) {
    const session = await MM.ensureSession();
    const r = await fetch(
      "https://mowmatter-property.onrender.com/api/billing/" + action,
      {
        method: "POST",
        headers: {
          Authorization: "Bearer " + session.access_token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(20000),
      },
    );
    const d = await r.json();
    if (!r.ok) throw Error(d.error || "Billing unavailable");
    return d;
  }
  async function showOwnerRecurring(data, target) {
    target.innerHTML = `<h2>Offer recurring monthly payments</h2><p>Prepare a fixed monthly payment proposal for an active recurring service plan. The customer must authorize it in their account. This does not charge a card.</p><form class="form"><label>Service plan<select name="plan_id" required>${(
      data.plans || []
    )
      .filter((p) => p.active && p.price_cents > 0)
      .map(
        (p) =>
          `<option value="${p.id}">${esc(data.customers.find((c) => c.id === p.customer_id)?.name)} · ${money(Math.round((p.price_cents * 365.25) / p.interval_days / 12))}/month · Every ${p.interval_days} days</option>`,
      )
      .join(
        "",
      )}</select></label><label>Service, tax, renewal and cancellation terms<textarea name="terms" required minlength="3" maxlength="1500" placeholder="Describe included work, fixed monthly total, tax treatment, service frequency and cancellation at the paid period end."></textarea></label><label class="check"><input name="confirm_review" type="checkbox" required>I reviewed the monthly total, taxes and service commitments.</label><button class="button primary">Offer recurring payment plan</button><p role="status"></p></form>`;
    bind(target.querySelector("form"), async (f) => {
      const p = data.plans.find((p) => p.id === f.get("plan_id"));
      if (!p) throw Error("Create a recurring service plan first");
      await billing("prepare-recurring", {
        company_id: data.company.id,
        plan_id: p.id,
        terms: f.get("terms"),
        expected_monthly_cents: Math.round(
          (p.price_cents * 365.25) / p.interval_days / 12,
        ),
        confirm_review: f.has("confirm_review"),
      });
      target.querySelector("[role=status]").textContent =
        "Proposal saved. Share the customer account link so they can review and authorize monthly billing.";
    });
  }
})();
