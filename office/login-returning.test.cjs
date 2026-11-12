// Returning users can start Google without re-ticking terms; accounts with no recorded acceptance are asked once after sign-in.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');const assert=require('node:assert/strict');const {webcrypto}=require('node:crypto');
const read=f=>fs.readFileSync(__dirname+'/dist/'+f,'utf8');
const html=read('login.html').replace(/<script src="[^"]+"><\/script>/g,'');
async function load({session,user}={}){
 const dom=new JSDOM(html,{url:'https://office.mowmatter.com/login.html',runScripts:'outside-only',virtualConsole:new VirtualConsole()});const w=dom.window;
 Object.defineProperty(w,'crypto',{value:webcrypto});w.TextEncoder=TextEncoder;w.AbortSignal=AbortSignal;
 const calls=[];w.fetch=async(url,opt={})=>{calls.push({url:String(url),opt});if(String(url).endsWith('/auth/v1/user'))return {ok:true,json:async()=>({...user,user_metadata:{...user.user_metadata,...JSON.parse(opt.body).data}})};return {ok:true,json:async()=>({external:{google:true}})}};
 if(session)w.localStorage.setItem('mm-auth-v1',JSON.stringify({access_token:'t',refresh_token:'r',expires_at:Date.now()+3600e3,user}));
 const assigned=[];w.eval('window.__assign=[]');
 for(const f of ['login-frame.js','mm-client.js','account-notice.js'])w.eval(read(f));
 w.eval(read('login.js').replace(/location\.assign\('\/index\.html'\)/,"window.__assign.push('/index.html')").replace('location.assign(target.href)','window.__assign.push(target.href)'));
 await w.MM.ready;await new Promise(r=>setTimeout(r,30));return {dom,w,calls};
}
(async()=>{
 // 1) signed out: Google starts without the terms box and stores no acceptance
 let {dom,w}=await load();
 assert.equal(w.document.querySelector('[name=account_terms]').checked,false);
 w.MM.socialSignIn=async(provider,launch,acceptance)=>{w.__started={provider,launch,acceptance}};
 await w.document.querySelector('[data-google-login]').onclick();
 assert.deepEqual({p:w.__started.provider,a:w.__started.acceptance},{p:'google',a:undefined},'returning users are not blocked by the terms box');
 // ticked box still records versioned acceptance
 w.document.querySelector('[name=account_terms]').checked=true;await w.document.querySelector('[data-google-login]').onclick();
 assert.equal(w.__started.acceptance.terms_version,'2026-10-07');dom.window.close();
 // 2) signed in, acceptance on file: straight into Office
 ({dom,w}=await load({session:true,user:{id:'u',email:'a@b.co',created_at:new Date().toISOString(),user_metadata:{terms_version:'2026-10-07'}}}));
 assert.equal(JSON.stringify([...w.__assign]),JSON.stringify(['/index.html']));assert.equal(w.document.getElementById('terms-gate'),null);dom.window.close();
 // 3) signed in, no acceptance on file: gate shown, nothing opens until agreed
 // existing member with no recorded acceptance: never asked
 ({dom,w}=await load({session:true,user:{id:'old',email:'a@b.co',created_at:'2026-10-20T12:00:00Z',user_metadata:{}}}));
 assert.equal(JSON.stringify([...w.__assign]),JSON.stringify(['/index.html']),'existing members enter with no extra step');assert.equal(w.document.getElementById('terms-gate'),null);dom.window.close();
 let calls;({dom,w,calls}=await load({session:true,user:{id:'u',email:'a@b.co',created_at:new Date().toISOString(),user_metadata:{}}}));
 const gate=w.document.getElementById('terms-gate');assert.ok(gate,'gate shown');assert.equal(JSON.stringify([...w.__assign]),JSON.stringify([]));
 assert.equal(w.document.getElementById('business-login').hidden,true);
 gate.dispatchEvent(new w.Event('submit',{cancelable:true}));await new Promise(r=>setTimeout(r,20));
 assert.match(gate.querySelector('[role=status]').textContent,/Agree to the Platform Terms/);assert.equal(JSON.stringify([...w.__assign]),JSON.stringify([]));
 gate.elements.account_terms.checked=true;gate.dispatchEvent(new w.Event('submit',{cancelable:true}));await new Promise(r=>setTimeout(r,30));
 const put=calls.find(c=>c.url.endsWith('/auth/v1/user')&&c.opt.method==='PUT');assert.equal(JSON.parse(put.opt.body).data.terms_version,'2026-10-07');
 assert.equal(JSON.stringify([...w.__assign]),JSON.stringify(['/index.html']),'enters Office after agreeing');dom.window.close();
 console.log('PASS returning login: Google starts without re-ticking terms, ticked box still records versions, existing members enter directly, only brand-new accounts without acceptance agree once.');
})().catch(e=>{console.error(e);process.exit(1)});
