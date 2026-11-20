const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('../api/node_modules/jsdom');
function setup(gpc=false,old=false,path='/'){const d=new JSDOM('<!doctype html><head></head><body></body>',{url:'https://mowmatter.com'+path+'?email=PRIVATE',runScripts:'dangerously'}),w=d.window;Object.defineProperty(w.navigator,'globalPrivacyControl',{value:gpc});if(old)w.localStorage.setItem('mm-privacy-v1',JSON.stringify({version:'2026-10-11',analytics:true,time:Date.now()}));w.eval(fs.readFileSync(__dirname+'/dist/privacy-controls.js','utf8'));const s=w.document.createElement('script');Object.assign(s.dataset,{gaId:'G-1T8EP3GRVX',gaHost:'mowmatter.com',gaConsentBridge:'mowmatter',brand:'Mowmatter'});s.textContent=fs.readFileSync(__dirname+'/dist/site-analytics.js','utf8');w.document.head.append(s);w.document.dispatchEvent(new w.Event('DOMContentLoaded'));return w;}
test('Google waits for renewed shared analytics consent and strips queries',()=>{const w=setup(false,true);assert.equal(w.document.querySelectorAll('script[src*="googletagmanager"]').length,0);w.mmPrivacy.save(true);assert.equal(w.document.querySelectorAll('script[src*="googletagmanager"]').length,1);assert(!JSON.stringify(w.dataLayer).includes('PRIVATE'));w.close()});
test('withdrawing shared consent disables Google',()=>{const w=setup();w.mmPrivacy.save(true);w.mmPrivacy.save(false);assert.equal(w['ga-disable-G-1T8EP3GRVX'],true);w.close()});
test('GPC prevents Google even after allow choice',()=>{const w=setup(true);w.mmPrivacy.save(true);assert.equal(w.document.querySelectorAll('script[src*="googletagmanager"]').length,0);w.close()});

test('signup stages require consent and accept only known names and methods',()=>{
 const w=setup(false,false,'/early-access');
 assert.equal(w.siteAnalytics.trackSignup('signup_submit','email'),false);
 w.mmPrivacy.save(true);
 assert.match(w.document.cookie,/mm-ga-signup-consent=allow/);
 assert.equal(w.siteAnalytics.trackSignup('signup_submit','email'),true);
 assert.equal(w.siteAnalytics.trackSignup('signup_email_requested','email'),true);
 assert.equal(w.siteAnalytics.trackSignup('signup_request_failed','person@example.com'),false);
 assert.equal(w.siteAnalytics.trackSignup('sign_up','email'),false);
 const events=w.dataLayer.filter(record=>record[0]==='event').map(record=>record[1]);
 assert.deepEqual(Array.from(events),['page_view','signup_submit','signup_email_requested']);
 assert.doesNotMatch(JSON.stringify(w.dataLayer),/PRIVATE|person@example.com/);
 w.mmPrivacy.save(false);
 assert.doesNotMatch(w.document.cookie,/mm-ga-signup-consent/);
 assert.equal(w.siteAnalytics.trackSignup('signup_submit','email'),false);
 w.close();
});

test('GA4 signup completion works with analytics consent alone',()=>{
 const w=setup(false,false,'/signup-complete');
 w.mmPrivacy.save(true);
 assert.equal(w.mmPrivacy.adMeasurementAllowed(),false);
 let completed=false;
 assert.equal(w.siteAnalytics.trackSignup('sign_up','unknown',()=>{completed=true}),true);
 assert.equal(w.siteAnalytics.trackSignup('signup_submit','email'),false);
 const event=w.dataLayer.find(record=>record[0]==='event'&&record[1]==='sign_up');
 assert.equal(event[2].page_location,'https://mowmatter.com/signup-complete');
 event[2].event_callback();
 assert.equal(completed,true);
 w.close();
});
