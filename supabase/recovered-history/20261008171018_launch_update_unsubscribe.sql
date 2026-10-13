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
  update public.mowmatter_leads set marketing_consent=false,launch_updates=false where email=lower(trim(p_email));
 end if;
 return true;
end; $$;
revoke all on function public.mowmatter_submit_compliance(uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.mowmatter_submit_compliance(uuid,text,text,text,text) to service_role;

update public.mowmatter_leads set launch_updates=false where lower(email) in (select lower(email) from public.mowmatter_marketing_suppressions);
