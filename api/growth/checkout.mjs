import {createHash} from 'node:crypto';
export async function fulfillLeadPackage(event,{stripe,db}){
 const object=event.data.object;
 if(!['checkout.session.completed','checkout.session.async_payment_succeeded','charge.refunded'].includes(event.type))return false;
 let session;
 if(event.type==='charge.refunded'){
  if(!object.payment_intent)return false;
  const sessions=await stripe.checkout.sessions.list({payment_intent:object.payment_intent,limit:1});session=sessions.data[0];
 }else if(object.metadata?.mowmatter_product==='lead_package')session=await stripe.checkout.sessions.retrieve(object.id);
 else return false;
 if(session?.metadata?.mowmatter_product!=='lead_package')return false;
 if(event.type!=='charge.refunded'&&session.payment_status!=='paid')return true;
 if(session.mode!=='payment'||!session.livemode)throw Error('Invalid lead package payment');
 const packages=await db('mow_lead_packages?select=*&id=eq.'+encodeURIComponent(session.metadata.package_id)),p=packages[0];
 if(!p||p.stripe_session!==session.id||p.company_id!==session.metadata.company_id||p.amount_cents!==session.amount_total||p.currency!==session.currency)throw Error('Lead package payment mismatch');
 const ok=await db('rpc/mow_growth_fulfill','POST',{pid:p.id,sid:session.id,amount:session.amount_total,cur:session.currency,refunded:event.type==='charge.refunded'});
 if(!ok)throw Error('Lead package could not be unlocked');return true;
}
export async function leadPackageCheckout({body,cid,actor,stripe,db,env}){
 if(!/^[0-9]{5}$/.test(body.zip)||![15,25].includes(body.radius))throw Object.assign(Error('Choose a valid ZIP and radius'),{status:400});
 const a=await stripe.accounts.retrieve();if(a.id!=='acct_1UNcR11fvEozmSlD'||!a.charges_enabled)throw Object.assign(Error('Payments are unavailable'),{status:503});
 const p=await db('rpc/mow_growth_package','POST',{actor,cid,p_zip:body.zip,p_radius:body.radius,p_amount:0});
 if(!Number.isSafeInteger(p.amount_cents)||p.amount_cents!==Math.min(p.count*500,3900)||p.count<1)throw Object.assign(Error('Package pricing changed. Scan again.'),{status:409});
 if(p.stripe_session){const old=await stripe.checkout.sessions.retrieve(p.stripe_session);if(old.status==='open'&&old.url)return {url:old.url,count:p.count,amount_cents:p.amount_cents};throw Object.assign(Error('Payment confirmation is pending. Scan again shortly.'),{status:409});}
 const session=await stripe.checkout.sessions.create({mode:'payment',line_items:[{price_data:{currency:'usd',unit_amount:p.amount_cents,product_data:{name:'Lead Generation Package',description:p.count+' local homeowner sign-ups · '+body.zip+' · '+body.radius+' miles'}},quantity:1}],integration_identifier:'mowmatter_leads_'+[...createHash('sha256').update(p.id).digest().subarray(0,8)].map(n=>String.fromCharCode(97+n%26)).join(''),metadata:{mowmatter_product:'lead_package',package_id:p.id,company_id:cid},payment_intent_data:{metadata:{mowmatter_product:'lead_package',package_id:p.id}},expires_at:p.expires_at,success_url:'https://office.mowmatter.com/growth.html?checkout=returned&zip='+body.zip+'&radius='+body.radius,cancel_url:'https://office.mowmatter.com/growth.html?checkout=cancelled&zip='+body.zip+'&radius='+body.radius},{idempotencyKey:'mowmatter-leads-'+p.id});
 await db('mow_lead_packages?id=eq.'+encodeURIComponent(p.id),'PATCH',{stripe_session:session.id},'return=minimal');
 return {url:session.url,count:p.count,amount_cents:p.amount_cents};
}
