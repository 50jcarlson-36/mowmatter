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
  const defaults = {
    primary: "#174d36",
    accent: "#c4f500",
    phone: "",
    email: "",
    address: "",
    website: "",
    tagline: "",
    invoice_note: "Thank you for choosing us for your lawn care.",
    invoice_terms: "",
    auto_invoice: false,
    auto_send_invoice:false,invoice_reminders:false,
    logo_url: "",
  };
  const endpoint =
    "https://pzymmsfjgspvzbivzvkx.supabase.co/functions/v1/mowmatter-business";
  async function request(body) {
    const session = await MM.ensureSession(),
      isForm = body instanceof FormData;
    const r = await fetch(endpoint, {
      method: "POST",
      headers: {
        apikey: "sb_publishable_KQGD-vWlAlJi_Bv7fSaEvA_YLJpIgyu",
        Authorization: "Bearer " + session.access_token,
        ...(isForm ? {} : { "Content-Type": "application/json" }),
      },
      body: isForm ? body : JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
    const d = await r.json();
    if (!r.ok) throw Error(d.error || "Unable to connect");
    return d;
  }
  const portal = (company, customer) =>
    location.origin +
    "/customer-account.html?" +
    new URLSearchParams({ business: company, customer });
  function contrast(hex) {
    const rgb = hex
        .slice(1)
        .match(/../g)
        .map((x) => parseInt(x, 16) / 255)
        .map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)),
      l = rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
    return (l + 0.05) / 0.05 > 1.05 / (l + 0.05) ? "#000000" : "#ffffff";
  }
  function badge() {
    return '<img class="powered-mark" src="powered-by-mowmatter.svg" alt="Powered by MowMatter" width="210" height="48">';
  }
  function safeLogo(url) {
    return typeof url === "string" &&
      url.startsWith(
        "https://pzymmsfjgspvzbivzvkx.supabase.co/storage/v1/object/public/mow-business-logos/",
      )
      ? url
      : "";
  }
  function preview(name, b) {
    return `<div class="brand-preview" style="border-top:6px solid ${b.primary}">${safeLogo(b.logo_url) ? `<img class="business-logo" src="${esc(b.logo_url)}" alt="${esc(name)} logo">` : ""}<h2>${esc(name)}</h2><p>${esc(b.tagline)}</p><p>${esc(b.address)}<br>${esc(b.phone)} · ${esc(b.email)}</p><hr><p class="eyebrow">INVOICE PREVIEW · SAMPLE</p><h3>Lawn care service</h3><p>Sample customer · 742 Oak Ridge Drive</p><h2>$50.00</h2><p>${esc(b.invoice_note)}</p><p class="invoice-terms">${esc(b.invoice_terms)}</p><span class="brand-button" style="background:${b.primary};color:${contrast(b.primary)};border-bottom:4px solid ${b.accent}">Manage your account</span>${badge()}</div>`;
  }
  window.showMowBranding = async (data) => {
    const main = document.getElementById("main");
    main.innerHTML =
      '<section class="card"><h1>Make it your business.</h1><p role="status">Loading your branding…</p></section>';
    try {
      const d = await request({ action: "get", company_id: data.company.id }),
        b = { ...defaults, ...d.company.branding };
      main.innerHTML = `<div class="page-head"><div><p class="eyebrow">BUSINESS SETTINGS</p><h1>Your brand. Everywhere.</h1><p>Set up once for your customer account, invoices and service emails.</p></div></div><div class="split brand-settings"><section class="card"><h2>Business identity</h2><form id="branding-form" class="form"><label>Business name<input name="name" required minlength="2" maxlength="120" value="${esc(d.company.name)}"></label><label>Company logo<input id="brand-logo" type="file" accept="image/png,image/jpeg,image/webp"></label><p class="help">PNG, JPG or WebP · Up to 2 MB. A transparent PNG works best. Your logo keeps its proportions.</p><div class="actions"><button type="button" id="upload-logo" class="button">Upload logo</button><button type="button" id="remove-logo" class="button">Remove logo</button></div><p id="logo-status" role="status"></p><div class="split"><label>Primary color<input name="primary" type="color" value="${b.primary}"></label><label>Accent color<input name="accent" type="color" value="${b.accent}"></label></div><p class="help">Button text automatically uses black or white for readability.</p>${[
        ["tagline", "Tagline", 100],
        ["phone", "Phone", 30],
        ["email", "Support email", 254],
        ["address", "Business address", 250],
        ["website", "Website (https://)", 250],
      ]
        .map(
          ([key, label, max]) =>
            `<label>${label}<input name="${key}" type="${key === "email" ? "email" : key === "website" ? "url" : "text"}" maxlength="${max}" value="${esc(b[key])}"></label>`,
        )
        .join(
          "",
        )}<h2>Invoice preferences</h2><label>Thank-you message<textarea name="invoice_note" maxlength="500">${esc(b.invoice_note)}</textarea></label><label>Payment terms / service notes<textarea name="invoice_terms" maxlength="1500">${esc(b.invoice_terms)}</textarea></label><label><input name="auto_invoice" type="checkbox" ${b.auto_invoice ? "checked" : ""}> Automatically create invoices when visits are completed</label><p class="help">Applies to future completed visits with a customer and a price. Existing invoices keep their issued branding. This does not charge a card or enable automatic payment.</p><label><input name="auto_send_invoice" type="checkbox" ${b.auto_send_invoice?"checked":""}> Automatically email newly generated invoices</label><label><input name="invoice_reminders" type="checkbox" ${b.invoice_reminders?"checked":""}> Send up to two outstanding-payment reminders, 7 and 14 days after the due date</label><p class="help">Invoice due date defaults to 14 days after issue. Requires customer email permission. Paid, void, externally settled, canceled and recurring-plan visits are excluded. Provider acceptance is not proof of inbox delivery.</p><p id="branding-status" role="status" aria-live="polite"></p><button class="button primary">Save branding</button></form></section><section class="card"><h2>Customer preview</h2><p class="help">Your business leads. MowMatter appears in the footer.</p><div id="brand-preview"></div></section></div><section class="card"><h2>Customer account links</h2><p>Copy a customer's unique link into your email or text. They sign in with the verified email saved on their customer record.</p><ul class="job-list">${data.customers.map((c) => `<li><div><b>${esc(c.name)}</b><small>${esc(c.email || "Add an email in Customers before sharing")}</small><input aria-label="Account link for ${esc(c.name)}" readonly value="${esc(portal(data.company.id, c.id))}"></div></li>`).join("") || "<li>Add a customer to create their account link.</li>"}</ul></section>`;
      const form = document.getElementById("branding-form");
      const values = () => {
        const f = new FormData(form);
        return {
          ...b,
          ...Object.fromEntries(f),
          auto_invoice: f.get("auto_invoice") === "on",
          auto_send_invoice:f.has("auto_send_invoice"),invoice_reminders:f.has("invoice_reminders"),
        };
      };
      const paint = () =>
        (document.getElementById("brand-preview").innerHTML = preview(
          form.elements.name.value,
          values(),
        ));
      form.oninput = paint;
      paint();
      form.onsubmit = async (e) => {
        e.preventDefault();
        const button = e.submitter,
          msg = document.getElementById("branding-status");
        button.disabled = true;
        try {
          await request({
            action: "save",
            company_id: data.company.id,
            name: form.elements.name.value,
            branding: values(),
          });
          document.getElementById("business-name").textContent =
            form.elements.name.value;
          msg.textContent = "Branding saved across your business.";
        } catch (err) {
          msg.textContent = err.message;
        } finally {
          button.disabled = false;
        }
      };
      for (const [id, action] of [
        ["upload-logo", "logo"],
        ["remove-logo", "remove_logo"],
      ])
        document.getElementById(id).onclick = async (e) => {
          const button = e.currentTarget,
            msg = document.getElementById("logo-status");
          button.disabled = true;
          try {
            let payload = { action, company_id: data.company.id };
            if (action === "logo") {
              const file = document.getElementById("brand-logo").files[0];
              if (
                !file ||
                file.size > 2097152 ||
                !["image/png", "image/jpeg", "image/webp"].includes(file.type)
              )
                throw Error("Choose a PNG, JPG or WebP under 2 MB");
              payload = new FormData();
              payload.set("file", file);
              payload.set("company_id", data.company.id);
            }
            const r = await request(payload);
            b.logo_url = r.logo_url || "";
            paint();
            msg.textContent =
              action === "logo" ? "Logo uploaded and saved." : "Logo removed.";
          } catch (err) {
            msg.textContent = err.message;
          } finally {
            button.disabled = false;
          }
        };
    } catch (err) {
      main.innerHTML =
        '<section class="card"><h1>Branding unavailable</h1><p role="alert"></p></section>';
      main.querySelector("p").textContent = err.message;
    }
  };
  function showInvoice(i) {
    const dialog = document.getElementById("dialog"),
      content = document.getElementById("dialog-content");
    content.innerHTML = `<div class="invoice-actions"><button class="button primary" id="print-invoice">Print / Save PDF</button></div>${i.html}`;
    document.getElementById("print-invoice").onclick = () => window.print();
    dialog.showModal();
  }
  window.showMowInvoices = async (data) => {
    let target = document.getElementById("customer-invoices");
    if (!target) {
      target = document.createElement("section");
      target.id = "customer-invoices";
      target.className = "card";
      document.getElementById("main").append(target);
    }
    try {
      const d = await request({ action: "get", company_id: data.company.id });
      target.innerHTML = `<h2>Customer invoices</h2><p>Generate an invoice for completed work, or turn on automatic generation in <a href="settings.html">Business settings</a>. Customers can view and save their invoices from their account link.</p><form id="generate-invoice" class="form"><label>Completed visit<select name="job_id" required><option value="">Choose a visit</option>${data.jobs
        .filter(
          (j) =>
            j.status === "completed" &&
            !j.cancelled_at &&
            j.customer_id &&
            j.price_cents > 0,
        )
        .map(
          (j) =>
            `<option value="${esc(j.id)}">${esc(j.customer_name)} · ${esc(j.service_date)}</option>`,
        )
        .join(
          "",
        )}</select></label><button class="button">Generate invoice</button><p role="status"></p></form><ul class="job-list">${d.invoices.map((i) => `<li><div><b>MM-${i.number} · ${esc(i.snapshot.customer)}</b><small>${esc(i.created_at.slice(0, 10))} · $${(i.amount_cents / 100).toFixed(2)}</small><small>${esc(i.settlement_status||"open")} · Due ${esc(i.due_at?.slice(0,10)||"Not specified")}</small></div><button class="button" data-settlement="${i.id}">Record settlement / void</button><button class="button" data-invoice="${i.id}">View invoice</button><button class="button" data-send-invoice="${i.id}" ${i.email_status === "sent" || i.email_status === "sending" ? "disabled" : ""}>${i.email_status === "sent" ? "Email accepted" : "Send invoice email"}</button></li>`).join("") || "<li>No customer invoices yet.</li>"}</ul>`;
      target
        .querySelectorAll("[data-invoice]")
        .forEach(
          (el) =>
            (el.onclick = () =>
              showInvoice(d.invoices.find((i) => i.id === el.dataset.invoice))),
        );
      target.querySelectorAll('[data-settlement]').forEach(button=>button.onclick=()=>{
        const invoice=d.invoices.find(i=>i.id===button.dataset.settlement);const dialog=document.getElementById('dialog');document.getElementById('dialog-content').innerHTML=`<h2>Invoice MM-${invoice.number}</h2><form id="invoice-settlement" class="form"><label>Record state<select name="status"><option value="paid_external">Paid outside MowMatter</option><option value="void">Void invoice</option><option value="open">Reopen invoice</option></select></label><label>Reason / payment reference<input name="note" required minlength="3" maxlength="500"></label><p>This changes the invoice record and reminder eligibility. It does not charge, refund or cancel a Stripe payment.</p><button class="button primary">Save record</button><p role="status"></p></form>`;dialog.showModal();document.getElementById('invoice-settlement').onsubmit=async e=>{e.preventDefault();e.submitter.disabled=true;try{await request({action:'settlement',company_id:data.company.id,invoice_id:invoice.id,...Object.fromEntries(new FormData(e.target))});dialog.close();await window.showMowInvoices(data)}catch(err){e.target.querySelector('[role=status]').textContent=err.message;e.submitter.disabled=false}};
      });
      target.querySelectorAll("[data-send-invoice]").forEach(
        (el) =>
          (el.onclick = async () => {
            el.disabled = true;
            try {
              await request({
                action: "send_invoice",
                company_id: data.company.id,
                invoice_id: el.dataset.sendInvoice,
              });
              await window.showMowInvoices(data);
            } catch (err) {
              target.querySelector('[role="status"]').textContent = err.message;
              el.disabled = false;
            }
          }),
      );
      target.querySelector("form").onsubmit = async (e) => {
        e.preventDefault();
        const button = e.submitter;
        button.disabled = true;
        try {
          await request({
            action: "generate",
            company_id: data.company.id,
            job_id: new FormData(e.target).get("job_id"),
          });
          await window.showMowInvoices(data);
        } catch (err) {
          e.target.querySelector('[role="status"]').textContent = err.message;
        } finally {
          button.disabled = false;
        }
      };
    } catch (err) {
      target.textContent = "Customer invoices unavailable: " + err.message;
    }
  };
  window.MowBusiness = { request, portal, contrast, badge, showInvoice };
})();
