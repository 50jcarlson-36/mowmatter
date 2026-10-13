alter table public.mow_customer_quotes add column applied_to_job_id uuid references public.mow_crew_jobs(id);
create or replace function public.mow_commerce_action(actor uuid,actor_email text,cid uuid,customer uuid,command text,payload jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare cu public.mow_customers;q public.mow_customer_quotes;r public.mow_customer_requests;is_owner boolean;rid uuid;email text;j public.mow_crew_jobs;day date;tm time;assigned uuid;new_job uuid;
begin
 perform 1 from public.mow_crew_companies where id=cid for update;
 select * into cu from public.mow_customers where company_id=cid and id=customer;
 if not found then raise exception 'Customer unavailable';end if;
 email:=actor_email;
 if email is null then raise exception 'Verified account required';end if;
 select exists(select 1 from public.mow_crew_members where company_id=cid and user_id=actor and role='owner') into is_owner;
 if command in ('request','respond') then
  if lower(email)<>lower(cu.email) or cu.email='' then raise exception 'Customer access denied';end if;
 else
  if not is_owner then raise exception 'Owner access required';end if;
 end if;
 rid:=(payload->>'id')::uuid;
 if command='request' then
  select * into r from public.mow_customer_requests where id=rid;
  if found then
   if r.company_id<>cid or r.customer_id<>customer or r.actor_id<>actor then raise exception 'Request conflict';end if;
   return jsonb_build_object('ok',true,'id',rid,'duplicate',true);
  end if;
  if (select count(*) from public.mow_customer_requests where company_id=cid and customer_id=customer and created_at>now()-interval '1 day')>=10 then raise exception 'Too many requests today';end if;
  if nullif(payload->>'job_id','') is not null then
   select * into j from public.mow_crew_jobs where id=(payload->>'job_id')::uuid and company_id=cid and customer_id=customer;
   if not found then raise exception 'Visit unavailable';end if;
  elsif payload->>'kind' in ('reschedule','cancel') then raise exception 'Select a visit';end if;
  if payload->>'kind' in ('reschedule','cancel') and (j.status not in ('scheduled','blocked') or j.cancelled_at is not null) then raise exception 'This visit cannot be changed';end if;
  if nullif(payload->>'preferred_date','') is not null and ((payload->>'preferred_date')::date<(now() at time zone 'America/New_York')::date or (payload->>'preferred_date')::date>(now() at time zone 'America/New_York')::date+365) then raise exception 'Choose a date within the next year';end if;
  insert into public.mow_customer_requests(id,company_id,customer_id,actor_id,kind,job_id,message,preferred_date) values(rid,cid,customer,actor,payload->>'kind',nullif(payload->>'job_id','')::uuid,trim(payload->>'message'),nullif(payload->>'preferred_date','')::date);
 elsif command='resolve' then
  if payload->>'state' not in ('resolved','declined') or length(trim(coalesce(payload->>'response','')))<3 then raise exception 'Add a response';end if;
  update public.mow_customer_requests set state=payload->>'state',owner_response=left(trim(payload->>'response'),1500),resolved_at=now() where id=rid and company_id=cid and customer_id=customer and state='pending';
  if not found then raise exception 'Request already handled or unavailable';end if;
 elsif command='quote' then
  if coalesce((payload->>'confirm_review')::boolean,false) is not true then raise exception 'Review quote first';end if;
  select * into q from public.mow_customer_quotes where id=rid;
  if found then
   if q.company_id<>cid or q.customer_id<>customer or q.created_by<>actor then raise exception 'Quote conflict';end if;
   return jsonb_build_object('ok',true,'id',rid,'duplicate',true);
  end if;
  if exists(select 1 from jsonb_array_elements_text(payload->'services') x where length(trim(x)) not between 1 and 80) then raise exception 'Use service labels under 80 characters';end if;
  if (payload->>'expires_at')::timestamptz<=now() or (payload->>'expires_at')::timestamptz>now()+interval '90 days' then raise exception 'Quote expiry must be within 90 days';end if;
  insert into public.mow_customer_quotes(id,company_id,customer_id,title,scope,services,amount_cents,planned_minutes,expires_at,terms,snapshot,created_by)
  select rid,cid,customer,trim(payload->>'title'),trim(payload->>'scope'),array(select jsonb_array_elements_text(payload->'services')),(payload->>'amount_cents')::integer,(payload->>'planned_minutes')::integer,(payload->>'expires_at')::timestamptz,trim(payload->>'terms'),jsonb_build_object('business',co.name,'branding',co.branding,'customer',cu.name,'address',cu.address,'city',cu.city),actor from public.mow_crew_companies co where co.id=cid;
  if nullif(payload->>'source_proposal_id','') is not null then
   if not exists(select 1 from public.mow_visit_proposals where id=(payload->>'source_proposal_id')::uuid and company_id=cid and customer_id=customer and state='pending') then raise exception 'Crew proposal unavailable';end if;
   update public.mow_customer_quotes set source_proposal_id=(payload->>'source_proposal_id')::uuid where id=rid;
   update public.mow_visit_proposals set state='quoted' where id=(payload->>'source_proposal_id')::uuid;
  end if;
 elsif command='respond' then
  select * into q from public.mow_customer_quotes where id=rid and company_id=cid and customer_id=customer for update;
  if not found then raise exception 'Quote unavailable';end if;
  if payload->>'choice' not in ('accepted','declined') then raise exception 'Choose accept or decline';end if;
  if q.state=payload->>'choice' and q.responded_by=actor then return jsonb_build_object('ok',true,'duplicate',true);end if;
  if q.state<>'sent' or q.expires_at<=now() then raise exception 'Quote expired or already handled';end if;
  if payload->>'choice'='accepted' and (coalesce((payload->>'confirm_quote')::boolean,false) is not true or payload->>'notice_version'<>'2026-10-11' or (payload->>'expected_amount_cents')::integer is distinct from q.amount_cents) then raise exception 'Review scope, terms and price first';end if;
  update public.mow_customer_quotes set state=payload->>'choice',responded_by=actor,responded_at=now(),notice_version='2026-10-11' where id=q.id;
  if q.source_offer_id is not null then update public.mow_yard_offers set state=payload->>'choice',responded_by=actor,responded_at=now() where id=q.source_offer_id and company_id=cid;end if;
 elsif command='withdraw' then
  update public.mow_customer_quotes set state='withdrawn' where id=rid and company_id=cid and customer_id=customer and state='sent';
  if not found then raise exception 'Only an unanswered quote can be withdrawn';end if;
 elsif command='apply-addon' then
  select * into q from public.mow_customer_quotes where id=rid and company_id=cid and customer_id=customer for update;
  if not found then raise exception 'Quote unavailable';end if;
  if q.state='booked' then
   if coalesce(q.applied_to_job_id,q.job_id)<>(payload->>'job_id')::uuid then raise exception 'Additional service already attached elsewhere';end if;
   return jsonb_build_object('ok',true,'duplicate',true,'job_id',q.job_id);
  end if;
  if q.state<>'accepted' or coalesce((payload->>'confirm_addon')::boolean,false) is not true then raise exception 'Customer approval and owner review required';end if;
  select * into j from public.mow_crew_jobs where id=(payload->>'job_id')::uuid and company_id=cid and customer_id=customer for update;
  if not found or j.cancelled_at is not null or j.status not in ('scheduled','arrived','in_progress','blocked') then raise exception 'Choose an active visit before completion';end if;
  if j.address<>q.snapshot->>'address' then raise exception 'Property changed; issue a new quote';end if;
  if j.plan_id is not null and exists(select 1 from public.mow_homeowner_subscriptions where plan_id=j.plan_id) then
   insert into public.mow_crew_jobs(company_id,customer_id,assigned_to,customer_name,address,city,service_date,scheduled_time,status,services,notes,latitude,longitude,requires_photo,customer_email,customer_phone,notification_consent,price_cents,planned_minutes,arrived_at,started_at)
   values(cid,customer,j.assigned_to,cu.name,j.address,j.city,j.service_date,j.scheduled_time,j.status,q.services,'Approved additional work during visit: '||q.scope,j.latitude,j.longitude,true,cu.email,cu.phone,cu.notification_consent,q.amount_cents,q.planned_minutes,j.arrived_at,j.started_at) returning id into new_job;
   update public.mow_customer_quotes set state='booked',job_id=new_job,applied_to_job_id=j.id where id=q.id;
   return jsonb_build_object('ok',true,'job_id',new_job,'separate_addon',true);
  end if;
  if j.price_cents+q.amount_cents>10000000 then raise exception 'Visit total exceeds allowed amount';end if;
  update public.mow_crew_jobs set price_cents=price_cents+q.amount_cents,services=services||q.services,notes=left(notes||E'\nApproved additional work: '||q.scope,1500),updated_at=now() where id=j.id;
  update public.mow_customer_quotes set state='booked',job_id=j.id,applied_to_job_id=j.id where id=q.id;
  return jsonb_build_object('ok',true,'job_id',j.id);
 elsif command='book' then
  select * into q from public.mow_customer_quotes where id=rid and company_id=cid and customer_id=customer for update;
  if not found then raise exception 'Quote unavailable';end if;
  if q.state='booked' then return jsonb_build_object('ok',true,'job_id',q.job_id,'duplicate',true);end if;
  if q.state<>'accepted' or coalesce((payload->>'confirm_booking')::boolean,false) is not true then raise exception 'Customer approval and owner booking review required';end if;
  if cu.address<>q.snapshot->>'address' then raise exception 'Property changed; issue a new quote';end if;
  day:=(payload->>'service_date')::date;tm:=(payload->>'scheduled_time')::time;assigned:=(payload->>'assigned_to')::uuid;
  if day<(now() at time zone 'America/New_York')::date or day>(now() at time zone 'America/New_York')::date+365 then raise exception 'Choose a date within the next year';end if;
  if day+tm+make_interval(mins=>q.planned_minutes)>day+interval '1 day' then raise exception 'Visit must finish before midnight';end if;
  if not exists(select 1 from public.mow_crew_members where company_id=cid and user_id=assigned) then raise exception 'Choose a member of your business';end if;
  if exists(select 1 from public.mow_crew_jobs where company_id=cid and assigned_to=assigned and service_date=day and cancelled_at is null and status<>'completed' and scheduled_time < tm+make_interval(mins=>q.planned_minutes) and scheduled_time+make_interval(mins=>planned_minutes)>tm) then raise exception 'This crew member has an overlapping visit';end if;
  insert into public.mow_crew_jobs(company_id,customer_id,assigned_to,customer_name,address,city,service_date,scheduled_time,services,notes,latitude,longitude,requires_photo,customer_email,customer_phone,notification_consent,price_cents,planned_minutes)
  values(cid,customer,assigned,cu.name,cu.address,cu.city,day,tm,q.services,q.scope,cu.latitude,cu.longitude,true,cu.email,cu.phone,cu.notification_consent,q.amount_cents,q.planned_minutes) returning id into new_job;
  update public.mow_customer_quotes set state='booked',job_id=new_job where id=q.id;
  return jsonb_build_object('ok',true,'job_id',new_job);
 else raise exception 'Unknown commerce action';end if;
 return jsonb_build_object('ok',true,'id',rid);
end $$;
