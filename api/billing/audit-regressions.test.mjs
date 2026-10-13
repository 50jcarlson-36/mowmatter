import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {createBilling} from './billing.mjs';
const cid='11111111-1111-4111-8111-111111111111',customer='22222222-2222-4222-8222-222222222222';
async function call(handle,path,body){const s=http.createServer(handle);await new Promise(r=>s.listen(0,'127.0.0.1',r));try{const r=await fetch('http://127.0.0.1:'+s.address().port+path,{method:'POST',headers:{Origin:'https://office.mowmatter.com',Authorization:'Bearer test'},body:JSON.stringify(body)});return {status:r.status,body:await r.json()};}finally{await new Promise(r=>s.close(r));}}
test('owner billing refuses missing or malformed business before membership lookup',async()=>{
 let lookups=0;const h=createBilling({env:{SUPABASE_SECRET_KEY:'fake'},fetcher:async u=>{if(u.includes('mow_crew_members'))lookups++;return new Response(JSON.stringify({id:'user'}));}});
 for(const company_id of [undefined,'bad','11111111-1111-4111-8111-111111111111&role=eq.owner'])assert.equal((await call(h,'/api/billing/status',{company_id})).status,400);
 assert.equal(lookups,0);
});
test('owner billing queries only the explicitly selected business',async()=>{
 let membership='';const h=createBilling({env:{SUPABASE_SECRET_KEY:'fake'},fetcher:async u=>{if(u.includes('/auth/'))return new Response('{"id":"user"}');if(u.includes('mow_crew_members')){membership=u;return new Response('[]');}return new Response('[]');}});
 assert.equal((await call(h,'/api/billing/status',{company_id:cid})).status,403);assert(membership.includes('company_id=eq.'+cid));
});
test('invoice status retrieves the connected account exactly once',async()=>{
 let calls=0;
 const stripeClient={accounts:{retrieve:async()=>({id:'acct_1UNcR11fvEozmSlD',charges_enabled:true})},v2:{core:{accounts:{retrieve:async()=>{
  calls++;return {id:'acct_operator',configuration:{merchant:{capabilities:{card_payments:{status:'active'},stripe_balance:{payouts:{status:'active'}}}}}};
 }}}}};
 const h=createBilling({env:{SUPABASE_SECRET_KEY:'fake',STRIPE_CONNECT_ENABLED:'true',STRIPE_CONNECT_WEBHOOK_SECRET:'test'},stripeClient,fetcher:async u=>new Response(JSON.stringify(u.includes('/auth/')?{id:'user',email:'test@example.invalid',email_confirmed_at:'yes'}:u.includes('mow_customers?')?[{id:customer,email:'test@example.invalid'}]:u.includes('mow_billing_accounts')?[{customer_id:'acct_operator'}]:[]))});
 const r=await call(h,'/api/billing/invoice-status',{company_id:cid,customer_id:customer});assert.equal(r.status,200);assert.equal(r.body.payments_enabled,true);assert.equal(calls,1);
});
