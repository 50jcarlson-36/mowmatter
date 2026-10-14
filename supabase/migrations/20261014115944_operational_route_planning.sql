-- Backend-only quota, and atomic application of a signed/reviewed route proposal.
create table public.mow_route_usage (
 company_id uuid not null references public.mow_crew_companies(id),
 usage_day date not null, requests integer not null default 0,
 last_requested_at timestamptz not null default now(),
 primary key(company_id,usage_day)
);
alter table public.mow_route_usage enable row level security;
revoke all on public.mow_route_usage from public,anon,authenticated;
grant select,insert,update,delete on public.mow_route_usage to service_role;
create or replace function public.mow_route_reserve(actor uuid,cid uuid) returns boolean
language plpgsql security invoker set search_path='' as $$
declare d date=(now() at time zone 'UTC')::date; u public.mow_route_usage;
begin
 if not exists(select 1 from public.mow_crew_members where company_id=cid and user_id=actor and role='owner') then raise exception 'Owner access required';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('routing-quota',0));
 select * into u from public.mow_route_usage where company_id=cid and usage_day=d;
 if u.requests>=20 or u.last_requested_at>now()-interval '30 seconds' then return false;end if;
 if (select coalesce(sum(requests),0) from public.mow_route_usage where usage_day=d)>=200 then return false;end if;
 insert into public.mow_route_usage(company_id,usage_day,requests) values(cid,d,1)
 on conflict(company_id,usage_day) do update set requests=mow_route_usage.requests+1,last_requested_at=now();
 delete from public.mow_route_usage where usage_day<d-7;
 return true;
end $$;
create or replace function public.mow_route_plan_publish(actor uuid,cid uuid,payload jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare j public.mow_crew_jobs; item jsonb; crew uuid=(payload->>'crew_id')::uuid; day date=(payload->>'service_date')::date; ids uuid[]; updated_jobs jsonb='[]'; prev_end interval=interval '0'; at_time time;
begin
 if not exists(select 1 from public.mow_crew_members where company_id=cid and user_id=actor and role='owner') then raise exception 'Owner access required';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('dispatch:'||cid,0));
 -- Short publish transaction excludes concurrent inserts as well as updates.
 lock table public.mow_crew_jobs in share row exclusive mode;
 if not exists(select 1 from pg_catalog.pg_timezone_names where name=payload->>'time_zone') then raise exception 'Invalid time zone';end if;
 if day<(now() at time zone (payload->>'time_zone'))::date or day>current_date+31 then raise exception 'Route date expired';end if;
 if jsonb_typeof(payload->'jobs') is distinct from 'array' or jsonb_array_length(payload->'jobs') not between 2 and 12 then raise exception 'Review 2–12 visits';end if;
 select array_agg((v->>'id')::uuid) into ids from jsonb_array_elements(payload->'jobs') v;
 if cardinality(ids)<>(select count(distinct x) from unnest(ids) x) then raise exception 'Duplicate visit';end if;
 -- Lock in stable order, check all versions before any update; any error rolls back everything.
 perform id from public.mow_crew_jobs where company_id=cid and assigned_to=crew and service_date=day and cancelled_at is null and status<>'completed' order by id for update;
 if cardinality(ids)<>(select count(*) from public.mow_crew_jobs where company_id=cid and assigned_to=crew and service_date=day and cancelled_at is null and status<>'completed') then raise exception 'Route changed. Calculate again';end if;
 for item in select v from jsonb_array_elements(payload->'jobs') v loop
  select * into j from public.mow_crew_jobs where id=(item->>'id')::uuid and company_id=cid and assigned_to=crew and service_date=day and cancelled_at is null and status='scheduled';
  if not found or j.updated_at is distinct from (item->>'updated_at')::timestamptz then raise exception 'Visit changed or work started. Calculate again';end if;
  if coalesce(item->>'scheduled_time','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'Invalid visit time';end if;
  at_time=(item->>'scheduled_time')::time;
  if coalesce((item->>'flexible')::boolean,false)=false and at_time<>j.scheduled_time then raise exception 'Fixed appointment cannot move';end if;
  if at_time-time '00:00'<prev_end then raise exception 'Overlapping visits';end if;
  prev_end=(at_time-time '00:00')+coalesce(j.planned_minutes,30)*interval '1 minute';
  if prev_end>=interval '24 hours' then raise exception 'Route extends beyond day';end if;
  if day=(now() at time zone (payload->>'time_zone'))::date and at_time<(now() at time zone (payload->>'time_zone'))::time then raise exception 'Departure window passed. Calculate again';end if;
 end loop;
 for item in select v from jsonb_array_elements(payload->'jobs') v loop
  update public.mow_crew_jobs set scheduled_time=(item->>'scheduled_time')::time,updated_at=clock_timestamp() where id=(item->>'id')::uuid and company_id=cid returning * into j;
  updated_jobs=updated_jobs||jsonb_build_array(jsonb_build_object('id',j.id,'updated_at',j.updated_at));
 end loop;
 return public.mow_dispatch_change(actor,cid,'publish',jsonb_set(payload,'{jobs}',updated_jobs));
end $$;
revoke all on function public.mow_route_reserve(uuid,uuid),public.mow_route_plan_publish(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.mow_route_reserve(uuid,uuid),public.mow_route_plan_publish(uuid,uuid,jsonb) to service_role;
