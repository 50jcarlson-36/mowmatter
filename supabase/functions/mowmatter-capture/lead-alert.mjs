export async function notifySavedLead({email,kind,reference},{key,fetcher=fetch,now=()=>new Date(),pause=ms=>new Promise(r=>setTimeout(r,ms))}={}) {
 if(!key)return {status:'unconfigured'};
 const type=['lead','homeowner','compliance_request'].includes(kind)?kind:'lead';
 const ref=typeof reference==='string'&&/^[0-9a-f-]{36}$/i.test(reference)?reference:'See saved record';
 const body=JSON.stringify({from:'MowMatter <hello@mowmatter.com>',to:['hello@mowmatter.com'],reply_to:email,subject:'New MowMatter inquiry',text:`A ${type} inquiry has been saved for review.\n\nContact: ${email}\nReference: ${ref}\n\nReview the saved request and its consent before follow-up.\nhttps://office.mowmatter.com\n\nThis is an internal alert. No customer confirmation has been sent.`});
 const enc=new TextEncoder();const signingKey=await crypto.subtle.importKey('raw',enc.encode(key),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const hash=Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',signingKey,enc.encode(now().toISOString().slice(0,10)+'\n'+body)))).map(x=>x.toString(16).padStart(2,'0')).join('');
 for(let attempt=0;attempt<3;attempt++){
  try{const r=await fetcher('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json','Idempotency-Key':`mowmatter-inquiry/${hash}`},body,signal:AbortSignal.timeout(5000)});const data=await r.json().catch(()=>({}));if(r.ok&&data.id)return {status:'accepted',providerId:data.id};if(r.status!==429&&r.status<500)return {status:'failed',code:`provider_${r.status}`};}catch{}
  if(attempt<2)await pause(300*(attempt+1));
 }
 return {status:'failed',code:'provider_unavailable'};
}
