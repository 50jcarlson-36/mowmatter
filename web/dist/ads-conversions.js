/* Optional Google Ads conversion measurement. No Google Ads request is made before affirmative consent. */
(()=>{'use strict';
const script=document.currentScript,d=script?.dataset||{},id=d.adsId,host=d.adsHost;
const labels={business_signup:d.adsBusinessSignup,homeowner_request:d.adsHomeownerRequest,directory_search:d.adsDirectorySearch};
// Placeholder IDs fail these patterns, so nothing loads until real Google Ads values are set.
const configured=/^AW-[0-9]{6,}$/.test(id||'');
const label=name=>/^[A-Za-z0-9_-]{6,}$/.test(labels[name]||'')?labels[name]:null;
const validHost=()=>location.hostname===host||location.hostname==='www.'+host;
const allowed=()=>configured&&validHost()&&window.mmPrivacy?.allowed()===true;
// Conversion measurement only: no remarketing, ad personalization, enhanced conversions or form contents.
const granted={ad_storage:'granted',ad_user_data:'granted',ad_personalization:'denied',analytics_storage:'granted'};
let loaded=false;
function gtag(){(window.dataLayer=window.dataLayer||[]).push(arguments)}
function load(){if(loaded||!allowed())return loaded;loaded=true;window.gtag=window.gtag||gtag;gtag('consent','update',granted);gtag('js',new Date());gtag('config',id,{allow_ad_personalization_signals:false,allow_google_signals:false,send_page_view:false,url_passthrough:false});if(!document.querySelector('script[src^="https://www.googletagmanager.com/gtag/js"]')){const tag=document.createElement('script');tag.async=true;tag.src='https://www.googletagmanager.com/gtag/js?id='+id;if(script?.nonce)tag.nonce=script.nonce;document.head.append(tag)}return true}
function erase(){for(const c of document.cookie.split(';')){const name=c.trim().split('=')[0];if(!/^_gcl_/.test(name))continue;for(const domain of ['',location.hostname,'.'+location.hostname,'.'+location.hostname.split('.').slice(-2).join('.')])document.cookie=name+'=; Max-Age=0; path=/'+(domain?'; domain='+domain:'');}}
function withdraw(){if(loaded)gtag('consent','update',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});loaded=false;erase()}
function convert(name,{transaction_id,event_callback}={}){const send=label(name);if(!send||!allowed())return false;load();gtag('consent','update',granted);gtag('event','conversion',{send_to:id+'/'+send,...(/^[0-9a-f-]{36}$/.test(transaction_id||'')?{transaction_id}:{}),...(typeof event_callback==='function'?{event_callback,event_timeout:1500}:{})});return true}
window.mmAds={convert,allowed};
// Load on the landing page after consent so the conversion linker can keep the ad click.
load();window.addEventListener('mmprivacychange',()=>{if(allowed())load();else withdraw()});
})();
