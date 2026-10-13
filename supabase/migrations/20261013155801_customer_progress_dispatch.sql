-- Published routes and transactional customer communication. Backend service role only.
alter table public.mow_crew_companies add column if not exists communication_timezone text not null default 'America/New_York';
alter table public.mow_crew_jobs add column if not exists route_position integer;
alter table public.mow_customer_channels add column if not exists sms_route_consent boolean not null default false;
create or replace function public.mow_route_preferences(actor uuid,actor_email text,cid uuid,customer uuid,p_phone text,consent boolean,service_consent boolean,route_consent boolean) returns boolean language plpgsql security invoker set search_path='' as $$
begin
 perform public.mow_sms_all_preferences(actor,actor_email,cid,customer,p_phone,consent,service_consent);
 if route_consent and exists(select 1 from public.mow_sms_suppressions where phone=p_phone) then raise exception 'Number opted out';end if;
 update public.mow_customer_channels set sms_route_consent=route_consent,notice_version='2026-10-11-route' where company_id=cid and customer_id=customer;
 return true;
end $$;
create or replace function public.mow_sms_stop(p_phone text) returns boolean language plpgsql security invoker set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sms:'||p_phone,0));
 insert into public.mow_sms_suppressions(phone) values(p_phone) on conflict do nothing;
 update public.mow_customer_channels set sms_offer_consent=false,sms_service_consent=false,sms_route_consent=false where phone=p_phone;
 return true;
