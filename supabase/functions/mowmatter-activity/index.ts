import { aggregate } from './aggregate.mjs';
const publicKey='sb_publishable_KQGD-vWlAlJi_Bv7fSaEvA_YLJpIgyu';
const origins=new Set(['https://mowmatter.com','https://www.mowmatter.com']);
let cache:{until:number;body:string}|null=null;
let loading:Promise<string>|null=null;
async function load(){
 const url=Deno.env.get('SUPABASE_URL');const secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!secret)throw new Error('Unavailable');
 const since=new Date(Date.now()-7*86400000).toISOString();
 const query=async(table:string,select:string,extra:Record<string,string>)=>{
  const params=new URLSearchParams({select,created_at:'gte.'+since,order:'created_at.desc',limit:'1000',...extra});
  const response=await fetch(url+'/rest/v1/'+table+'?'+params,{headers:{apikey:secret,Authorization:'Bearer '+secret},signal:AbortSignal.timeout(6000)});
  if(!response.ok)throw new Error('Unavailable');return response.json();
 };
 const [leads,requests]=await Promise.all([
  query('mowmatter_leads','email,marketing_consent',{marketing_consent:'eq.true',status:'eq.early_access'}),
  query('mowmatter_homeowner_requests','email,city,state,request_consent',{request_consent:'eq.true',status:'eq.awaiting_provider'})
 ]);
 return JSON.stringify({generatedAt:new Date().toISOString(),windowDays:7,events:aggregate(leads,requests)});
}
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get('origin');
 const headers:Record<string,string>={'Content-Type':'application/json','Vary':'Origin','Cache-Control':'private, max-age=60','Access-Control-Allow-Headers':'apikey, content-type','Access-Control-Allow-Methods':'GET, OPTIONS'};
 if(origin&&origins.has(origin))headers['Access-Control-Allow-Origin']=origin;
 if(origin&&!origins.has(origin))return new Response('Forbidden',{status:403,headers});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='GET')return new Response('Method not allowed',{status:405,headers});
 // Public-key credential check; this endpoint deliberately authorizes only
 // anonymous aggregate reads. It offers no row-level or mutation access.
 if(req.headers.get('apikey')!==publicKey)return new Response('Unauthorized',{status:401,headers});
 try{
  if(!cache||cache.until<Date.now()){
   if(!loading)loading=load().finally(()=>{loading=null});
   cache={until:Date.now()+60000,body:await loading};
  }
  return new Response(cache.body,{headers});
 }catch{return new Response(JSON.stringify({events:[],error:'Activity unavailable'}),{status:503,headers});}
});
