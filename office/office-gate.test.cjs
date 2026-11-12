// Office home: Google starts without the terms box; only brand-new accounts without acceptance see the one-time gate.
const {JSDOM}=require('jsdom');const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.join(__dirname,'dist'),wait=()=>new Promise(r=>setTimeout(r,20));
async function page({session,needs}){const d=new JSDOM(fs.readFileSync(path.join(root,'index.html'),'utf8'),{url:'https://office.mowmatter.com/index.html',runScripts:'outside-only'}),w=d.window,calls=[];
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};
 let needsTerms=needs;
 w.MM={mountGoogleLogin:form=>{const b=w.document.createElement('button');b.type='button';b.dataset.googleLogin='';form.before(b)},needsTerms:()=>needsTerms,ready:Promise.resolve(),session,recovery:false,
  api:async body=>{calls.push(body.action);return {company:{id:'c',name:'Test Co'},customers:[],jobs:[],members:[],events:[],photos:[],notifications:[],plans:[],visit_sms:[]}},
  acceptTerms:async a=>{calls.push('accept:'+a.terms_version);needsTerms=false},socialSignIn:async(p,l,a)=>calls.push('social:'+p+':'+(a?a.terms_version:'none')),signOut:async()=>calls.push('signout'),signUp:async()=>{},signIn:async()=>{}};
 w.showMowAccounting=async()=>{};
 for(const f of ['account-notice.js','dispatch-board.js','office-live.js'])w.eval(fs.readFileSync(path.join(root,f),'utf8'));await wait();return {d,w,calls}}
(async()=>{
 let {d,w,calls}=await page({session:null,needs:false});
 await w.document.querySelector('[data-google-login]').onclick();
 assert.ok(calls.includes('social:google:none'),'signed-out Google starts without ticking terms');d.window.close();
 ({d,w,calls}=await page({session:{access_token:'t'},needs:false}));
 assert.equal(w.document.getElementById('terms-gate'),null,'existing members go straight in');assert.ok(calls.includes('list'));d.window.close();
 ({d,w,calls}=await page({session:{access_token:'t'},needs:true}));
 const gate=w.document.getElementById('terms-gate');assert.ok(gate,'new account without acceptance sees the gate');assert.ok(!calls.includes('list'),'workspace not loaded before agreeing');
 gate.elements.account_terms.checked=true;gate.dispatchEvent(new w.SubmitEvent('submit',{bubbles:true,cancelable:true,submitter:gate.querySelector('button[value=agree]')}));await wait();await wait();
 assert.ok(calls.includes('accept:2026-10-07')&&calls.includes('list'),'agreeing records versions and opens the workspace');d.window.close();
 console.log('PASS Office home: Google without terms box, members enter directly, new unaccepted accounts agree once.');
})().catch(e=>{console.error(e);process.exit(1)});
