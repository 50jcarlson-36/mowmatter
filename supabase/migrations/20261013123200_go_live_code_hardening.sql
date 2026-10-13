begin;
-- Apply after the existing Office, invoice and connected-payment schema.
-- Existing addresses are intentionally preserved: their correctness cannot be inferred.
alter table public.mow_customers alter column city drop default;
alter table public.mow_crew_jobs alter column city drop default;
create or replace function public.mow_require_city() returns trigger
language plpgsql security invoker set search_path=public as $$
begin
 if new.city is null or length(trim(new.city)) not between 1 and 100 then
  raise exception 'Enter city and state';
 end if;
 new.city:=trim(new.city); return new;
end $$;
drop trigger if exists mow_customer_city on public.mow_customers;
create trigger mow_customer_city before insert or update of city on public.mow_customers
 for each row execute function public.mow_require_city();
drop trigger if exists mow_job_city on public.mow_crew_jobs;
create trigger mow_job_city before insert or update of city on public.mow_crew_jobs
 for each row execute function public.mow_require_city();

-- Serialize payment creation and external settlement for a visit, including uncertain
-- attempts without a saved session_id. Never assume a 30-minute lease proves expiry.
create or replace function public.mow_invoice_payment_guard() returns trigger
language plpgsql security invoker set search_path=public as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(new.job_id::text,0));
 if tg_table_name='mow_customer_invoices' then
  if new.settlement_status is distinct from 'open' and exists(
   select 1 from mow_payment_checkouts where job_id=new.job_id and company_id=new.company_id
    and status in ('pending','paid')
  ) then raise exception 'Reconcile the Stripe payment before settling this invoice'; end if;
 else
  if exists(select 1 from mow_customer_invoices where job_id=new.job_id
   and company_id=new.company_id and settlement_status is distinct from 'open') then
   raise exception 'This invoice is settled or void'; end if;
 end if;
 return new;
end $$;
drop trigger if exists mow_invoice_payment_guard on public.mow_customer_invoices;
create trigger mow_invoice_payment_guard before insert or update of settlement_status on public.mow_customer_invoices
 for each row execute function public.mow_invoice_payment_guard();
drop trigger if exists mow_checkout_invoice_guard on public.mow_payment_checkouts;
create trigger mow_checkout_invoice_guard before insert or update of nonce,session_id,amount_cents on public.mow_payment_checkouts
 for each row execute function public.mow_invoice_payment_guard();

create or replace function public.mow_invoice_settle(actor uuid,cid uuid,iid uuid,state text,note text)
returns boolean language plpgsql security invoker set search_path=public as $$
begin
 if not exists(select 1 from mow_crew_members where company_id=cid and user_id=actor and role='owner') then
  raise exception 'Owner access required'; end if;
 if state not in ('open','paid_external','void') or length(trim(coalesce(note,''))) not between 3 and 500 then
  raise exception 'Review the invoice state and add a note'; end if;
 update mow_customer_invoices set settlement_status=state,settlement_note=trim(note),
  settlement_by=actor,settlement_at=now() where company_id=cid and id=iid;
 return found;
