const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function jobEmail(company, job, action) {
  const completed = action === 'complete';
  const heading = completed ? 'Your yard is ready to enjoy.' : 'Your lawn is getting some love.';
  const message = completed ? `${company} has finished your lawn care.` : `${company} has started your lawn care. We’ll send another update when the work is complete.`;
  return {
    subject: `${completed ? 'All handled' : 'We’re getting started'} — ${company}`,
    text: `${heading}\n${message}\nProperty: ${job.address}\nService date: ${job.service_date}\nFor questions or changes, contact your lawn care company.\nSent by Mow Matter on behalf of ${company}.`,
    html: `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;background:#f2f5ef;color:#06291f;font-family:Arial,Helvetica,sans-serif"><table role="presentation" width="100%"><tr><td align="center" style="padding:28px 12px"><table role="presentation" width="560" style="width:100%;max-width:560px;background:white;border-radius:20px;overflow:hidden" cellspacing="0"><tr><td style="padding:30px;background:#06291f;color:#d2ff00;font-size:30px;font-weight:900">Mow<span style="color:white">Matter</span><p style="font-size:12px;letter-spacing:2px">EVERYTHING YOUR YARD NEEDS. HANDLED.</p></td></tr><tr><td style="padding:32px"><p style="font-size:13px;font-weight:bold;color:#17664e">${escape(company)}</p><h1 style="font-size:28px;line-height:1.2">${heading}</h1><p style="font-size:16px;line-height:1.7">${escape(message)}</p><div style="padding:20px;background:#f2f5ef;border-left:5px solid #d2ff00"><strong>${escape(job.address)}</strong><p>Service date: ${escape(job.service_date)}</p></div><p style="font-size:14px;line-height:1.6">For questions or changes, contact your lawn care company.</p></td></tr><tr><td style="padding:22px 32px;border-top:1px solid #e5ece7;font-size:12px;color:#62756d">A service update from ${escape(company)}, powered by Mow Matter. To change your service notification preferences, contact your lawn care company.</td></tr></table></td></tr></table></body></html>`
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
