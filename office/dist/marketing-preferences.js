// Mow Matter's own news and offers for the signed-in business owner (email and SMS, via Klaviyo).
// Separate from homeowner texts, which each business sends through Bird.
(() => {
  "use strict";
  if (document.body.dataset.page !== "settings") return;
  const base = "https://pzymmsfjgspvzbivzvkx.supabase.co",
    key = "sb_publishable_KQGD-vWlAlJi_Bv7fSaEvA_YLJpIgyu";
  async function preferences(body) {
    const session = await MM.ensureSession();
    const r = await fetch(base + "/rest/v1/rpc/mm_marketing_preferences", {
      method: "POST",
      headers: { apikey: key, Authorization: "Bearer " + session.access_token, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
    const d = await r.json();
    if (!r.ok) throw Error(d.message || "Your news preferences could not be saved. Please retry.");
    return d;
  }
  const phone = (v) => {
    const digits = String(v).replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
    return /^[2-9]\d{9}$/.test(digits) ? "+1" + digits : null;
  };
  const display = (p) => (p ? `(${p.slice(2, 5)}) ${p.slice(5, 8)}-${p.slice(8)}` : "");
  async function render() {
    const card = document.createElement("section");
    card.className = "card";
    card.id = "mow-news";
    card.style.marginTop = "22px";
    card.innerHTML = `<h2>Mow Matter news &amp; offers</h2><p>Updates from Mow Matter to you as a business owner. This never contacts your customers.</p>
<form class="form" novalidate><label class="launch-preference"><input name="email" type="checkbox"><span>Email me Mow Matter product news, tips and offers.<small>Optional. Unsubscribe from any email.</small></span></label>
<label class="launch-preference"><input name="sms" type="checkbox"><span>Text me Mow Matter product news and offers.<small>Optional and off unless you select it. By selecting this box, you agree to receive recurring automated marketing texts from Mow Matter at the number below. Consent is not a condition of purchase. Up to 4 messages per month. Message and data rates may apply. Reply HELP for help or STOP to cancel. <a href="https://mowmatter.com/terms#sms">SMS terms</a> · <a href="https://mowmatter.com/privacy#sms">Privacy</a></small></span></label>
<label>Mobile number for texts<input name="phone" type="tel" inputmode="tel" autocomplete="tel" maxlength="20" placeholder="(386) 555-0123"></label>
<p role="status" aria-live="polite"></p><button class="button primary" type="submit">Save news preferences</button></form>`;
    document.getElementById("main").append(card);
    const form = card.querySelector("form"),
      status = form.querySelector("[role=status]");
    try {
      const d = await preferences({});
      form.elements.email.checked = d.email;
      form.elements.sms.checked = d.sms;
      form.elements.phone.value = display(d.phone);
    } catch (e) {
      status.textContent = e.message;
    }
    form.onsubmit = async (e) => {
      e.preventDefault();
      const sms = form.elements.sms.checked,
        p = phone(form.elements.phone.value);
      if (sms && !p) {
        status.textContent = "Enter a US mobile number to receive texts.";
        form.elements.phone.focus();
        return;
      }
      status.textContent = "Saving…";
      try {
        const d = await preferences({ p_email: form.elements.email.checked, p_sms: sms, p_phone: sms ? p : null });
        form.elements.email.checked = d.email;
        form.elements.sms.checked = d.sms;
        status.textContent = "Saved. " + (d.sms ? "Texts go to " + display(d.phone) + ". " : "") + "You can change this anytime.";
      } catch (err) {
        status.textContent = err.message;
      }
    };
  }
  const original = window.showMowBranding;
  if (typeof original !== "function") return;
  window.showMowBranding = async (data) => {
    await original(data);
    if (!document.getElementById("mow-news")) await render();
  };
})();
