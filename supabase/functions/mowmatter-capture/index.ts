const origins = new Set(['https://mowmatter.steelfurymx.chatgpt.site','https://mowmatter.com','https://www.mowmatter.com','https://mowmatter.onrender.com']);
const events = new Set(['cta_click','assessment_started','assessment_completed','signup_started','growth_lab_used']);
Deno.serve(async (req: Request) => {
 const origin=req.headers.get('origin')||'';
 const headers={'Access-Control-Allow-Origin':origins.has(origin)?origin:'https://mowmatter.steelfurymx.chatgpt.site','Access-Control-Allow-Headers':'apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin','Content-Type':'application/json','Cache-Control':'no-store'};
 const reply=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers});
 if(!origins.has(origin)) return reply(403,{error:'Request origin is not allowed.'});
 if(req.method==='OPTIONS') return new Response(null,{status:204,headers});
 if(req.method!=='POST') return reply(405,{error:'Use POST.'});
 const keys=JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')||'{}');
 const allowedKeys=[...Object.values(keys),Deno.env.get('SUPABASE_ANON_KEY')].filter(Boolean);
 if(!allowedKeys.includes(req.headers.get('apikey')||'')) return reply(401,{error:'Invalid API key.'});
 const url=Deno.env.get('SUPABASE_URL')!;
 const secrets=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}');
 const secret=secrets.default||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
 const db=(path:string,data:unknown)=>fetch(url+'/rest/v1/'+path,{method:'POST',headers:{apikey:secret,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify(data)});
 try {
  const raw=await req.text();if(raw.length>8192)return reply(413,{error:'Submission is too large.'});
  const b=JSON.parse(raw);if(!b||typeof b!=='object')return reply(400,{error:'Invalid submission.'});
  const ip=(req.headers.get('x-forwarded-for')||req.headers.get('cf-connecting-ip')||'unknown').split(',')[0].trim();
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(secret+ip+new Date().toISOString().slice(0,13)));
  const hash=Array.from(new Uint8Array(bytes)).map(x=>x.toString(16).padStart(2,'0')).join('');
  const rate=await db('rpc/mowmatter_rate_limit',{p_key:(b.kind==='directory'?'directory:':b.kind==='event'?'event:':'lead:')+hash,p_limit:b.kind==='directory'?60:b.kind==='event'?120:10});
  if(!rate.ok)return reply(503,{error:'Please try again in a moment.'});
  if(!(await rate.json()))return reply(429,{error:'Too many requests. Please try again later.'});
  const clean=(x:unknown,max:number)=>typeof x==='string'?x.trim().slice(0,max):'';
  const source:Record<string,string>={};for(const k of ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','referrer']){const v=clean(b.source?.[k],160);if(v)source[k]=v;}
  const session=typeof b.session_id==='string'&&/^[0-9a-f-]{36}$/i.test(b.session_id)?b.session_id:crypto.randomUUID();
  if(b.kind==='compliance_request'){
   if(clean(b.website,200)||(b.request_type!=='unsubscribe'&&(!Number.isFinite(b.elapsed_ms)||b.elapsed_ms<2000)))return reply(400,{error:'Please review your request and try again.'});
   const email=clean(b.email,255).toLowerCase(),message=clean(b.message,1501);
   if(email.length>254||!/^\S+@[^\s@]+\.[^\s@]+$/.test(email))return reply(400,{error:'Enter a valid email.'});
   if(!['support','privacy_access','privacy_correction','privacy_delete','privacy_export','unsubscribe','accessibility','billing'].includes(b.request_type)||message.length<3||message.length>1500)return reply(400,{error:'Select a request type and provide a message under 1,500 characters.'});
   if(b.contact_consent!==true||b.notice_version!=='2026-10-07')return reply(400,{error:'Review the request notice and contact permission.'});
   if(typeof b.submission_id!=='string'||!b.submission_id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i))return reply(400,{error:'Reload and try again.'});
   const r=await db('rpc/mowmatter_submit_compliance',{p_id:b.submission_id,p_email:email,p_type:b.request_type,p_message:message,p_notice:b.notice_version});
   return r.ok?reply(200,{ok:true}):reply(503,{error:'Your request could not be saved. Please try again.'});
  }
  if(b.kind==='event'){
   if(!events.has(b.event))return reply(400,{error:'Unknown event.'});
   const r=await db('mowmatter_funnel_events',{event:b.event,session_id:session,source});
   return r.ok?reply(200,{ok:true}):reply(503,{error:'Event could not be saved.'});
  }
  if(b.kind==='directory'){
   const zip=clean(b.zip,5),lat=Number(b.latitude),lng=Number(b.longitude),hasGeo=typeof b.latitude==='number'&&typeof b.longitude==='number'&&Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180;
   if(!/^[0-9]{5}$/.test(zip)&&!hasGeo)return reply(400,{error:'Enter a ZIP code or share your location.'});
   const query=new URLSearchParams({select:'id,company_name,public_slug,description,service_zips,services,latitude,longitude',status:'eq.approved',limit:'100'});
   if(zip)query.set('service_zips','cs.{'+zip+'}');
   else {query.set('latitude','gte.'+(lat-.25));query.set('and','(latitude.lte.'+(lat+.25)+',longitude.gte.'+(lng-.3)+',longitude.lte.'+(lng+.3)+')');}
   const r=await fetch(url+'/rest/v1/mowmatter_directory_listings?'+query,{headers:{apikey:secret}});
   if(!r.ok)return reply(503,{error:'Search is temporarily unavailable.'});
   let listings=await r.json();
   const rad=(n:number)=>n*Math.PI/180;
   if(hasGeo)listings=listings.map((x:any)=>{if(x.latitude===null||x.longitude===null)return {...x,distance_miles:null};const a=Math.sin(rad(x.latitude-lat)/2)**2+Math.cos(rad(lat))*Math.cos(rad(x.latitude))*Math.sin(rad(x.longitude-lng)/2)**2;return {...x,distance_miles:3958.8*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a))};}).filter((x:any)=>x.distance_miles!==null&&x.distance_miles<=15).sort((a:any,b:any)=>a.distance_miles-b.distance_miles);
   const featured=new Set();
   if(zip){const q=new URLSearchParams({select:'listing_id',zip:'eq.'+zip,payment_confirmed:'eq.true',starts_at:'lte.'+new Date().toISOString(),ends_at:'gt.'+new Date().toISOString(),limit:'3'});const f=await fetch(url+'/rest/v1/mowmatter_featured_placements?'+q,{headers:{apikey:secret}});if(f.ok)for(const x of await f.json())featured.add(x.listing_id);}
   return reply(200,{ok:true,listings:listings.map((x:any)=>({id:x.id,company_name:x.company_name,description:x.description,services:x.services,featured:featured.has(x.id),distance_miles:x.distance_miles??null})),location:zip||'your location'});
  }
  if(b.kind==='homeowner'){
   if(clean(b.website,200)||!Number.isFinite(b.elapsed_ms)||b.elapsed_ms<2000)return reply(400,{error:'Please review your request and try again.'});
   const email=clean(b.email,255).toLowerCase();
   const allowedServices=new Set(['mowing','edging','hedges','leaves','cleanup','mulch']);
   const services=Array.isArray(b.services)?[...new Set(b.services)].filter(x=>allowedServices.has(x)):[];
   const address=clean(b.address,200),city=clean(b.city,80),state=clean(b.state,2).toUpperCase(),zip=clean(b.zip,5);
   if(email.length>254||!/^\S+@[^\s@]+\.[^\s@]+$/.test(email))return reply(400,{error:'Enter a valid email address.'});
   if(address.length<5||!city||!state.match(/^[A-Z]{2}$/)||!zip.match(/^[0-9]{5}$/)||!services.length)return reply(400,{error:'Enter your address and select at least one service.'});
   if(b.request_consent!==true)return reply(400,{error:'Please agree to contact about your request.'});
   if(!['one_time','weekly','biweekly','monthly','unsure'].includes(b.frequency))return reply(400,{error:'Choose a service frequency.'});
   if(typeof b.submission_id!=='string'||!b.submission_id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i))return reply(400,{error:'Please reload and try again.'});
   const date=clean(b.preferred_date,10);if(date&&(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date))))return reply(400,{error:'Choose a valid date.'});
   // Recheck availability on the server; a URL or client flag cannot create a lead.
   const availability=await fetch(url+'/rest/v1/mowmatter_directory_listings?'+new URLSearchParams({select:'id',status:'eq.approved',service_zips:'cs.{'+zip+'}',services:'cs.{'+services.join(',')+'}',limit:'1'}),{headers:{apikey:secret},signal:AbortSignal.timeout(8000)});
   if(!availability.ok)return reply(503,{error:'Availability could not be checked. Please try again.'});
   const noProvider=(await availability.json()).length===0,sharing=b.lead_sharing_consent===true;
   let leadLocation=null;
   if(noProvider&&sharing){
    try{
     const cached=await fetch(url+'/rest/v1/mow_zip_centers?'+new URLSearchParams({select:'location',zip:'eq.'+zip,limit:'1'}),{headers:{apikey:secret},signal:AbortSignal.timeout(5000)});
     const rows=cached.ok?await cached.json():[];
     if(rows.length)leadLocation=rows[0].location;
     else {const geo=await fetch('https://api.zippopotam.us/us/'+zip,{signal:AbortSignal.timeout(5000)});if(geo.ok){const place=(await geo.json()).places?.[0],lat=Number(place?.latitude),lng=Number(place?.longitude);if(place&&Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180){const center=await db('rpc/mow_growth_zip',{p_zip:zip,p_lat:lat,p_lng:lng});if(center.ok)leadLocation='SRID=4326;POINT('+lng+' '+lat+')';}}}
    }catch{/* Save the request even when geocoding is unavailable; exclude it until geocoded. */}
   }
   const r=await db('mowmatter_homeowner_requests',{no_provider_found:noProvider,lead_sharing_consent:sharing,lead_location:leadLocation,email,first_name:clean(b.first_name,80),phone:clean(b.phone,32),address,city,state,zip,services,frequency:b.frequency,lawn_height:['short','overgrown','unsure'].includes(b.lawn_height)?b.lawn_height:'unsure',access_notes:clean(b.access_notes,1000),preferred_date:date||null,source,submission_id:b.submission_id,request_consent:true});
   if(!r.ok){const err=await r.json();if(err.code!=='23505')return reply(503,{error:'Your request could not be saved. Please try again.'});}
   return reply(200,{ok:true});
  }
  if(b.kind!=='lead')return reply(400,{error:'Unknown request.'});
  if(clean(b.website,200))return reply(400,{error:'Submission could not be accepted.'});
  if(!Number.isFinite(b.elapsed_ms)||b.elapsed_ms<2000)return reply(400,{error:'Please review your details and try again.'});
  const email=clean(b.email,255).toLowerCase();
  if(email.length>254||!/^\S+@[^\s@]+\.[^\s@]+$/.test(email))return reply(400,{error:'Enter a valid email address.'});
  if(b.early_access_consent!==true)return reply(400,{error:'Please agree to early-access contact.'});
  const snapshot:Record<string,number>={};if(b.snapshot&&typeof b.snapshot==='object'){for(const k of ['customers','monthly_revenue','monthly_costs','recurring_percent']){const v=b.snapshot[k];if(typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=10000000)snapshot[k]=v;}}
  const suppression=await fetch(url+'/rest/v1/mowmatter_marketing_suppressions?'+new URLSearchParams({select:'email',email:'eq.'+email,limit:'1'}),{headers:{apikey:secret}});
  if(!suppression.ok)return reply(503,{error:'Contact preferences are temporarily unavailable.'});
  const suppressed=(await suppression.json()).length>0;
  const r=await db('mowmatter_leads?on_conflict=email',{email,first_name:clean(b.first_name,80),company:clean(b.company,120),phone:clean(b.phone,32),interest:['instant_quotes','featured_placement'].includes(b.interest)?b.interest:'platform',featured_zip:/^[0-9]{5}$/.test(clean(b.featured_zip,5))?clean(b.featured_zip,5):null,marketing_consent:b.marketing_consent===true&&!suppressed,source,snapshot:Object.keys(snapshot).length?snapshot:null});
  if(!r.ok){const err=await r.json();if(err.code!=='23505')return reply(503,{error:'We could not save your request. Please try again.'});}
  else if(b.measurement_opt_out!==true) await db('mowmatter_funnel_events',{event:'lead_saved',session_id:session,source});
  return reply(200,{ok:true});
 } catch {return reply(400,{error:'Please check your details and try again.'});}
});
