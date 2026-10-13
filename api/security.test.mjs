import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
const root=new URL('../',import.meta.url);
function edge(path,{fetcher,client,env={}}={}){
 let handler;const source=stripTypeScriptTypes(readFileSync(new URL(path,root),'utf8').replace(/^import .*;\s*$/gm,''));
 const context={Request,Response,Headers,URLSearchParams,AbortSignal,crypto,TextEncoder,FormData,console:{error(){},warn(){}},createClient:()=>client,normalizeBrand:()=>({}),portalURL:()=>'',invoiceHTML:()=>'',deliverJobEmail:()=>{},fetch:fetcher,Deno:{env:{get:k=>env[k]},serve:h=>handler=h}};
 vm.runInNewContext(source,context);return handler;
}
const capture='supabase/functions/mowmatter-capture/index.ts';
const paths=[capture,'supabase/functions/mowmatter-growth/index.ts','crew/supabase/functions/mowmatter-crew/index.ts','crew/supabase/functions/mowmatter-business/index.ts'];
test('all audited edge functions reject third-party preview origins',async()=>{
 for(const path of paths){const h=edge(path);for(const origin of ['https://mowmatter.steelfurymx.chatgpt.site','https://mowmatter-office.steelfurymx.chatgpt.site','https://mowmatter-crew.steelfurymx.chatgpt.site']){const r=await h(new Request('https://example.invalid',{method:'POST',headers:{Origin:origin}}));assert.equal(r.status,403);assert.notEqual(r.headers.get('access-control-allow-origin'),origin);}}
});
test('directory coordinates ignore a malformed ZIP rather than putting it into filters',async()=>{
 const urls=[];const h=edge(capture,{env:{SUPABASE_ANON_KEY:'test',SUPABASE_SERVICE_ROLE_KEY:'test',SUPABASE_URL:'https://db.invalid'},fetcher:async u=>{urls.push(u);return new Response(u.includes('rate_limit')?'true':'[]');}});
 for(const zip of ['abc{}','123456','123,4']){const r=await h(new Request('https://edge.invalid',{method:'POST',headers:{Origin:'https://mowmatter.com',apikey:'test'},body:JSON.stringify({kind:'directory',zip,latitude:40,longitude:-75})}));assert.equal(r.status,200);const query=new URL(urls.at(-1)).searchParams;assert.equal(query.has('service_zips'),false);assert.equal(query.has('latitude'),true);}
});
function brokenClient(){const q=new Proxy({then(resolve){resolve({error:{code:'42P01',message:'relation secret_customer_table does not exist'}})}},{get(t,k){return k==='then'?t.then:()=>q;}});return {auth:{getUser:async()=>({data:{user:{id:'user',email:'a@b.test',email_confirmed_at:'yes'}}})},from:()=>q,rpc:()=>q};}
test('Crew and Business database errors do not expose Postgres schema',async()=>{
 for(const path of paths.slice(2)){const h=edge(path,{client:brokenClient(),env:{SUPABASE_URL:'https://db.invalid',SUPABASE_SERVICE_ROLE_KEY:'test'}});const r=await h(new Request('https://edge.invalid',{method:'POST',headers:{Origin:'https://office.mowmatter.com',Authorization:'Bearer test'},body:JSON.stringify({action:'list',company_id:'11111111-1111-4111-8111-111111111111'})}));const body=await r.text();assert(!body.includes('secret_customer_table'));assert(!body.includes('42P01'));assert.match(body,/could not be saved/);}
});
test('Growth database errors return a generic response',async()=>{
 const h=edge(paths[1],{env:{SUPABASE_URL:'https://db.invalid',SUPABASE_SERVICE_ROLE_KEY:'test'},fetcher:async u=>u.includes('/auth/')?new Response('{"id":"user"}'):new Response('{"message":"private_relation does not exist","code":"42P01"}',{status:400})});
 const r=await h(new Request('https://edge.invalid',{method:'POST',headers:{Origin:'https://office.mowmatter.com',Authorization:'Bearer test'},body:'{"company_id":"11111111-1111-4111-8111-111111111111","action":"profile"}'}));assert(!JSON.stringify(await r.json()).includes('private_relation'));
});
test('security headers preserve marketing login embedding and deny other framing',()=>{
 for(const host of ['web','office','crew']){const text=readFileSync(new URL(host+'/dist/_headers',root),'utf8');assert.match(text,/X-Content-Type-Options: nosniff/);assert.match(text,/Strict-Transport-Security: max-age=31536000/);if(host==='office'){assert.match(text,/frame-ancestors https:\/\/mowmatter.com https:\/\/www.mowmatter.com/);assert(!text.includes('X-Frame-Options: DENY'));}else assert.match(text,/frame-ancestors 'none'/);assert(!/script-src[^;]*'unsafe-inline'/.test(text));}
});
test('rotating forwarded headers cannot bypass the server-owned submission budget',async()=>{
 let budgetCalls=0,saved=0;
 const h=edge(capture,{env:{SUPABASE_ANON_KEY:'test',SUPABASE_SERVICE_ROLE_KEY:'test',SUPABASE_URL:'https://db.invalid',MOW_CAPTURE_SUBMISSION_HOURLY_LIMIT:'1'},fetcher:async(u,o)=>{
  if(u.includes('rate_limit')){const b=JSON.parse(o.body);if(b.p_key.startsWith('capture:'))return new Response(String(++budgetCalls<=b.p_limit));return new Response('true');}
  if(u.includes('mowmatter_leads')){saved++;return new Response('');}return new Response('[]');
 }});
 const body={kind:'lead',email:'test@example.invalid',early_access_consent:true,elapsed_ms:3000};
 for(const [i,ip]of ['198.51.100.1','198.51.100.2'].entries()){
  const r=await h(new Request('https://edge.invalid',{method:'POST',headers:{Origin:'https://mowmatter.com',apikey:'test','x-forwarded-for':ip},body:JSON.stringify(body)}));assert.equal(r.status,i===0?200:429);
 }assert.equal(saved,1);
});