end $$;
revoke all on function public.mow_require_city(),public.mow_invoice_payment_guard(),public.mow_invoice_settle(uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.mow_require_city(),public.mow_invoice_payment_guard(),public.mow_invoice_settle(uuid,uuid,uuid,text,text) to service_role;
CREATE OR REPLACE FUNCTION public.mow_office_action(actor uuid, cid uuid, command text, payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare c mow_customers; p mow_service_plans; j mow_crew_jobs; rid uuid; count_new integer:=0; d date; stop_date date; old_event mow_crew_events;
begin
 -- Serializes concurrent plan creation, generation and edits for one business.
 perform 1 from mow_crew_companies where id=cid for update;
 if not exists(select 1 from mow_crew_members where company_id=cid and user_id=actor and role='owner') then raise exception 'Owner access required'; end if;
 if command='save_customer' then
  rid:=(payload->>'id')::uuid;
  select * into c from mow_customers where id=rid;
  if found and c.company_id<>cid then raise exception 'Customer access denied'; end if;
  if length(trim(coalesce(payload->>'name',''))) not between 1 and 100 or length(trim(coalesce(payload->>'address',''))) not between 3 and 200 then raise exception 'Enter customer name and property address'; end if;
  if length(coalesce(payload->>'email',''))>254 or length(coalesce(payload->>'phone',''))>30 or length(coalesce(payload->>'notes',''))>1500 then raise exception 'Customer details are too long';end if;
  if (nullif(payload->>'latitude','') is null)<>(nullif(payload->>'longitude','') is null) then raise exception 'Enter both coordinates or neither';end if;
  if abs(nullif(payload->>'latitude','')::double precision)>90 or abs(nullif(payload->>'longitude','')::double precision)>180 then raise exception 'Invalid coordinates';end if;
  if length(trim(coalesce(payload->>'city',''))) not between 1 and 100 then raise exception 'Enter city and state'; end if;
  insert into mow_customers(id,company_id,name,address,city,email,phone,notes,latitude,longitude,notification_consent)
  values(rid,cid,trim(payload->>'name'),trim(payload->>'address'),trim(payload->>'city'),coalesce(payload->>'email',''),coalesce(payload->>'phone',''),coalesce(payload->>'notes',''),nullif(payload->>'latitude','')::double precision,nullif(payload->>'longitude','')::double precision,coalesce((payload->>'notification_consent')::boolean,false))
  on conflict(id) do update set name=excluded.name,address=excluded.address,city=excluded.city,email=excluded.email,phone=excluded.phone,notes=excluded.notes,latitude=excluded.latitude,longitude=excluded.longitude,notification_consent=excluded.notification_consent,updated_at=now() where mow_customers.company_id=cid;
  if not found then raise exception 'Customer access denied';end if;
  return jsonb_build_object('ok',true,'customer_id',rid);
 elsif command='create_plan' then
  rid:=(payload->>'id')::uuid;
  select * into p from mow_service_plans where id=rid;
  if found then if p.company_id<>cid then raise exception 'Plan access denied';end if;return jsonb_build_object('ok',true,'plan_id',rid,'duplicate',true);end if;
  if exists(select 1 from mow_service_plans where company_id=cid and customer_id=(payload->>'customer_id')::uuid and active) then raise exception 'This customer already has an active service plan. Pause it before replacing it';end if;
  if (payload->>'first_date')::date < (now() at time zone 'America/New_York')::date or (payload->>'first_date')::date > (now() at time zone 'America/New_York')::date+365 then raise exception 'First visit must be within the next year';end if;
  if jsonb_typeof(payload->'services')<>'array' or jsonb_array_length(payload->'services')=0 or exists(select 1 from jsonb_array_elements_text(payload->'services')s where s not in ('Mow','Edge','Trim','Blow','Cleanup')) then raise exception 'Select valid services';end if;
  insert into mow_service_plans(id,company_id,customer_id,assigned_to,interval_days,first_date,scheduled_time,price_cents,services,requires_photo)
  values(rid,cid,(payload->>'customer_id')::uuid,(payload->>'assigned_to')::uuid,(payload->>'interval_days')::integer,(payload->>'first_date')::date,(payload->>'scheduled_time')::time,(payload->>'price_cents')::integer,array(select jsonb_array_elements_text(payload->'services')),coalesce((payload->>'requires_photo')::boolean,true));
  return public.mow_office_action(actor,cid,'generate_plan',jsonb_build_object('id',rid,'through',(payload->>'first_date')::date+60));
 elsif command in ('generate_plan','pause_plan','resume_plan') then
  rid:=(payload->>'id')::uuid; select * into p from mow_service_plans where id=rid and company_id=cid for update;
  if not found then raise exception 'Plan unavailable';end if;
  if command='pause_plan' then
   update mow_service_plans set active=false where id=rid;
   update mow_crew_jobs set cancelled_at=now(),cancellation_reason='Plan paused',cancellation_source='plan_pause',updated_at=now() where plan_id=rid and service_date>=(now() at time zone 'America/New_York')::date and status='scheduled' and cancelled_at is null;
   return jsonb_build_object('ok',true);
  end if;
  if command='resume_plan' then
   update mow_service_plans set active=true where id=rid;p.active:=true;
   update mow_crew_jobs set cancelled_at=null,cancellation_reason=null,cancellation_source=null,updated_at=now() where plan_id=rid and service_date>=(now() at time zone 'America/New_York')::date and status='scheduled' and cancellation_source='plan_pause';
  end if;
  if not p.active then raise exception 'Resume the plan before generating visits';end if;
  stop_date:=coalesce((payload->>'through')::date,(now() at time zone 'America/New_York')::date+60);
  if stop_date>greatest((now() at time zone 'America/New_York')::date,p.first_date)+93 then raise exception 'Generate no more than 93 days at once';end if;
  select * into c from mow_customers where id=p.customer_id and company_id=cid;
  for d in select x::date from generate_series(p.first_date::timestamp,stop_date::timestamp,make_interval(days=>p.interval_days))x where x::date>=(now() at time zone 'America/New_York')::date loop
   insert into mow_crew_jobs(company_id,customer_id,plan_id,recurrence_date,assigned_to,customer_name,address,city,service_date,scheduled_time,services,notes,latitude,longitude,requires_photo,customer_email,customer_phone,notification_consent,price_cents)
   values(cid,c.id,p.id,d,p.assigned_to,c.name,c.address,c.city,d,p.scheduled_time,p.services,c.notes,c.latitude,c.longitude,p.requires_photo,c.email,c.phone,c.notification_consent,p.price_cents)
   on conflict(plan_id,recurrence_date) do nothing;
   if found then count_new:=count_new+1;end if;
  end loop;
  return jsonb_build_object('ok',true,'plan_id',rid,'generated',count_new);
 elsif command='edit_job' then
  rid:=(payload->>'id')::uuid;select * into j from mow_crew_jobs where id=rid and company_id=cid for update;
  if not found then raise exception 'Job unavailable';end if;
  if j.status not in ('scheduled','blocked') or j.cancelled_at is not null then raise exception 'Only scheduled or blocked active jobs can be changed';end if;
  if not exists(select 1 from mow_crew_members where company_id=cid and user_id=(payload->>'assigned_to')::uuid) then raise exception 'Choose a member of this business';end if;
  if (payload->>'service_date')::date < (now() at time zone 'America/New_York')::date then raise exception 'Choose today or a future date';end if;
  update mow_crew_jobs set assigned_to=(payload->>'assigned_to')::uuid,service_date=(payload->>'service_date')::date,scheduled_time=(payload->>'scheduled_time')::time,notes=left(coalesce(payload->>'notes',j.notes),1500),updated_at=now() where id=rid;
  return jsonb_build_object('ok',true);
 elsif command='cancel_job' then
  rid:=(payload->>'id')::uuid;select * into j from mow_crew_jobs where id=rid and company_id=cid for update;
  if not found or j.status not in ('scheduled','blocked') then raise exception 'Only scheduled or blocked jobs can be cancelled';end if;
  if length(trim(coalesce(payload->>'reason','')))<3 then raise exception 'Add a cancellation reason';end if;
  update mow_crew_jobs set cancelled_at=coalesce(cancelled_at,now()),cancellation_reason=left(payload->>'reason',300),cancellation_source='owner',updated_at=now() where id=rid;
  return jsonb_build_object('ok',true);
 elsif command='cash_entry' then
  rid:=(payload->>'id')::uuid;
  if exists(select 1 from mow_cash_entries where id=rid and company_id<>cid) then raise exception 'Entry access denied';end if;
  insert into mow_cash_entries(id,company_id,kind,amount_cents,entry_date,note) values(rid,cid,payload->>'kind',(payload->>'amount_cents')::integer,(payload->>'entry_date')::date,trim(payload->>'note')) on conflict(id) do nothing;
  return jsonb_build_object('ok',true);
 end if;
 raise exception 'Unknown Office action';
end $function$

revoke all on function public.mow_office_action(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.mow_office_action(uuid,uuid,text,jsonb) to service_role;
commit;
