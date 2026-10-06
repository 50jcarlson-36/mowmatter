import { emailShell } from './email-brand.mjs';
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function jobEmail(company, job, action) {
  const completed = action === 'complete';
  const heading = completed ? 'Your yard is ready to enjoy.' : 'Your lawn is getting some love.';
  const message = completed ? `${company} has finished your lawn care.` : `${company} has started your lawn care. We’ll send another update when the work is complete.`;
  return {
    subject: `${completed ? 'All handled' : 'We’re getting started'} — ${company}`,
    text: `${heading}\n${message}\nProperty: ${job.address}\nService date: ${job.service_date}\nFor questions or changes, contact your lawn care company.\nSent by Mow Matter on behalf of ${company}.`,
    html: emailShell(`<p class="copy" style="font-size:13px;font-weight:700;color:#527063">${escape(company)}</p><h1 class="title" style="font-size:32px;line-height:1.15;letter-spacing:-.8px;margin:0 0 18px;color:#06251b">${heading}</h1><p class="copy" style="font-size:16px;line-height:1.65;color:#527063">${escape(message)}</p><div class="detail copy" style="padding:20px;background:#f7f9f3;border-left:4px solid #c4f500;color:#06251b"><strong>${escape(job.address)}</strong><p style="margin-bottom:0">Service date: ${escape(job.service_date)}</p></div><p class="muted" style="font-size:14px;line-height:1.6;color:#527063;margin-top:24px">For questions or changes, contact your lawn care company.</p>`, `A service update from ${escape(company)}, powered by Mow Matter. To change your service notification preferences, contact your lawn care company.`)
  };
}

// Caller has already authenticated and authorized company access. Never use a
// browser-supplied destination or message. Historical records are not replayed.
export async function deliverJobEmail(db, companyId, eventId, apiKey, send = fetch) {
  const query = async q => { const r = await q; if (r.error) throw Error('Email record unavailable'); return r.data; };
  const n = await query(db.from('mow_crew_notifications').select('*').eq('company_id',companyId).eq('event_id',eventId).maybeSingle());
  if (!n) return null;
  if (!['pending_provider','failed'].includes(n.status) || !apiKey) return n.status;
  // Resend's idempotency protection lasts 24h. Never retry beyond that window.
  if (Date.now() - Date.parse(n.created_at) > 23 * 3600000) return n.status;
  const job = await query(db.from('mow_crew_jobs').select('*').eq('company_id',companyId).eq('id',n.job_id).maybeSingle());
  if (!job || job.cancelled_at) return n.status;
  if (!job.notification_consent) { await query(db.from('mow_crew_notifications').update({status:'held_no_consent'}).eq('id',n.id)); return 'held_no_consent'; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(job.customer_email || '')) { await query(db.from('mow_crew_notifications').update({status:'held_no_contact'}).eq('id',n.id)); return 'held_no_contact'; }
  const event = await query(db.from('mow_crew_events').select('action').eq('id',eventId).eq('job_id',job.id).maybeSingle());
  if (!event || !['start','complete'].includes(event.action)) return n.status;
  const company = await query(db.from('mow_crew_companies').select('name').eq('id',companyId).single());
  const mail = jobEmail(company.name,job,event.action);
  let status = 'failed';
  try {
    const response = await send('https://api.resend.com/emails', {method:'POST',headers:{'Authorization':`Bearer ${apiKey}`,'Content-Type':'application/json','Idempotency-Key':`mowmatter-job-${eventId}`},body:JSON.stringify({from:'Mow Matter <noreply@mowmatter.com>',to:[job.customer_email],...mail}),signal:AbortSignal.timeout(10000)});
    if (response.ok && (await response.json()).id) status = 'sent';
  } catch { /* Keep failed in the durable notification record; job work succeeds. */ }
  await query(db.from('mow_crew_notifications').update({status,channel:'email'}).eq('id',n.id));
  return status; // "sent" means accepted by Resend, not inbox delivery.
}
