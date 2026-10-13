alter table public.mow_customer_channels add column if not exists sms_service_consent boolean not null default false;
create table public.mow_visit_sms_messages (
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.mow_crew_companies(id),job_id uuid not null references public.mow_crew_jobs(id),event_id uuid not null references public.mow_crew_events(id),
 kind text not null check(kind in ('arrival','completion')),status text not null default 'sending' check(status in ('sending','accepted','sent','delivered','undelivered','failed')),provider_id text unique,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(job_id,kind)
);
alter table public.mow_visit_sms_messages enable row level security;
revoke all on public.mow_visit_sms_messages from public,anon,authenticated;
grant select,insert,update on public.mow_visit_sms_messages to service_role;
create function public.mow_sms_all_preferences(actor uuid,actor_email text,cid uuid,customer uuid,p_phone text,consent boolean,service_consent boolean) returns boolean language plpgsql security invoker set search_path='' as $$
begin
 if (consent or service_consent) and exists(select 1 from public.mow_sms_suppressions where phone=p_phone) then raise exception 'Number opted out. Contact support to verify re-enrollment';end if;
 perform public.mow_sms_preferences(actor,actor_email,cid,customer,p_phone,consent);
 -- The existing preference function holds the phone advisory lock until this transaction ends.
 if service_consent and exists(select 1 from public.mow_sms_suppressions where phone=p_phone) then raise exception 'Number opted out';end if;
 update public.mow_customer_channels set sms_service_consent=service_consent,notice_version='2026-10-12' where company_id=cid and customer_id=customer;
 return true;
end $$;
create or replace function public.mow_sms_stop(p_phone text) returns boolean language plpgsql security invoker set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sms:'||p_phone,0));
 insert into public.mow_sms_suppressions(phone) values(p_phone) on conflict do nothing;
 update public.mow_customer_channels set sms_offer_consent=false,sms_service_consent=false where phone=p_phone;
 return true;
end $$;
create function public.mow_visit_sms_claim(actor uuid,eid uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare e public.mow_crew_events;j public.mow_crew_jobs;c public.mow_customer_channels;k text;mid uuid;company_name text;
begin
 select * into e from public.mow_crew_events where id=eid;
 if not found or e.action not in ('check_in','start','complete') then raise exception 'Visit event unavailable';end if;
 select * into j from public.mow_crew_jobs where id=e.job_id for update;
 if not exists(select 1 from public.mow_crew_members m where m.company_id=j.company_id and m.user_id=actor and (m.role in ('owner','lead') or j.assigned_to=actor)) then raise exception 'Assigned visit access required';end if;
 if j.cancelled_at is not null or j.customer_id is null or e.created_at<now()-interval '15 minutes' then return jsonb_build_object('claimed',false,'status','held_stale_or_unlinked');end if;
 k=case when e.action='complete' then 'completion' else 'arrival' end;
 if k='arrival' and j.status='completed' then return jsonb_build_object('claimed',false,'status','held_stale_or_unlinked');end if;
 select * into c from public.mow_customer_channels where company_id=j.company_id and customer_id=j.customer_id;
 if not found or not c.sms_service_consent then return jsonb_build_object('claimed',false,'status','held_no_consent');end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sms:'||c.phone,0));
 if exists(select 1 from public.mow_sms_suppressions where phone=c.phone) then return jsonb_build_object('claimed',false,'status','held_opt_out');end if;
 insert into public.mow_visit_sms_messages(company_id,job_id,event_id,kind) values(j.company_id,j.id,eid,k) on conflict(job_id,kind) do nothing returning id into mid;
 if mid is null then return jsonb_build_object('claimed',false,'status',(select status from public.mow_visit_sms_messages where job_id=j.id and kind=k));end if;
 select name into company_name from public.mow_crew_companies where id=j.company_id;
 return jsonb_build_object('claimed',true,'id',mid,'phone',c.phone,'kind',k,'company_name',company_name,'company_id',j.company_id,'customer_id',j.customer_id);
end $$;
revoke all on function public.mow_sms_all_preferences(uuid,text,uuid,uuid,text,boolean,boolean),public.mow_visit_sms_claim(uuid,uuid) from public,anon,authenticated;
grant execute on function public.mow_sms_all_preferences(uuid,text,uuid,uuid,text,boolean,boolean),public.mow_visit_sms_claim(uuid,uuid) to service_role;
