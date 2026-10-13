create table if not exists public.mow_property_trials(company_id uuid primary key references public.mow_crew_companies(id),started_at timestamptz not null default now(),attempts integer not null default 0 check(attempts between 0 and 10));
create table if not exists public.mow_property_daily_limits(day date primary key,attempts integer not null default 0 check(attempts between 0 and 100));
alter table public.mow_property_trials enable row level security;
alter table public.mow_property_daily_limits enable row level security;
revoke all on public.mow_property_trials,public.mow_property_daily_limits from public,anon,authenticated;
grant all on public.mow_property_trials,public.mow_property_daily_limits to service_role;
create or replace function public.mow_property_reserve(actor uuid,cid uuid) returns jsonb language plpgsql security invoker set search_path=public as $$declare trial mow_property_trials;used integer;begin
if not exists(select 1 from mow_crew_members where company_id=cid and user_id=actor and role='owner') then raise exception 'Owner access required';end if;
insert into mow_property_trials(company_id) values(cid) on conflict do nothing;
select * into trial from mow_property_trials where company_id=cid for update;
if now()>trial.started_at+interval '14 days' or trial.attempts>=10 then raise exception 'Property lookup trial exhausted or expired. Paid activation is not available yet.';end if;
insert into mow_property_daily_limits(day) values(current_date) on conflict do nothing;
update mow_property_daily_limits set attempts=attempts+1 where day=current_date and attempts<100 returning attempts into used;
if used is null then raise exception 'Daily property lookup capacity reached. Try tomorrow.';end if;
update mow_property_trials set attempts=attempts+1 where company_id=cid;
return jsonb_build_object('ok',true,'remaining',9-trial.attempts,'expires_at',trial.started_at+interval '14 days');end$$;
revoke all on function public.mow_property_reserve(uuid,uuid) from public,anon,authenticated;
grant execute on function public.mow_property_reserve(uuid,uuid) to service_role;
