/* New business accounts pass through here once so a consented Google Ads sign-up conversion can be recorded on mowmatter.com, then continue to Office. */
(()=>{'use strict';
const next=new URLSearchParams(location.search).get('next');
const target='https://office.mowmatter.com'+(/^\/[a-z0-9-]+\.html$/.test(next||'')?next:'/index.html');
document.getElementById('welcome-link').href=target;
let done=false;const go=()=>{if(!done){done=true;location.replace(target)}};
if(window.mmPrivacy?.allowed()!==true)return go();
// ads-conversions.js loads asynchronously from privacy-controls.js; never hold the visitor more than ~3 seconds.
const started=Date.now();
(function wait(){if(window.mmAds){if(window.mmAds.convert('business_signup',{event_callback:go}))setTimeout(go,1500);else go();return}if(Date.now()-started>1500)return go();setTimeout(wait,50)})();
})();
