(async () => {
  "use strict";
  const main = document.getElementById("main"),
    params = new URLSearchParams(location.search),
    company = params.get("business"),
    customer = params.get("customer"),
    esc = (v) =>
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
  document.getElementById("close-dialog").onclick = () =>
    document.getElementById("dialog").close();
  async function load() {
    await MM.ready;
    if (!company || !customer) {
      main.textContent =
        "Open the account link your lawn care company sent you.";
      return;
    }
    if (!MM.session || MM.recovery) {
      const recovery = MM.recovery;
      main.innerHTML = `<section class="card"><h2>${recovery ? "Reset your password" : "Welcome back."}</h2><p>Use the email address your lawn care company has on file.</p><form id="account-auth" class="form">${recovery ? "" : '<label>Email<input name="email" type="email" required autocomplete="username"></label>'}<label>Password<input name="password" type="password" required minlength="8" autocomplete="${recovery ? "new-password" : "current-password"}"></label><div class="actions"><button class="button primary" value="login">${recovery ? "Save password" : "Sign in"}</button>${recovery ? "" : '<button class="button" value="signup">Create account</button><button type="button" id="reset-password" class="button">Forgot password?</button>'}</div><p role="status" aria-live="polite"></p></form></section>`;
      const form = document.getElementById("account-auth");
      form.onsubmit = async (e) => {
        e.preventDefault();
        e.submitter.disabled = true;
        try {
          const f = new FormData(form);
          if (recovery) {
            await MM.updatePassword(f.get("password"));
            await load();
          } else if (e.submitter.value === "signup") {
            await MM.signUp(f.get("email"), f.get("password"));
            form.querySelector('[role="status"]').textContent =
              "Check your email to confirm your account, then reopen your customer link.";
          } else {
            await MM.signIn(f.get("email"), f.get("password"));
            await load();
          }
        } catch (err) {
          form.querySelector('[role="status"]').textContent = err.message;
        } finally {
          e.submitter.disabled = false;
        }
      };
      const reset = document.getElementById("reset-password");
      if (reset)
        reset.onclick = async () => {
          const email = form.elements.email;
          if (!email.reportValidity()) return;
          reset.disabled = true;
          try {
            await MM.resetPassword(email.value);
            form.querySelector('[role="status"]').textContent =
              "If eligible, a recovery email has been requested.";
          } catch (err) {
            form.querySelector('[role="status"]').textContent = err.message;
          } finally {
            reset.disabled = false;
          }
        };
      return;
    }
    const logout = document.getElementById("account-logout");
    logout.hidden = false;
    logout.onclick = async () => {
      await MM.signOut();
      logout.hidden = true;
      await load();
    };
    try {
      const d = await MowBusiness.request({
          action: "portal",
          company_id: company,
          customer_id: customer,
        }),
        b = d.company.branding || {};
      main.innerHTML = `<section class="card">${typeof b.logo_url === "string" && b.logo_url.startsWith("https://pzymmsfjgspvzbivzvkx.supabase.co/storage/v1/object/public/mow-business-logos/") ? `<img class="customer-brand" src="${esc(b.logo_url)}" alt="${esc(d.company.name)} logo">` : ""}<h2>${esc(d.company.name)}</h2><p>${esc(b.tagline)}</p><h3>Hello, ${esc(d.customer.name)}</h3><p>${esc(d.customer.address)}</p><p>Contact your lawn care company: ${esc(b.phone)} · ${esc(b.email)}</p></section><section class="card"><h2>Your contact details</h2><form id="contact-form" class="form"><label>Phone<input name="phone" type="tel" maxlength="30" value="${esc(d.customer.phone)}"></label><p>Account email: ${esc(d.customer.email)}. Contact your provider to change your email, property or schedule.</p><button class="button primary">Save phone</button><p role="status"></p></form></section><section class="card"><h2>Your visits</h2><ul class="job-list">${d.jobs.map((j) => `<li><div><b>${esc(j.service_date)} · ${esc(j.scheduled_time.slice(0, 5))}</b><small>${esc(j.services.join(", "))} · ${esc(j.cancelled_at ? "cancelled" : j.status.replaceAll("_", " "))}</small></div></li>`).join("") || "<li>No visits yet.</li>"}</ul></section><section class="card"><h2>Your invoices</h2><p>View, print or save a PDF. Contact your provider for payment questions or account changes.</p><ul class="job-list">${d.invoices.map((i) => `<li><b>MM-${i.number} · $${(i.amount_cents / 100).toFixed(2)}</b><button class="button" data-invoice="${i.id}">View / Save PDF</button></li>`).join("") || "<li>No invoices yet.</li>"}</ul></section>`;
      if (/^#[0-9a-f]{6}$/i.test(b.primary)) {
        document.documentElement.style.setProperty("--green", b.primary);
        main.querySelectorAll(".button").forEach((el) => {
          el.style.background = b.primary;
          el.style.color = MowBusiness.contrast(b.primary);
        });
      }
      main.querySelector("#contact-form").onsubmit = async (e) => {
        e.preventDefault();
        const button = e.submitter;
        button.disabled = true;
        try {
          await MowBusiness.request({
            action: "portal_update",
            company_id: company,
            customer_id: customer,
            phone: new FormData(e.target).get("phone"),
          });
          e.target.querySelector('[role="status"]').textContent =
            "Phone updated.";
        } catch (err) {
          e.target.querySelector('[role="status"]').textContent = err.message;
        } finally {
          button.disabled = false;
        }
      };
      main
        .querySelectorAll("[data-invoice]")
        .forEach(
          (el) =>
            (el.onclick = () =>
              MowBusiness.showInvoice(
                d.invoices.find((i) => i.id === el.dataset.invoice),
              )),
        );
    } catch (err) {
      main.innerHTML =
        '<section class="card"><h2>Account unavailable</h2><p role="alert"></p></section>';
      main.querySelector("p").textContent = err.message;
    }
  }
  await load();
})();
