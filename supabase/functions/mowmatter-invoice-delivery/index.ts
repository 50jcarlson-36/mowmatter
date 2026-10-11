import {createClient} from 'npm:@supabase/supabase-js@2.102.0';
import {invoiceHTML,portalURL} from './model.mjs';
const allowed=new Set(['https://office.mowmatter.com','https://mowmatter-office.onrender.com']);
Deno.serve(async(req)=>{
 const origin=req.headers.get('origin')||'',headers={'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':allowed.has(origin)?origin:'https://office.mowmatter.com','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Vary':'Origin'};
 const out=(s:number,d:unknown)=>new Response(JSON.stringify(d),{status:s,headers});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return out(405,{error:'POST required'});
 try{
 const secret=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}').default||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,db=createClient(Deno.env.get('SUPABASE_URL')!,secret,{auth:{persistSession:false,autoRefreshToken:false}});
 const checked=async(q:any)=>{const r=await q;if(r.error)throw Error('Invoice database action could not finish');return r.data};
 const service=[secret,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')].filter(Boolean).includes(req.headers.get('apikey')||'');
 if(!service&&!allowed.has(origin))return out(403,{error:'Origin not allowed'});
 const raw=await req.text();if(raw.length>4096)return out(413,{error:'Too large'});const b=JSON.parse(raw);
 let cid=b.company_id,manual=!service;
 if(manual){const {data:{user},error}=await db.auth.getUser((req.headers.get('authorization')||'').replace(/^Bearer\s+/i,''));if(error||!user?.email_confirmed_at)return out(401,{error:'Verified owner required'});const member=await checked(db.from('mow_crew_members').select('role').eq('company_id',cid).eq('user_id',user.id).maybeSingle());if(member?.role!=='owner')return out(403,{error:'Owner access required'});}
 const key=Deno.env.get('RESEND_API_KEY');if(!key)return out(503,{error:'Invoice email provider is not configured'});
 let query=db.from('mow_customer_invoices').select('*').eq('settlement_status','open').order('created_at',{ascending:true}).limit(manual?1:100);
 if(manual){if(typeof b.invoice_id!=='string')return out(400,{error:'Choose an invoice'});query=query.eq('company_id',cid).eq('id',b.invoice_id)}
 const invoices=service?await checked(db.rpc('mow_invoice_delivery_candidates')):await checked(query);let sent=0,held=0,review=0;
 for(const i of invoices){
  const company=await checked(db.from('mow_crew_companies').select('branding').eq('id',i.company_id).single());
  const stage=manual?0:i.email_status!=='sent'?0:Date.now()>=Date.parse(i.due_at)+14*86400000?2:1;
  if(!manual&&(stage===0?company.branding?.auto_send_invoice!==true:company.branding?.invoice_reminders!==true)){held++;continue}
  const claimed=await checked(db.rpc('mow_invoice_delivery_claim',{iid:i.id,stage,cid:i.company_id,manual}));if(!claimed){held++;continue}
  let providerId=null;
  try{
   const customer=await checked(db.from('mow_customers').select('email').eq('id',i.customer_id).eq('company_id',i.company_id).single());
   const link=portalURL(i.company_id,i.customer_id),subject=(stage?'Payment reminder: ':'Invoice ')+`MM-${i.number} — ${i.snapshot.business}`;
   const html=(stage?'<p>This is a reminder for your outstanding invoice. If you recently paid, contact your provider before paying again.</p>':'')+invoiceHTML(i,link);
   const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json','Idempotency-Key':stage?'mowmatter-invoice-'+i.id+'-reminder-'+stage:'mowmatter-invoice-'+i.id},body:JSON.stringify({from:'MowMatter <noreply@mowmatter.com>',to:[customer.email],...(i.snapshot.branding?.email?{reply_to:i.snapshot.branding.email}:{}),subject,html,text:`${stage?'Payment reminder. ':''}Invoice MM-${i.number}: $${(i.amount_cents/100).toFixed(2)}. Review and pay in your account: ${link}`}),signal:AbortSignal.timeout(10000)});
   if(response.ok)providerId=(await response.json()).id;
  }catch{}
  const status=providerId?'sent':'needs_review';await checked(db.from('mow_invoice_deliveries').update({status,provider_id:providerId}).eq('invoice_id',i.id).eq('step',stage));
  if(stage===0&&providerId)await checked(db.from('mow_customer_invoices').update({email_status:'sent'}).eq('id',i.id));
  if(providerId)sent++;else review++;
  if(sent+review>=10)break;
 }
 return out(review?502:200,{ok:review===0,sent,held,needs_review:review});
 }catch{return out(503,{error:'Invoice delivery could not finish. Review delivery status before retrying.'})}
});
