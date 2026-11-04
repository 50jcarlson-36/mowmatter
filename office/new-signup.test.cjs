const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const {JSDOM,VirtualConsole}=require('../api/node_modules/jsdom');const {webcrypto}=require('node:crypto');
const source=fs.readFileSync(__dirname+'/dist/mm-client.js','utf8');
function page(url,setup,reply){const dom=new JSDOM('<main></main>',{url,runScripts:'outside-only',virtualConsole:new VirtualConsole()}),w=dom.window;Object.defineProperty(w,'crypto',{value:webcrypto});w.TextEncoder=TextEncoder;w.AbortSignal=AbortSignal;w.fetch=async(u,o)=>({ok:true,json:()=>reply(u,o)});setup(w);w.eval(source);return w}
const token=created=>async()=>({access_token:'test-access',refresh_token:'test-refresh',expires_in:3600,user:{id:'u1',created_at:created}});
test('first Google sign-in of a new account on the business login is flagged once',async()=>{
 const w=page('https://office.mowmatter.com/login.html?code=test-code',w=>w.sessionStorage.setItem('mm-google-pkce-v1',JSON.stringify({verifier:'v',provider:'google',started:Date.now()})),token(new Date().toISOString()));
 await w.MM.ready;assert.equal(w.MM.takeNewSignup(),true);assert.equal(w.MM.takeNewSignup(),false);
});
test('returning accounts and non-business pages are not flagged',async()=>{
 const old=page('https://office.mowmatter.com/login.html?code=test-code',w=>w.sessionStorage.setItem('mm-google-pkce-v1',JSON.stringify({verifier:'v',provider:'google',started:Date.now()})),token('2026-01-01T00:00:00Z'));
 await old.MM.ready;assert.equal(old.MM.takeNewSignup(),false);
 const customer=page('https://office.mowmatter.com/customer-account.html?code=test-code',w=>w.sessionStorage.setItem('mm-google-pkce-v1',JSON.stringify({verifier:'v',provider:'google',started:Date.now()})),token(new Date().toISOString()));
 await customer.MM.ready;assert.equal(customer.MM.takeNewSignup(),false);
});
test('email confirmation link on the business login is flagged',async()=>{
 const w=page('https://office.mowmatter.com/login.html#access_token=test-access&refresh_token=test-refresh&expires_in=3600&type=signup',()=>{},async()=>({id:'u1',user_metadata:{launch_updates:false}}));
 await w.MM.ready;assert.equal(w.MM.takeNewSignup(),true);
});
test('business login sends brand-new top-level accounts through the consent-gated welcome page',()=>{
 const login=fs.readFileSync(__dirname+'/dist/login.js','utf8');
 assert.match(login,/MM\.takeNewSignup\?\.\(\)&&location\.hostname==='office\.mowmatter\.com'\)location\.assign\('https:\/\/mowmatter\.com\/welcome\?next=\/index\.html'\)/);
});
test('intent=signup puts Create business account first without changing what each button does',()=>{
 const html=fs.readFileSync(__dirname+'/dist/login.html','utf8').replace(/<script[^>]*><\/script>/g,'');
 for(const [url,first]of[['https://office.mowmatter.com/login.html?intent=signup','signup'],['https://office.mowmatter.com/login.html','login']]){
  const w=new JSDOM(html,{url,runScripts:'outside-only',virtualConsole:new VirtualConsole()}).window;
  w.MowNotice={markup:()=>'',validate:()=>({})};w.MM={ready:new Promise(()=>{}),mountGoogleLogin:()=>{}};
  w.eval(fs.readFileSync(__dirname+'/dist/login.js','utf8'));
  const buttons=[...w.document.querySelectorAll('#business-login button[type=submit]')];
  assert.equal(buttons[0].value,first);assert.match(buttons[0].className,/primary/);assert.match(buttons[1].className,/secondary/);
 }
});
test('consented ad-click ID from mowmatter.com is kept 7 days, cleared on request, and sent once to the owner workspace',async()=>{
 const html=fs.readFileSync(__dirname+'/dist/login.html','utf8').replace(/<script[^>]*><\/script>/g,'');
 const parent=new JSDOM('',{url:'https://mowmatter.com/early-access'}).window;
 const w=new JSDOM(html,{url:'https://office.mowmatter.com/login.html?intent=signup',referrer:'https://mowmatter.com/',runScripts:'outside-only',virtualConsole:new VirtualConsole()}).window;
 Object.defineProperty(w,'parent',{value:parent});parent.postMessage=()=>{};
 w.MowNotice={markup:()=>'',validate:()=>({})};w.MM={ready:new Promise(()=>{}),mountGoogleLogin:()=>{}};
 w.eval(fs.readFileSync(__dirname+'/dist/login.js','utf8'));
 const send=(data,origin='https://mowmatter.com',source=parent)=>w.dispatchEvent(new w.MessageEvent('message',{data,origin,source}));
 send({type:'mm-ad-click',gclid:'Cj0KCQiA_test',consented_at:123},'https://evil.example');
 send({type:'mm-ad-click',gclid:'bad id!',consented_at:123});
 assert.equal(w.localStorage.getItem('mm-ad-click'),null);
 send({type:'mm-ad-click',gclid:'Cj0KCQiA_test',consented_at:123});
 const kept=JSON.parse(w.localStorage.getItem('mm-ad-click'));
 assert.equal(kept.gclid,'Cj0KCQiA_test');assert(kept.expires>Date.now()+6.9*864e5&&kept.expires<=Date.now()+7*864e5);
 send({type:'mm-ad-click-clear'});assert.equal(w.localStorage.getItem('mm-ad-click'),null);
 // Office side: billing.js sends the kept ID with the owner's session, then forgets it.
 const office=new JSDOM('',{url:'https://office.mowmatter.com/index.html',runScripts:'outside-only'}).window,calls=[];
 office.MM={ensureSession:async()=>{},session:{access_token:'owner-token'}};office.AbortSignal=AbortSignal;
 office.fetch=async(u,o)=>{calls.push({u,o});return {ok:true,json:async()=>({saved:true})}};
 office.eval(fs.readFileSync(__dirname+'/dist/billing.js','utf8'));
 assert.equal(await office.saveMowAdClick('company-1'),false);assert.equal(calls.length,0);
 office.localStorage.setItem('mm-ad-click',JSON.stringify({gclid:'Cj0KCQiA_test',consented_at:123,expires:Date.now()+1000}));
 assert.equal(await office.saveMowAdClick('company-1'),true);
 assert.equal(calls[0].u,'https://mowmatter-property.onrender.com/api/billing/ad-click');
 assert.deepEqual(JSON.parse(calls[0].o.body),{company_id:'company-1',gclid:'Cj0KCQiA_test',consented_at:123});
 assert.equal(calls[0].o.headers.Authorization,'Bearer owner-token');
 assert.equal(office.localStorage.getItem('mm-ad-click'),null);
 office.localStorage.setItem('mm-ad-click',JSON.stringify({gclid:'Cj0KCQiA_test',consented_at:123,expires:Date.now()-1}));
 assert.equal(await office.saveMowAdClick('company-1'),true);assert.equal(calls.length,1);assert.equal(office.localStorage.getItem('mm-ad-click'),null);
 assert.match(fs.readFileSync(__dirname+'/dist/office-live.js','utf8'),/if\(!owner\)\{[^}]*return\}void window\.saveMowAdClick\?\.\(data\.company\.id\);/);
});
