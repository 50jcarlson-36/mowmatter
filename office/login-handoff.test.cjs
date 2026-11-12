// Early-access frame -> top-level Google handoff must keep the terms acceptance the user just gave,
// but only when the navigation came from the MowMatter marketing site.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');const assert=require('node:assert/strict');const {webcrypto}=require('node:crypto');
const read=f=>fs.readFileSync(__dirname+'/dist/'+f,'utf8');
const html=read('login.html').replace(/<script src="[^"]+"><\/script>/g,'');
async function load(url,referrer){
 const dom=new JSDOM(html,{url,referrer,runScripts:'outside-only',virtualConsole:new VirtualConsole()});const w=dom.window;
 Object.defineProperty(w,'crypto',{value:webcrypto});w.TextEncoder=TextEncoder;w.AbortSignal=AbortSignal;
 w.fetch=async()=>({ok:true,json:async()=>({external:{google:false}})});
 for(const f of ['login-frame.js','mm-client.js','account-notice.js','login.js'])w.eval(read(f));
 await w.MM.ready;await new Promise(r=>setTimeout(r,20));return dom;
}
(async()=>{
 let d=await load('https://office.mowmatter.com/login.html?launch_updates=1&terms=accepted','https://mowmatter.com/');
 assert.equal(d.window.document.querySelector('[name=account_terms]').checked,true,'acceptance from mowmatter.com carries over');
 assert.equal(d.window.location.search,'','terms flag removed from the address bar');d.window.close();
 d=await load('https://office.mowmatter.com/login.html?terms=accepted','https://example.com/');
 assert.equal(d.window.document.querySelector('[name=account_terms]').checked,false,'other sites cannot pre-accept terms');
 assert.equal(d.window.location.search,'');d.window.close();
 d=await load('https://office.mowmatter.com/login.html',undefined);
 assert.equal(d.window.document.querySelector('[name=account_terms]').checked,false,'direct visits start unticked');d.window.close();
 const access=read('../../web/dist/access.js');assert.match(access,/termsAccepted===true\?'&terms=accepted'/);
 assert.match(read('login.js'),/MowNotice\.validate\(form,'business'\);notify\(\{type:'mm-business-login-provider'[^}]*termsAccepted:true\}/,'parent is told only after validation passes');
 console.log('PASS login handoff: framed acceptance carries to Google start from mowmatter.com only; flag stripped; direct visits unticked.');
})().catch(e=>{console.error(e);process.exit(1)});
