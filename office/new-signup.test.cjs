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