end $$;
create table if not exists public.mow_dispatch_routes (
 company_id uuid not null references public.mow_crew_companies(id), crew_id uuid not null,
 service_date date not null, published_at timestamptz not null default now(),
 primary key(company_id,crew_id,service_date)
);
alter table public.mow_dispatch_routes enable row level security;
revoke all on public.mow_dispatch_routes from public,anon,authenticated;
grant select,insert,update,delete on public.mow_dispatch_routes to service_role;
create table if not exists public.mow_route_notices (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.mow_crew_companies(id),
 job_id uuid not null references public.mow_crew_jobs(id), kind text not null check(kind in ('approaching','rescheduled','cancelled')),
 notice_key text not null unique, payload jsonb not null default '{}',
 status text not null default 'queued' check(status in ('queued','sending','accepted','sent','delivered','undelivered','failed','held_no_consent','held_opt_out','superseded')),
 provider_id text unique, created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index if not exists mow_route_notices_pending on public.mow_route_notices(created_at) where status='queued';
alter table public.mow_route_notices enable row level security;
revoke all on public.mow_route_notices from public,anon,authenticated;
grant select,insert,update on public.mow_route_notices to service_role;

create or replace function public.mow_dispatch_change(actor uuid,cid uuid,command text,payload jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare j public.mow_crew_jobs; item jsonb; crew uuid; day date; ids uuid[]; seq integer=0;
begin
 if not exists(select 1 from public.mow_crew_members where company_id=cid and user_id=actor and role='owner') then raise exception 'Owner access required'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('dispatch:'||cid,0));
 if command='move' then
  select * into j from public.mow_crew_jobs where id=(payload->>'id')::uuid and company_id=cid for update;
  if not found or j.cancelled_at is not null or j.status not in ('scheduled','blocked') then raise exception 'Only pending visits can move'; end if;
  if j.updated_at is distinct from (payload->>'expected_updated_at')::timestamptz then raise exception 'Visit changed. Refresh before moving it';end if;
  crew=(payload->>'crew_id')::uuid; day=(payload->>'service_date')::date;
  if day<current_date-1 or day>current_date+730 then raise exception 'Choose a valid date';end if;
  if not exists(select 1 from public.mow_crew_members where company_id=cid and user_id=crew) then raise exception 'Choose a crew in this business';end if;
  if not (payload->>'scheduled_time' ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$') then raise exception 'Choose a valid time';end if;
  if exists(select 1 from public.mow_crew_jobs where company_id=cid and assigned_to=crew and service_date=day and cancelled_at is null and status<>'completed' and id<>j.id and
    scheduled_time < (payload->>'scheduled_time')::time + coalesce(j.planned_minutes,30)*interval '1 minute' and
    scheduled_time + coalesce(planned_minutes,30)*interval '1 minute' > (payload->>'scheduled_time')::time) then raise exception 'Crew has overlapping work. Choose another time';end if;
  update public.mow_crew_jobs set assigned_to=crew,service_date=day,scheduled_time=(payload->>'scheduled_time')::time,route_position=null,updated_at=now() where id=j.id;
  delete from public.mow_dispatch_routes where company_id=cid and ((crew_id=j.assigned_to and service_date=j.service_date) or (crew_id=crew and service_date=day));
 elsif command='publish' then
  crew=(payload->>'crew_id')::uuid; day=(payload->>'service_date')::date;
  if not exists(select 1 from pg_catalog.pg_timezone_names where name=payload->>'time_zone') then raise exception 'Choose a valid business time zone';end if;
  update public.mow_crew_companies set communication_timezone=payload->>'time_zone' where id=cid;
  if not exists(select 1 from public.mow_crew_members where company_id=cid and user_id=crew) then raise exception 'Choose a crew';end if;
  if jsonb_typeof(payload->'jobs')<>'array' or jsonb_array_length(payload->'jobs') not between 1 and 100 then raise exception 'Choose up to 100 visits';end if;
  select array_agg((v->>'id')::uuid) into ids from jsonb_array_elements(payload->'jobs') v;
  if cardinality(ids)<>(select count(distinct x) from unnest(ids) x) then raise exception 'Duplicate visit';end if;
  if cardinality(ids)<>(select count(*) from public.mow_crew_jobs where company_id=cid and assigned_to=crew and service_date=day and cancelled_at is null and status<>'completed') then raise exception 'Route changed. Refresh and publish the full remaining route';end if;
  for item in select v from jsonb_array_elements(payload->'jobs') v loop
   select * into j from public.mow_crew_jobs where id=(item->>'id')::uuid and company_id=cid and assigned_to=crew and service_date=day and cancelled_at is null and status<>'completed' for update;
   if not found or j.updated_at is distinct from (item->>'updated_at')::timestamptz then raise exception 'Route changed. Refresh before publishing';end if;
   if j.status in ('arrived','in_progress') and seq<>0 then raise exception 'Work underway must remain the first stop';end if;
   seq=seq+1;update public.mow_crew_jobs set route_position=seq,updated_at=now() where id=j.id;
  end loop;
  insert into public.mow_dispatch_routes(company_id,crew_id,service_date) values(cid,crew,day) on conflict(company_id,crew_id,service_date) do update set published_at=now();
 else raise exception 'Unknown dispatch action';end if;
 return jsonb_build_object('ok',true);
end $$;

create or replace function public.mow_route_change_notice() returns trigger language plpgsql security invoker set search_path='' as $$
declare k text;
begin
 if new.customer_id is null then return new;end if;
 if old.cancelled_at is null and new.cancelled_at is not null then k='cancelled';
 elsif new.cancelled_at is null and (old.service_date is distinct from new.service_date or old.scheduled_time is distinct from new.scheduled_time) then k='rescheduled';
 else return new;end if;
 insert into public.mow_route_notices(company_id,job_id,kind,notice_key,payload)
 values(new.company_id,new.id,k,gen_random_uuid()::text,jsonb_build_object('date',new.service_date,'time',new.scheduled_time,'reason',new.cancellation_reason));
 delete from public.mow_dispatch_routes where company_id=new.company_id and ((crew_id=old.assigned_to and service_date=old.service_date) or (crew_id=new.assigned_to and service_date=new.service_date));
 return new;
end $$;
drop trigger if exists mow_route_change_notice on public.mow_crew_jobs;
create trigger mow_route_change_notice after update on public.mow_crew_jobs for each row execute function public.mow_route_change_notice();

create or replace function public.mow_route_notice_claim() returns jsonb language plpgsql security invoker set search_path='' as $$
declare r record; target record; n public.mow_route_notices; j public.mow_crew_jobs;c public.mow_customer_channels; company_name text; ahead integer;
begin
 -- Only routes explicitly published by Office and recently advanced by a crew are eligible.
 for r in select d.* from public.mow_dispatch_routes d where exists(
  select 1 from public.mow_crew_jobs x join public.mow_crew_events e on e.job_id=x.id
  where x.company_id=d.company_id and x.assigned_to=d.crew_id and x.service_date=d.service_date
  and e.action in ('check_in','start','complete') and e.created_at>now()-interval '15 minutes') loop
  for target in select x.*, row_number() over(order by x.route_position nulls last,x.scheduled_time,x.id)-1 stops_ahead
   from public.mow_crew_jobs x where x.company_id=r.company_id and x.assigned_to=r.crew_id and x.service_date=r.service_date and x.cancelled_at is null and x.status<>'completed' loop
   if target.status='scheduled' and target.customer_id is not null and target.stops_ahead in (1,2) then
    insert into public.mow_route_notices(company_id,job_id,kind,notice_key,payload) values(target.company_id,target.id,'approaching','approaching:'||target.id,jsonb_build_object('date',target.service_date,'time',target.scheduled_time,'ahead',target.stops_ahead)) on conflict(notice_key) do nothing;
   end if;
  end loop;
 end loop;
 for n in select notices.* from public.mow_route_notices notices join public.mow_crew_companies company on company.id=notices.company_id where notices.status='queued' and (now() at time zone company.communication_timezone)::time between time '08:00' and time '20:00' order by notices.created_at for update of notices skip locked limit 50 loop
  select * into j from public.mow_crew_jobs where id=n.job_id;
  if n.kind in ('rescheduled','cancelled') and exists(select 1 from public.mow_route_notices newer where newer.job_id=n.job_id and newer.kind=n.kind and newer.created_at>n.created_at) then update public.mow_route_notices set status='superseded',updated_at=now() where id=n.id;continue;end if;
  if j.customer_id is null or (n.kind<>'cancelled' and (j.cancelled_at is not null or j.status='completed' or j.service_date::text<>n.payload->>'date' or j.scheduled_time::text<>n.payload->>'time')) or (n.kind='cancelled' and j.cancelled_at is null) then
   update public.mow_route_notices set status='superseded',updated_at=now() where id=n.id;continue;
  end if;
  if n.kind='approaching' then
   if not exists(select 1 from public.mow_dispatch_routes where company_id=j.company_id and crew_id=j.assigned_to and service_date=j.service_date) then continue;end if;
   select count(*) into ahead from public.mow_crew_jobs x where x.company_id=j.company_id and x.assigned_to=j.assigned_to and x.service_date=j.service_date and x.cancelled_at is null and x.status<>'completed' and
    (coalesce(x.route_position,2147483647),x.scheduled_time,x.id)<(coalesce(j.route_position,2147483647),j.scheduled_time,j.id);
   if ahead not in (1,2) or j.status<>'scheduled' or not exists(select 1 from public.mow_crew_jobs x join public.mow_crew_events e on e.job_id=x.id where x.company_id=j.company_id and x.assigned_to=j.assigned_to and x.service_date=j.service_date and e.action in ('check_in','start','complete') and e.created_at>now()-interval '15 minutes') then continue;end if;
   n.payload=jsonb_set(n.payload,'{ahead}',to_jsonb(ahead));
  end if;
  select * into c from public.mow_customer_channels where company_id=j.company_id and customer_id=j.customer_id;
  if not found or not c.sms_route_consent then update public.mow_route_notices set status='held_no_consent',updated_at=now() where id=n.id;continue;end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sms:'||c.phone,0));
  if exists(select 1 from public.mow_sms_suppressions where phone=c.phone) then update public.mow_route_notices set status='held_opt_out',updated_at=now() where id=n.id;continue;end if;
  update public.mow_route_notices set status='sending',payload=n.payload,updated_at=now() where id=n.id;
  select name into company_name from public.mow_crew_companies where id=j.company_id;
  return jsonb_build_object('claimed',true,'id',n.id,'company_id',j.company_id,'customer_id',j.customer_id,'job_id',j.id,'kind',n.kind,'payload',n.payload,'phone',c.phone,'company_name',company_name);
 end loop;
 return jsonb_build_object('claimed',false);
end $$;
revoke all on function public.mow_dispatch_change(uuid,uuid,text,jsonb),public.mow_route_change_notice(),public.mow_route_notice_claim() from public,anon,authenticated;
grant execute on function public.mow_dispatch_change(uuid,uuid,text,jsonb),public.mow_route_change_notice(),public.mow_route_notice_claim() to service_role;
revoke all on function public.mow_route_preferences(uuid,text,uuid,uuid,text,boolean,boolean,boolean) from public,anon,authenticated;
grant execute on function public.mow_route_preferences(uuid,text,uuid,uuid,text,boolean,boolean,boolean) to service_role;
