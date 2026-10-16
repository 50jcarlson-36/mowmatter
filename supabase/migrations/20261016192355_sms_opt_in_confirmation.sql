-- Atomic preference save and single welcome claim; service backend only.
create table public.mow_sms_confirmations (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null, customer_id uuid not null, phone text not null,
 status text not null default 'sending' check(status in ('sending','accepted','sent','delivered','undelivered','failed')),
 provider_id text unique, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(company_id,customer_id) references public.mow_customers(company_id,id),
 unique(company_id,customer_id,phone)
);
alter table public.mow_sms_confirmations enable row level security;
revoke all on public.mow_sms_confirmations from public,anon,authenticated;
grant select,insert,update on public.mow_sms_confirmations to service_role;
create function public.mow_sms_preferences_confirm(actor uuid,actor_email text,cid uuid,customer uuid,p_phone text,consent boolean,service_consent boolean,route_consent boolean,route_enabled boolean,send_confirmation boolean) returns jsonb language plpgsql security invoker set search_path='' as $$
declare mid uuid; prior_status text;
begin
 -- Serialize saves for a customer as well as STOP on this number (underlying RPC).
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sms-customer:'||cid::text||':'||customer::text,0));
 if route_enabled then
  perform public.mow_route_preferences(actor,actor_email,cid,customer,p_phone,consent,service_consent,route_consent);
 else
  perform public.mow_sms_all_preferences(actor,actor_email,cid,customer,p_phone,consent,service_consent);
 end if;
 update public.mow_customer_channels set notice_version='2026-10-16-sms' where company_id=cid and customer_id=customer;
 if not (consent or service_consent or (route_enabled and route_consent)) then
  return jsonb_build_object('claimed',false,'status','no_consent');
 end if;
 if not send_confirmation then return jsonb_build_object('claimed',false,'status','pending_activation');end if;
 insert into public.mow_sms_confirmations(company_id,customer_id,phone) values(cid,customer,p_phone)
 on conflict(company_id,customer_id,phone) do nothing returning id into mid;
 if mid is null then
  select status into prior_status from public.mow_sms_confirmations where company_id=cid and customer_id=customer and phone=p_phone;
  return jsonb_build_object('claimed',false,'status',case when prior_status in ('sending','failed','undelivered') then 'needs_review' else 'already_confirmed' end);
 end if;
 return jsonb_build_object('claimed',true,'id',mid,'phone',p_phone);
end $$;
revoke all on function public.mow_sms_preferences_confirm(uuid,text,uuid,uuid,text,boolean,boolean,boolean,boolean,boolean) from public,anon,authenticated;
grant execute on function public.mow_sms_preferences_confirm(uuid,text,uuid,uuid,text,boolean,boolean,boolean,boolean,boolean) to service_role;
