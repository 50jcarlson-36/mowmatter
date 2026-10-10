(()=>{'use strict';const base='https://pzymmsfjgspvzbivzvkx.supabase.co',key='sb_publishable_KQGD-vWlAlJi_Bv7fSaEvA_YLJpIgyu';let session,recovery=false,refreshPending=null,authError='',oauthRequested=null;
try{session=JSON.parse(localStorage.getItem('mm-auth-v1'))}catch{}
function save(s){session=s;try{if(s)localStorage.setItem('mm-auth-v1',JSON.stringify(s));else localStorage.removeItem('mm-auth-v1')}catch{throw Error('Enable browser storage to keep your account signed in')}}
async function request(path,body,method='POST',token){const r=await fetch(base+'/auth/v1/'+path,{method,headers:{apikey:key,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000)});const d=await r.json();if(!r.ok)throw Error(d.msg||d.error_description||d.message||'Could not connect to your account');return d}
async function refresh(){if(refreshPending)return refreshPending;if(!session?.refresh_token)throw Error('Sign in to continue');refreshPending=(async()=>{const d=await request('token?grant_type=refresh_token',{refresh_token:session.refresh_token});save({...d,expires_at:Date.now()+d.expires_in*1000})})();try{await refreshPending}finally{refreshPending=null}}
const preferenceKey='mm-launch-updates-pending';
function pendingPreference(){const value=sessionStorage.getItem(preferenceKey);return value==='true'?true:value==='false'?false:undefined}
function rememberPreference(value){if(typeof value==='boolean')sessionStorage.setItem(preferenceKey,String(value))}
async function saveLaunchUpdates(enabled){if(typeof enabled!=='boolean'||!session)throw Error('Sign in to save your update preference');if(session.expires_at<Date.now()+30000)await refresh();const response=await fetch(base+'/rest/v1/rpc/mm_launch_updates',{method:'POST',headers:{apikey:key,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify({p_enabled:enabled}),signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('Signed in, but your launch-update preference could not be saved. Please retry.');sessionStorage.removeItem(preferenceKey);return response.json()}
const redirect=()=>location.origin+'/index.html';
// PKCE keeps OAuth tokens out of callback URLs. The verifier stays in this tab.
const oauthKey='mm-google-pkce-v1';
const base64url=bytes=>btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
const ready=(async()=>{
 const url=new URL(location.href),h=new URLSearchParams(url.hash.slice(1)),code=url.searchParams.get('code');
 if(['0','1'].includes(url.searchParams.get('launch_updates'))){rememberPreference(url.searchParams.get('launch_updates')==='1');url.searchParams.delete('launch_updates');history.replaceState(null,'',url.pathname+url.search+url.hash);}
 if(['google','facebook'].includes(url.searchParams.get('signin'))){oauthRequested=url.searchParams.get('signin');url.searchParams.delete('signin');history.replaceState(null,'',url.pathname+url.search+url.hash);}
 if(code){
  url.searchParams.delete('code');history.replaceState(null,'',url.pathname+url.search);
  const saved=sessionStorage.getItem(oauthKey);sessionStorage.removeItem(oauthKey);
  const flow=saved?JSON.parse(saved):null;
  if(!flow||Date.now()-flow.started>600000)throw Error('Your sign-in expired. Please try again in this browser tab.');
  rememberPreference(flow.launchUpdates);
  const d=await request('token?grant_type=pkce',{auth_code:code,code_verifier:flow.verifier});
  save({...d,expires_at:Date.now()+d.expires_in*1000});
  sessionStorage.removeItem('mm-recovery');localStorage.setItem('mm-crew-mode','live');
 }else if(h.has('access_token')){
  const token=h.get('access_token'),rt=h.get('refresh_token'),type=h.get('type');
  history.replaceState(null,'',location.pathname+location.search);if(!rt)return;
  const user=await request('user',undefined,'GET',token);
  save({user,access_token:token,refresh_token:rt,expires_at:Date.now()+Number(h.get('expires_in')||3600)*1000});
  if(type==='signup')rememberPreference(user.user_metadata?.launch_updates);
  recovery=type==='recovery';if(recovery)sessionStorage.setItem('mm-recovery','1');
 }else if(h.has('error')||url.searchParams.has('error')){
  sessionStorage.removeItem(oauthKey);
  for(const k of ['error','error_code','error_description'])url.searchParams.delete(k);
  history.replaceState(null,'',url.pathname+url.search);
  throw Error('Sign-in was cancelled or could not finish. Please try again or use your email and password.');
 }
 recovery=recovery||sessionStorage.getItem('mm-recovery')==='1';
})().catch(err=>{save(null);recovery=false;authError=err.message||'Could not finish signing in. Please try again.'});
async function socialSignIn(provider,launchUpdates){
 if(!['google','facebook'].includes(provider))throw Error('Unsupported sign-in provider');
 const label=provider==='google'?'Google':'Facebook';
 await ready;rememberPreference(launchUpdates);
 const settings=await request('settings',undefined,'GET');
 if(!settings.external?.[provider])throw Error(label+' sign-in is not available yet. Please use email and password for now.');
 if(!crypto.subtle)throw Error('Open the secure Mow Matter website to use social sign-in.');
 const verifier=base64url(crypto.getRandomValues(new Uint8Array(32)));
 const challenge=base64url(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))));
 sessionStorage.setItem(oauthKey,JSON.stringify({verifier,provider,started:Date.now(),launchUpdates:pendingPreference()}));
 const target=new URL(base+'/auth/v1/authorize');
 target.search=new URLSearchParams({provider,redirect_to:location.origin+location.pathname,code_challenge:challenge,code_challenge_method:'s256',...(provider==='google'?{prompt:'select_account'}:{scopes:'email'})}).toString();
 location.assign(target.href);
}
function mountGoogleLogin(form){
 if(!form||form.parentElement.querySelector('[data-google-login]'))return;
 const button=document.createElement('button');button.type='button';button.className='button full';button.dataset.googleLogin='';
 button.style.cssText='width:100%;min-height:48px;display:flex;align-items:center;justify-content:center;gap:12px;margin:0 0 20px;background:#fff;color:#1f2937;border:1px solid #cbd5e1';
 button.innerHTML='<svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#4285F4" d="M43.6 24.5c0-1.5-.1-3-.4-4.5H24v8.5h11c-.5 2.6-1.9 4.7-4.1 6.2v5.1h6.7c3.9-3.6 6-8.9 6-15.3z"/><path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.7-5.1c-1.8 1.2-4.1 1.9-6.8 1.9-5.3 0-9.8-3.6-11.4-8.4H5.7v5.3C9.1 39.5 16 44 24 44z"/><path fill="#FBBC05" d="M12.6 27.5a12 12 0 0 1 0-7V15.2H5.7a20 20 0 0 0 0 17.6z"/><path fill="#EA4335" d="M24 12.1c3 0 5.7 1 7.8 3l5.9-5.9A19.4 19.4 0 0 0 24 4C16 4 9.1 8.5 5.7 15.2l6.9 5.3c1.6-4.8 6.1-8.4 11.4-8.4z"/></svg><span>Continue with Google</span>';
 const divider=document.createElement('p');divider.className='help';divider.style.textAlign='center';divider.textContent='or use your email';
 const facebook=document.createElement('button');facebook.type='button';facebook.className=button.className;facebook.dataset.facebookLogin='';facebook.style.cssText=button.style.cssText;facebook.innerHTML='<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="12" fill="#1877F2"/><path fill="white" d="M13.5 21v-8h2.7l.4-3h-3.1V8.2c0-.9.3-1.5 1.6-1.5h1.7V4.1c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3V10H7.4v3h2.7v8z"/></svg><span>Continue with Facebook</span>';form.before(button,facebook,divider);
 const status=form.querySelector('[role="status"]');if(status){status.setAttribute('aria-live','polite');status.textContent=authError;}
 button.onclick=async()=>{button.disabled=true;button.setAttribute('aria-busy','true');try{await socialSignIn('google',form.querySelector('[name=launch_updates]')?.checked)}catch(err){if(status)status.textContent=err.message;button.disabled=false;button.removeAttribute('aria-busy')}};
 facebook.onclick=async()=>{facebook.disabled=true;facebook.setAttribute('aria-busy','true');try{await socialSignIn('facebook',form.querySelector('[name=launch_updates]')?.checked)}catch(err){if(status)status.textContent=err.message;facebook.disabled=false;facebook.removeAttribute('aria-busy')}};
 if(oauthRequested){const provider=oauthRequested;oauthRequested=null;void (provider==='facebook'?facebook:button).onclick();}
}

window.MM={ready,saveLaunchUpdates,get launchUpdatesChoice(){return pendingPreference()},socialSignIn,googleSignIn:()=>socialSignIn('google'),facebookSignIn:()=>socialSignIn('facebook'),mountGoogleLogin,get authError(){return authError},async ensureSession(){await ready;if(!session)throw Error('Sign in to continue');if(session.expires_at<Date.now()+30000)await refresh();return session},get session(){return session},get recovery(){return recovery},
async signIn(email,password){const d=await request('token?grant_type=password',{email,password});save({...d,expires_at:Date.now()+d.expires_in*1000});recovery=false;sessionStorage.removeItem('mm-recovery');return d},
async signUp(email,password,launchUpdates){rememberPreference(launchUpdates);return request('signup?redirect_to='+encodeURIComponent(typeof launchUpdates==='boolean'?location.origin+'/login.html':redirect()),{email,password,...(typeof launchUpdates==='boolean'?{data:{launch_updates:launchUpdates}}:{})})},
async resend(email){return request('resend',{type:'signup',email,options:{email_redirect_to:redirect()}})},
async resetPassword(email){return request('recover?redirect_to='+encodeURIComponent(redirect()),{email})},
async updatePassword(password){if(!recovery||!session)throw Error('Open a valid recovery link first');if(session.expires_at<Date.now()+30000)await refresh();await request('user',{password},'PUT',session.access_token);recovery=false;sessionStorage.removeItem('mm-recovery')},
async signOut(){try{if(session?.access_token)await request('logout',undefined,'POST',session.access_token)}catch{}save(null);recovery=false;sessionStorage.removeItem('mm-recovery')},
async api(body,retry=true){await ready;if(!session)throw Error('Sign in to continue');if(session.expires_at<Date.now()+30000)await refresh();const isForm=body instanceof FormData,r=await fetch(base+'/functions/v1/mowmatter-crew',{method:'POST',headers:{apikey:key,Authorization:'Bearer '+session.access_token,...(isForm?{}:{'Content-Type':'application/json'})},body:isForm?body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});if(r.status===401&&retry){await refresh();return this.api(body,false)}const d=await r.json();if(!r.ok||d.error)throw Error(d.error||'Could not save');return d}}})();


