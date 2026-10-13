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
  // Single-column, inline-styled layout also works in email clients without media queries.
  const label = "margin:0 0 4px;font-size:13px;font-weight:700;color:#52665a";
  const value = "margin:0 0 20px;font-size:16px;line-height:1.6;overflow-wrap:anywhere;word-break:break-word";
  const contact = [b.phone, b.email].filter(Boolean).map(escape).join(" · ");
  return `<article class="invoice-document" style="box-sizing:border-box;width:100%;max-width:640px;margin:0 auto;border-top:6px solid ${color};padding:20px;background:white;color:#172820;font:16px/1.6 Arial,Helvetica,sans-serif;overflow-wrap:anywhere;word-break:break-word">
${logo}
<h1 style="margin:12px 0;font-size:26px;line-height:1.25">${escape(s.business)}</h1>
${b.tagline ? `<p style="${value}">${escape(b.tagline)}</p>` : ""}
<p style="${value}">${escape(b.address)}${b.address && contact ? "<br>" : ""}${contact}</p>
<hr style="border:0;border-top:1px solid #dce5df;margin:24px 0">
<h2 style="margin:0 0 8px;font-size:24px;line-height:1.3">Invoice MM-${escape(invoice.number)}</h2>
<p style="${value}">Issued ${escape(invoice.created_at.slice(0, 10))}</p>
<dl style="margin:0">
<dt style="${label}">Bill to</dt><dd style="${value}"><b>${escape(s.customer)}</b><br>${escape(s.address)}</dd>
<dt style="${label}">Service</dt><dd style="${value}">${escape((s.services || []).join(", "))}</dd>
<dt style="${label}">Service date</dt><dd style="${value}">${escape(s.service_date)}</dd>
</dl>
<div style="border-top:1px solid #dce5df;border-bottom:1px solid #dce5df;padding:18px 0;margin:24px 0"><p style="${label}">Invoice total</p><p style="margin:0;font-size:28px;line-height:1.3;font-weight:700">${escape(amount)}</p></div>
<p style="${value}">Payment status is tracked separately. This invoice is not a receipt.</p>
<p style="${value}">${escape(b.invoice_note)}</p>
<p style="${value};white-space:pre-wrap">${escape(b.invoice_terms)}</p>
<p style="margin:24px 0"><a href="${escape(link)}" style="display:block;padding:14px 16px;border-radius:8px;background:#174d36;color:#ffffff;text-align:center;text-decoration:none;font-weight:700;line-height:1.5">Manage your account</a></p>
<footer style="margin-top:32px;border-top:1px solid #ddd;padding-top:16px"><img src="https://office.mowmatter.com/brand-icon.png" alt="" width="28" height="28" style="vertical-align:middle;margin-right:8px"><small>Powered by <b>MowMatter</b></small></footer></article>`;
}

export function invoiceEmailHTML(invoice, link, reminder = false) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Invoice MM-${escape(invoice.number)}</title></head><body style="margin:0;padding:12px;background:#f3f7f4;font:16px/1.6 Arial,Helvetica,sans-serif;color:#172820">${reminder ? '<p style="max-width:640px;margin:0 auto 16px">This is a reminder for your outstanding invoice. If you recently paid, contact your provider before paying again.</p>' : ''}${invoiceHTML(invoice, link)}</body></html>`;
}
