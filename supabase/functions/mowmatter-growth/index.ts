const origins=new Set(['https://office.mowmatter.com','https://mowmatter-office.onrender.com']);
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get('origin')||'',headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin','Access-Control-Allow-Origin':origins.has(origin)?origin:'https://office.mowmatter.com','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'};
 const reply=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers});
 if(!origins.has(origin))return reply(403,{error:'Origin not allowed'});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return reply(405,{error:'Use POST'});
 const base=Deno.env.get('SUPABASE_URL')!,keys=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}'),key=keys.default||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
 const db=async(path:string,body?:unknown)=>{const r=await fetch(base+'/rest/v1/'+path,{method:body===undefined?'GET':'POST',headers:{apikey:key,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});if(!r.ok){const e=await r.json();throw Error(e.message||'Growth is temporarily unavailable');}const raw=await r.text();return raw?JSON.parse(raw):null;};
 try{
  const token=req.headers.get('authorization');if(!token?.startsWith('Bearer '))return reply(401,{error:'Sign in to Office'});
  const a=await fetch(base+'/auth/v1/user',{headers:{apikey:key,Authorization:token},signal:AbortSignal.timeout(15000)});if(!a.ok)return reply(401,{error:'Sign in again'});const user=await a.json();
  const raw=await req.text();if(raw.length>4096)return reply(413,{error:'Request too large'});const b=JSON.parse(raw);
  if(!/^[0-9a-f-]{36}$/i.test(b.company_id||''))return reply(400,{error:'Choose a business'});
  const members=await db('mow_crew_members?'+new URLSearchParams({select:'role',company_id:'eq.'+b.company_id,user_id:'eq.'+user.id}));
  if(!members.some((m:{role:string})=>m.role==='owner'))return reply(403,{error:'Business owner access required'});
  const rate=await db('rpc/mowmatter_rate_limit',{p_key:'growth:'+user.id+':'+new Date().toISOString().slice(0,13),p_limit:120});if(!rate)return reply(429,{error:'Too many scans. Please try again later.'});
  const company=(await db('mow_crew_companies?'+new URLSearchParams({select:'business_zip',id:'eq.'+b.company_id})))[0];
  if(b.action==='profile'){const profiles=await db('mow_growth_profiles?'+new URLSearchParams({select:'contact_name,phone,services,completed_at,initial_zip,initial_radius',company_id:'eq.'+b.company_id}));return reply(200,{business_zip:company?.business_zip||'',profile:profiles[0]||null});}
  if(b.action==='onboard'){
   if(b.accept_terms!==true)return reply(400,{error:'Review and accept the terms'});
   await db('rpc/mow_growth_onboard',{actor:user.id,cid:b.company_id,p_zip:b.zip,p_contact:b.contact_name,p_phone:b.phone,p_services:b.services,p_terms:'2026-10-07'});return reply(200,{ok:true});
  }
  if(!['scan','alerts'].includes(b.action))return reply(400,{error:'Unknown action'});
  if(b.action==='alerts'){if(!company?.business_zip)return reply(200,{needs_business_zip:true,count:0,new_count:0});b.zip=company.business_zip;b.radius=15;}
  if(!/^[0-9]{5}$/.test(b.zip)||![15,25].includes(b.radius)||!Number.isSafeInteger(b.offset??0)||(b.offset??0)<0)return reply(400,{error:'Enter a five-digit ZIP and choose 15 or 25 miles'});
  const centers=await db('mow_zip_centers?'+new URLSearchParams({select:'zip',zip:'eq.'+b.zip}));
  if(!centers.length){const r=await fetch('https://api.zippopotam.us/us/'+b.zip,{signal:AbortSignal.timeout(8000)});if(r.status===404)return reply(422,{error:'This ZIP could not be located'});if(!r.ok)throw Error('ZIP lookup unavailable. Try again shortly.');const geo=await r.json(),p=geo.places?.[0];const lat=Number(p?.latitude),lng=Number(p?.longitude);if(!p||!Number.isFinite(lat)||!Number.isFinite(lng))throw Error('ZIP lookup unavailable');await db('rpc/mow_growth_zip',{p_zip:b.zip,p_lat:lat,p_lng:lng});}
  if(b.action==='alerts')return reply(200,await db('rpc/mow_growth_alerts',{actor:user.id,cid:b.company_id,p_zip:b.zip,p_radius:15}));
  const result=await db('rpc/mow_growth_scan',{actor:user.id,cid:b.company_id,p_zip:b.zip,p_radius:b.radius,p_offset:b.offset??0});return reply(200,{...result,zip:b.zip,radius:b.radius});
 }catch(e){return reply(400,{error:e instanceof SyntaxError?'Invalid request':e.message||'Growth is temporarily unavailable'});}
});
