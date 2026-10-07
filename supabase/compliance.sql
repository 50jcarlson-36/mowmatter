create table if not exists public.mowmatter_compliance_requests (
 id uuid primary key,
 email text not null check (length(email) <= 254),
 request_type text not null check (request_type in ('support','privacy_access','privacy_correction','privacy_delete','privacy_export','unsubscribe','accessibility','billing')),
 message text not null check (length(message) between 3 and 1500),
 contact_consent boolean not null check (contact_consent),
 notice_version text not null,
 status text not null default 'pending' check (status in ('pending','verifying','resolved','rejected')),
 created_at timestamptz not null default now()
);
create index if not exists mowmatter_compliance_pending on public.mowmatter_compliance_requests(status,created_at);
create table if not exists public.mowmatter_marketing_suppressions (
 email text primary key,
 reason text not null default 'user_opt_out',
 created_at timestamptz not null default now()
);
alter table public.mowmatter_compliance_requests enable row level security;
alter table public.mowmatter_marketing_suppressions enable row level security;
revoke all on public.mowmatter_compliance_requests, public.mowmatter_marketing_suppressions from public,anon,authenticated;
grant select,insert,update,delete on public.mowmatter_compliance_requests, public.mowmatter_marketing_suppressions to service_role;
create or replace function public.mowmatter_submit_compliance(p_id uuid,p_email text,p_type text,p_message text,p_notice text)
returns boolean language plpgsql security invoker set search_path='' as $$
declare existing public.mowmatter_compliance_requests%rowtype;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_id::text,0));
 if p_notice <> '2026-10-07' then raise exception 'Unknown request notice'; end if;
 select * into existing from public.mowmatter_compliance_requests where id=p_id;
 if found and (existing.email<>lower(trim(p_email)) or existing.request_type<>p_type or existing.message<>trim(p_message)) then raise exception 'Request identifier conflict'; end if;
 insert into public.mowmatter_compliance_requests(id,email,request_type,message,contact_consent,notice_version)
 values(p_id,lower(trim(p_email)),p_type,trim(p_message),true,p_notice) on conflict(id) do nothing;
 if p_type='unsubscribe' then
  insert into public.mowmatter_marketing_suppressions(email) values(lower(trim(p_email))) on conflict(email) do nothing;
  update public.mowmatter_leads set marketing_consent=false where email=lower(trim(p_email));
 end if;
 return true;
end; $$;
revoke all on function public.mowmatter_submit_compliance(uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.mowmatter_submit_compliance(uuid,text,text,text,text) to service_role;
