
create table public.mowmatter_leads (
 id uuid primary key default gen_random_uuid(),
 created_at timestamptz not null default now(),
 email text not null unique check(length(email)<=254),
 first_name text not null default '' check(length(first_name)<=80),
 company text not null default '' check(length(company)<=120),
 phone text not null default '' check(length(phone)<=32),
 marketing_consent boolean not null default false,
 consent_version text not null default '2026-10-04',
 source jsonb not null default '{}'::jsonb,
 snapshot jsonb,
 status text not null default 'early_access'
);
alter table public.mowmatter_leads enable row level security;
revoke all on public.mowmatter_leads from anon, authenticated;
grant all on public.mowmatter_leads to service_role;
create table public.mowmatter_funnel_events (
 id uuid primary key default gen_random_uuid(),
 created_at timestamptz not null default now(),
 event text not null check(event in ('cta_click','assessment_started','assessment_completed','signup_started','lead_saved','growth_lab_used')),
 session_id uuid not null,
 source jsonb not null default '{}'::jsonb
);
alter table public.mowmatter_funnel_events enable row level security;
revoke all on public.mowmatter_funnel_events from anon,authenticated;
grant all on public.mowmatter_funnel_events to service_role;
create table public.mowmatter_request_limits (
 key text primary key,
 window_start timestamptz not null,
 hits integer not null default 1
);
alter table public.mowmatter_request_limits enable row level security;
revoke all on public.mowmatter_request_limits from anon,authenticated;
grant all on public.mowmatter_request_limits to service_role;
create or replace function public.mowmatter_rate_limit(p_key text,p_limit integer)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare n integer;
begin
 insert into public.mowmatter_request_limits(key,window_start,hits)
 values(p_key,date_trunc('hour',now()),1)
 on conflict(key) do update set
 hits=case when public.mowmatter_request_limits.window_start=date_trunc('hour',now()) then public.mowmatter_request_limits.hits+1 else 1 end,
 window_start=date_trunc('hour',now())
 returning hits into n;
 return n<=p_limit;
end;
$$;
revoke all on function public.mowmatter_rate_limit(text,integer) from public,anon,authenticated;
grant execute on function public.mowmatter_rate_limit(text,integer) to service_role;
