export const escape = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function normalizeBrand(value) {
  const b = {};
  for (const [key, max] of Object.entries({
    phone: 30,
    email: 254,
    address: 250,
    website: 250,
    tagline: 100,
    invoice_note: 500,
    invoice_terms: 1500,
  })) {
    if (typeof value[key] !== "string" || value[key].length > max)
      throw Error("Check " + key.replaceAll("_", " "));
    b[key] = value[key].trim();
  }
  for (const key of ["primary", "accent"]) {
    if (!/^#[0-9a-f]{6}$/i.test(value[key]))
      throw Error("Choose valid theme colors");
    b[key] = value[key];
  }
  if (b.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email))
    throw Error("Enter a valid support email");
  if (b.website) {
    const u = new URL(b.website);
    if (u.protocol !== "https:" || u.username || u.password)
      throw Error("Use an HTTPS website");
  }
  b.auto_invoice = value.auto_invoice === true;
  b.auto_send_invoice=value.auto_send_invoice===true;
  b.invoice_reminders=value.invoice_reminders===true;
  return b;
}
export function portalURL(company, customer) {
  return `https://office.mowmatter.com/customer-account.html?business=${encodeURIComponent(company)}&customer=${encodeURIComponent(customer)}`;
}
export function invoiceHTML(invoice, link) {
  const s = invoice.snapshot,
    b = s.branding || {},
    color = /^#[0-9a-f]{6}$/i.test(b.primary) ? b.primary : "#174d36";
  const logo =
    typeof b.logo_url === "string" &&
    b.logo_url.startsWith(
      "https://pzymmsfjgspvzbivzvkx.supabase.co/storage/v1/object/public/mow-business-logos/",
    )
      ? `<img src="${escape(b.logo_url)}" alt="${escape(s.business)} logo" style="max-width:180px;max-height:80px;object-fit:contain">`
      : "";
  const amount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(invoice.amount_cents / 100);
  return `<article class="invoice-document" style="border-top:6px solid ${color};padding:24px;background:white;color:#172820">${logo}<h1>${escape(s.business)}</h1><p>${escape(b.tagline)}</p><p>${escape(b.address)}<br>${escape(b.phone)} · ${escape(b.email)}</p><hr><h2>Invoice MM-${escape(invoice.number)}</h2><p>Issued ${escape(invoice.created_at.slice(0, 10))}</p><p><b>Bill to: ${escape(s.customer)}</b><br>${escape(s.address)}</p><table style="width:100%;text-align:left"><thead><tr><th>Service</th><th>Date</th><th>Amount</th></tr></thead><tbody><tr><td>${escape((s.services || []).join(", "))}</td><td>${escape(s.service_date)}</td><td>${escape(amount)}</td></tr></tbody></table><h2>Invoice total: ${escape(amount)}</h2><p>Payment status is tracked separately. This invoice is not a receipt.</p><p>${escape(b.invoice_note)}</p><p style="white-space:pre-wrap">${escape(b.invoice_terms)}</p><p><a href="${escape(link)}">Manage your account</a></p><footer style="margin-top:32px;border-top:1px solid #ddd;padding-top:16px"><img src="https://office.mowmatter.com/brand-icon.png" alt="" width="28" height="28" style="vertical-align:middle;margin-right:8px"><small>Powered by <b>MowMatter</b></small></footer></article>`;
}
