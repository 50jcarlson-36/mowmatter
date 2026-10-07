const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');const assert=require('node:assert/strict');const {webcrypto}=require('node:crypto');
const source=fs.readFileSync(__dirname+'/dist/mm-client.js','utf8');
function page(url,setup=()=>{},reply=async()=>({external:{google:false}})){
 const dom=new JSDOM('<form id="auth"><p role="status"></p><input type="email" required></form>',{url,runScripts:'outside-only',virtualConsole:new VirtualConsole()}),w=dom.window;
 Object.defineProperty(w,'crypto',{value:webcrypto});w.TextEncoder=TextEncoder;w.AbortSignal=AbortSignal;
 w.fetch=async(url,opts)=>({ok:true,json:()=>reply(url,opts)});setup(w);w.eval(source);return {dom,w};
}
(async()=>{
 for(const host of ['office','crew']){
  const {dom,w}=page('https://'+host+'.mowmatter.com/index.html');await w.MM.ready;w.MM.mountGoogleLogin(w.document.querySelector('form'));w.MM.mountGoogleLogin(w.document.querySelector('form'));
  const buttons=w.document.querySelectorAll('[data-google-login]');assert.equal(buttons.length,1);assert.equal(buttons[0].type,'button');assert.match(buttons[0].textContent,/Continue with Google/);
  await buttons[0].onclick();assert.match(w.document.querySelector('[role=status]').textContent,/not available yet/);assert.equal(buttons[0].disabled,false);assert.equal(w.sessionStorage.getItem('mm-google-pkce-v1'),null);dom.window.close();
 }
 const active=page('https://office.mowmatter.com/customers.html',()=>{},async()=>({external:{google:true}}));await active.w.MM.googleSignIn();const flow=JSON.parse(active.w.sessionStorage.getItem('mm-google-pkce-v1'));assert.equal(flow.verifier.length,43);assert.match(flow.verifier,/^[A-Za-z0-9_-]+$/);assert(Date.now()-flow.started<1000);active.dom.window.close();
 const entry=page('https://office.mowmatter.com/index.html?signin=google');await entry.w.MM.ready;entry.w.MM.mountGoogleLogin(entry.w.document.querySelector('form'));await new Promise(r=>setTimeout(r,20));assert.equal(entry.w.location.search,'');assert.match(entry.w.document.querySelector('[role=status]').textContent,/not available yet/);entry.dom.window.close();
 let captured;
 const {dom,w}=page('https://crew.mowmatter.com/job.html?id=test&code=valid-code',w=>{w.localStorage.setItem('mm-crew-mode','demo');w.sessionStorage.setItem('mm-google-pkce-v1',JSON.stringify({verifier:'private-verifier',started:Date.now()}))},async(url,opts)=>{captured={url,body:JSON.parse(opts.body)};return {access_token:'test-access',refresh_token:'test-refresh',expires_in:3600,user:{id:'crew-user'}}});
 await w.MM.ready;assert.match(captured.url,/grant_type=pkce/);assert.deepEqual(captured.body,{auth_code:'valid-code',code_verifier:'private-verifier'});assert.equal(w.location.search,'?id=test');assert.equal(w.sessionStorage.getItem('mm-google-pkce-v1'),null);assert.equal(w.localStorage.getItem('mm-crew-mode'),'live');assert.equal(w.MM.session.user.id,'crew-user');dom.window.close();
 for(const suffix of ['?code=unexpected','#error=access_denied&error_description=%3Cimg%3E','?error=access_denied']){const {dom,w}=page('https://office.mowmatter.com/index.html'+suffix);await w.MM.ready;assert.equal(w.MM.session,null);assert(w.MM.authError);assert.equal(w.location.hash,'');assert.equal(w.location.search,'');dom.window.close()}
 const fb=page('https://office.mowmatter.com/index.html?signin=facebook');await fb.w.MM.ready;fb.w.MM.mountGoogleLogin(fb.w.document.querySelector('form'));await new Promise(r=>setTimeout(r,20));assert.equal(fb.w.document.querySelectorAll('[data-facebook-login]').length,1);assert.equal(fb.w.document.querySelector('[data-facebook-login]').type,'button');assert.match(fb.w.document.querySelector('[role=status]').textContent,/Facebook sign-in is not available/);assert.equal(fb.w.location.search,'');await assert.rejects(fb.w.MM.socialSignIn('invalid'),/Unsupported/);fb.dom.window.close();
 const facebookActive=page('https://crew.mowmatter.com/index.html',()=>{},async()=>({external:{facebook:true}}));await facebookActive.w.MM.facebookSignIn();assert.equal(JSON.parse(facebookActive.w.sessionStorage.getItem('mm-google-pkce-v1')).provider,'facebook');facebookActive.dom.window.close();
 console.log('PASS Google/Facebook login: both hosts, accessible non-submit buttons, duplicate protection, disabled-provider recovery, PKCE callback exchange/cleanup, Crew demo exit, missing verifier, query/hash cancellation.');
})().catch(e=>{console.error(e);process.exit(1)});
