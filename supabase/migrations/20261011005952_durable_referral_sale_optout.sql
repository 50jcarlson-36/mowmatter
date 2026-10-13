create table if not exists public.mowmatter_sale_suppressions (
 email text primary key check(email=lower(trim(email)) and length(email)<=254),
 created_at timestamptz not null default now()
);
alter table public.mowmatter_sale_suppressions enable row level security;
revoke all on public.mowmatter_sale_suppressions from public,anon,authenticated;
grant select,insert,update on public.mowmatter_sale_suppressions to service_role;
create or replace function public.mowmatter_opt_out_sale(p_id uuid,p_email text,p_notice text)
returns boolean language plpgsql security invoker set search_path='' as $$
declare normalized text:=lower(trim(p_email));
begin
 if p_notice<>'2026-10-11' or length(normalized)>254 or normalized !~ '^[^[:space:]]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Invalid opt-out'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sale:'||normalized,0));
 insert into public.mowmatter_sale_suppressions(email) values(normalized) on conflict(email) do nothing;
 update public.mowmatter_homeowner_requests set lead_sharing_consent=false where lower(email)=normalized and lead_sharing_consent;
 insert into public.mowmatter_compliance_requests(id,email,request_type,message,contact_consent,notice_version,status)
 values(p_id,normalized,'privacy_correction','Stop sale/sharing of my homeowner referrals.',true,p_notice,'resolved') on conflict(id) do nothing;
 return true;
end; $$;
revoke all on function public.mowmatter_opt_out_sale(uuid,text,text) from public,anon,authenticated;
grant execute on function public.mowmatter_opt_out_sale(uuid,text,text) to service_role;
create or replace function public.mowmatter_guard_referral_consent() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sale:'||lower(trim(new.email)),0));
 if exists(select 1 from public.mowmatter_sale_suppressions where email=lower(trim(new.email))) then new.lead_sharing_consent:=false; end if;
 return new;
end; $$;
revoke all on function public.mowmatter_guard_referral_consent() from public,anon,authenticated;
create or replace trigger mowmatter_guard_referral_consent before insert or update of email,lead_sharing_consent
on public.mowmatter_homeowner_requests for each row execute function public.mowmatter_guard_referral_consent();
