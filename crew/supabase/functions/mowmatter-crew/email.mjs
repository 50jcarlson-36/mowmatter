import {
  invoiceHTML,
  portalURL,
  escape as brandEscape,
} from "../mowmatter-business/model.mjs";
import { emailShell } from "./email-brand.mjs";
const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function jobEmail(company, job, action) {
  const completed = action === "complete";
  const heading = completed
    ? "Your yard is ready to enjoy."
    : "Your lawn is getting some love.";
  const message = completed
    ? `${company} has finished your lawn care.`
    : `${company} has started your lawn care. We’ll send another update when the work is complete.`;
  return {
    subject: `${completed ? "All handled" : "We’re getting started"} — ${company}`,
    text: `${heading}\n${message}\nProperty: ${job.address}\nService date: ${job.service_date}\nFor questions or changes, contact your lawn care company.\nSent by Mow Matter on behalf of ${company}.`,
    html: emailShell(
      `<p class="copy" style="font-size:13px;font-weight:700;color:#527063">${escape(company)}</p><h1 class="title" style="font-size:32px;line-height:1.15;letter-spacing:-.8px;margin:0 0 18px;color:#06251b">${heading}</h1><p class="copy" style="font-size:16px;line-height:1.65;color:#527063">${escape(message)}</p><div class="detail copy" style="padding:20px;background:#f7f9f3;border-left:4px solid #c4f500;color:#06251b"><strong>${escape(job.address)}</strong><p style="margin-bottom:0">Service date: ${escape(job.service_date)}</p></div><p class="muted" style="font-size:14px;line-height:1.6;color:#527063;margin-top:24px">For questions or changes, contact your lawn care company.</p>`,
      `A service update from ${escape(company)}, powered by Mow Matter. To change your service notification preferences, contact your lawn care company.`,
    ),
  };
}

// Caller has already authenticated and authorized company access. Never use a
// browser-supplied destination or message. Historical records are not replayed.
export async function deliverJobEmail(
  db,
  companyId,
  eventId,
  apiKey,
  send = fetch,
) {
  const query = async (q) => {
    const r = await q;
    if (r.error) throw Error("Email record unavailable");
    return r.data;
  };
  const n = await query(
    db
      .from("mow_crew_notifications")
      .select("*")
      .eq("company_id", companyId)
      .eq("event_id", eventId)
      .maybeSingle(),
  );
  if (!n) return null;
  if (!["pending_provider", "failed"].includes(n.status) || !apiKey)
    return n.status;
  // Resend's idempotency protection lasts 24h. Never retry beyond that window.
  if (Date.now() - Date.parse(n.created_at) > 23 * 3600000) return n.status;
  const job = await query(
    db
      .from("mow_crew_jobs")
      .select("*")
      .eq("company_id", companyId)
      .eq("id", n.job_id)
      .maybeSingle(),
  );
  if (!job || job.cancelled_at) return n.status;
  if (!job.notification_consent) {
    await query(
      db
        .from("mow_crew_notifications")
        .update({ status: "held_no_consent" })
        .eq("id", n.id),
    );
    return "held_no_consent";
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(job.customer_email || "")) {
    await query(
      db
        .from("mow_crew_notifications")
        .update({ status: "held_no_contact" })
        .eq("id", n.id),
    );
    return "held_no_contact";
  }
  const event = await query(
    db
      .from("mow_crew_events")
      .select("action")
      .eq("id", eventId)
      .eq("job_id", job.id)
      .maybeSingle(),
  );
  if (!event || !["start", "complete"].includes(event.action)) return n.status;
  const company = await query(
    db
      .from("mow_crew_companies")
      .select("id,name,branding")
      .eq("id", companyId)
      .single(),
  );
  const mail = jobEmail(company.name, job, event.action);
  const b = company.branding || {},
    link = job.customer_id ? portalURL(company.id, job.customer_id) : null;
  const invoice =
    event.action === "complete"
      ? await query(
          db
            .from("mow_customer_invoices")
            .select("*")
            .eq("company_id", companyId)
            .eq("job_id", job.id)
            .maybeSingle(),
        )
      : null;
  if (invoice && link) {
    mail.subject = `Your lawn care invoice MM-${invoice.number} — ${company.name}`;
    mail.html = invoiceHTML(invoice, link);
    mail.text += `\nInvoice MM-${invoice.number}: $${(invoice.amount_cents / 100).toFixed(2)}\nManage your account: ${link}`;
  } else {
    const color = /^#[0-9a-f]{6}$/i.test(b.primary) ? b.primary : "#174d36";
    const logo =
      typeof b.logo_url === "string" &&
      b.logo_url.startsWith(
        "https://pzymmsfjgspvzbivzvkx.supabase.co/storage/v1/object/public/mow-business-logos/",
      )
        ? `<img src="${brandEscape(b.logo_url)}" alt="${brandEscape(company.name)} logo" style="max-width:180px;max-height:80px">`
        : "";
    mail.html = `<div style="padding:24px;border-top:6px solid ${color}">${logo}<h1>${brandEscape(company.name)}</h1><p>${brandEscape(b.tagline)}</p><h2>${event.action === "complete" ? "Your yard is ready." : "Your service has started."}</h2><p>${brandEscape(job.address)} · ${brandEscape(job.service_date)}</p><p>${brandEscape(b.phone)} · ${brandEscape(b.email)}</p>${link ? `<p><a href="${brandEscape(link)}">Manage your account</a></p>` : ""}<p>Powered by <b>MowMatter</b></p></div>`;
    if (link) mail.text += `\nManage your account: ${link}`;
  }

  let status = "failed";
  try {
    const response = await send("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": invoice
          ? `mowmatter-invoice-${invoice.id}`
          : `mowmatter-job-${eventId}`,
      },
      body: JSON.stringify({
        from: "Mow Matter <noreply@mowmatter.com>",
        to: [job.customer_email],
        ...(b.email ? { reply_to: b.email } : {}),
        ...mail,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (response.ok && (await response.json()).id) status = "sent";
  } catch {
    /* Keep failed in the durable notification record; job work succeeds. */
  }
  await query(
    db
      .from("mow_crew_notifications")
      .update({ status, channel: "email" })
      .eq("id", n.id),
  );
  if (invoice)
    await query(
      db
        .from("mow_customer_invoices")
        .update({
          email_status: status === "sent" ? "sent" : "failed",
          email_attempt_at:
            invoice.email_attempt_at || new Date().toISOString(),
        })
        .eq("id", invoice.id)
        .eq("company_id", companyId),
    );
  return status; // "sent" means accepted by Resend, not inbox delivery.
}
