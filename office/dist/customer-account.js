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
  function renderAuth(mode = "login", email = "", provider = "google") {
    const signup = mode === "signup", forgot = mode === "forgot", recovery = mode === "recovery", social = mode === "social";
    const title = signup ? "Create your account" : forgot ? "Forgot your password?" : recovery ? "Choose a new password" : social ? "Continue with " + (provider === "google" ? "Google" : "Facebook") : "Welcome back";
    main.innerHTML = `<section class="card customer-auth"><h2 tabindex="-1">${title}</h2><p class="auth-intro">${forgot ? "Enter your account email and we’ll send a reset link." : recovery ? "Use at least 8 characters for your new password." : "Use the email your lawn care company has on file."}</p><form id="account-auth" class="form">
      ${recovery || social ? "" : `<label>Email<input name="email" type="email" required autocomplete="username" value="${esc(email)}"></label>`}
      ${forgot || social ? "" : `<div class="password-heading"><label for="account-password">${recovery ? "New password" : "Password"}</label>${mode === "login" ? '<button type="button" class="auth-link" id="reset-password">Forgot password?</button>' : ""}</div><input id="account-password" name="password" type="password" required ${signup || recovery ? 'minlength="8"' : ''} autocomplete="${signup || recovery ? "new-password" : "current-password"}">`}
      ${signup || social ? MowNotice.markup("customer") : ""}
      <button class="button primary auth-submit">${signup ? "Create account" : forgot ? "Send reset link" : recovery ? "Save password" : social ? title : "Sign in"}</button>
      <p role="status" aria-live="polite"></p>
      </form>
      ${recovery ? "" : `<div class="auth-secondary">${mode === "login" ? 'New here? <button type="button" class="auth-link" id="create-account">Create account</button>' : '<button type="button" class="auth-link" id="back-login">Back to sign in</button>'}</div>`}
      ${mode === "login" ? '<details class="auth-confirmation"><summary>Waiting for a confirmation email?</summary><button type="button" class="auth-link" id="resend-confirmation">Resend confirmation email</button></details>' : ""}</section>`;
    const form = document.getElementById("account-auth"), status = form.querySelector('[role="status"]');
    const currentEmail = () => form.elements.email?.value || email;
    const switchMode = (next) => { renderAuth(next, currentEmail()); main.querySelector("h2").focus(); };
    if (mode === "login") {
      MM.mountGoogleLogin(form, { autoStart: false });
      // Facebook is not enabled for this project; expose the available provider.
      main.querySelector("[data-facebook-login]")?.remove();
      for (const name of ["google", "facebook"]) {
        const button = main.querySelector(`[data-${name}-login]`);
        if (button) button.onclick = () => { renderAuth("social", currentEmail(), name); main.querySelector("h2").focus(); };
      }
      document.getElementById("reset-password").onclick = () => switchMode("forgot");
      document.getElementById("create-account").onclick = () => switchMode("signup");
      document.getElementById("resend-confirmation").onclick = async (event) => {
        if (!form.elements.email.reportValidity()) return;
        const button = event.currentTarget; button.disabled = true;
        try { await MM.resend(currentEmail()); status.textContent = "If eligible, a confirmation email has been requested. Check your inbox."; }
        catch (err) { status.textContent = err.message; }
        finally { button.disabled = false; }
      };
    }
    document.getElementById("back-login")?.addEventListener("click", () => switchMode("login"));
    form.onsubmit = async (event) => {
      event.preventDefault();
      const button = event.submitter || form.querySelector('button[type="submit"], .auth-submit');
      button.disabled = true; status.textContent = "Working…";
      try {
        const values = new FormData(form);
        if (forgot) { await MM.resetPassword(values.get("email")); status.textContent = "If eligible, a reset link has been requested. Check your inbox and spam folder."; }
        else if (social) { await MM.socialSignIn(provider, undefined, MowNotice.validate(form, "customer")); }
        else if (signup) { await MM.signUp(values.get("email"), values.get("password"), undefined, MowNotice.validate(form, "customer")); status.textContent = "Check your email to confirm your account, then return to sign in."; }
        else if (recovery) { await MM.updatePassword(values.get("password")); await load(); }
        else { await MM.signIn(values.get("email"), values.get("password")); await load(); }
      } catch (err) { status.textContent = err.message; }
      finally { button.disabled = false; }
    };
  }
  async function load() {
    await MM.ready;
    if (!company || !customer) {
      main.textContent =
        "Open the account link your lawn care company sent you.";
      return;
    }
    if (!MM.session || MM.recovery) {
      renderAuth(MM.recovery ? "recovery" : "login");
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
      main.innerHTML = `<section class="card">${typeof b.logo_url === "string" && b.logo_url.startsWith("https://pzymmsfjgspvzbivzvkx.supabase.co/storage/v1/object/public/mow-business-logos/") ? `<img class="customer-brand" src="${esc(b.logo_url)}" alt="${esc(d.company.name)} logo">` : ""}<h2>${esc(d.company.name)}</h2><p>${esc(b.tagline)}</p><h3>Hello, ${esc(d.customer.name)}</h3><p>${esc(d.customer.address)}</p><p>Contact your lawn care company: ${esc(b.phone)} · ${esc(b.email)}</p></section><section class="card"><h2>Your yard. Your next improvement.</h2><p>Review your provider’s consultation and optional care quotes, or ask for another service.</p><div class="actions"><a class="button primary" href="#care-options">Review care options</a><a class="button" href="#request-service">Request another service</a></div><p class="help">See the price and scope before approving. Extra work is separate from your existing bill; your provider confirms the schedule and payment.</p></section><section class="card"><h2>Your contact details</h2><form id="contact-form" class="form"><label>Phone<input name="phone" type="tel" maxlength="30" value="${esc(d.customer.phone)}"></label><p>Account email: ${esc(d.customer.email)}. Contact your provider to change your email, property or schedule.</p><button class="button primary">Save phone</button><p role="status"></p></form></section><section class="card"><h2>Your visits</h2><ul class="job-list">${d.jobs.map((j) => `<li><div><b>${esc(j.service_date)} · ${esc(j.scheduled_time.slice(0, 5))}</b><small>${esc(j.services.join(", "))} · ${esc(j.cancelled_at ? "cancelled" : j.status.replaceAll("_", " "))}</small></div></li>`).join("") || "<li>No visits yet.</li>"}</ul></section><section class="card"><h2>Your invoices</h2><p>View, print or save a PDF. Contact your provider for payment questions or account changes.</p><ul class="job-list">${d.invoices.map((i) => `<li><b>MM-${i.number} · $${(i.amount_cents / 100).toFixed(2)}</b><button class="button" data-invoice="${i.id}">View / Save PDF</button><a class="button" href="#care-options">Review care options</a></li>`).join("") || "<li>No invoices yet.</li>"}</ul></section>`;
      const service=document.createElement('section');main.firstElementChild.after(service);void window.showCustomerService({company,customer},service);
      const commerce=document.createElement('div');main.append(commerce);
      await window.showCustomerCommerce({company,customer,jobs:d.jobs,invoices:d.invoices},commerce);
      const destination = { '#care-options': 'care-options', '#request-service': 'request-service' }[location.hash];
      if (destination) document.getElementById(destination)?.scrollIntoView({ block: 'start' });
      void window.showInvoicePayments({company,customer,invoices:d.invoices},main);
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

