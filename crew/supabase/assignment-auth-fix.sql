-- The service-only RPC needs a narrow privileged Auth lookup, without granting table-wide access.
create or replace function public.mow_crew_assign_member(actor uuid,cid uuid,member_email text,member_name text) returns uuid
language plpgsql security definer set search_path='' as $$
declare uid uuid;
begin
 if not exists(select 1 from public.mow_crew_members where company_id=cid and user_id=actor and role='owner') then raise exception 'Owner access required';end if;
 select id into uid from auth.users where lower(email)=lower(member_email) and email_confirmed_at is not null limit 1;
 if uid is null then raise exception 'Crew member must first create and verify their account';end if;
 insert into public.mow_crew_members values(cid,uid,member_name,'member') on conflict(company_id,user_id) do update set display_name=excluded.display_name;
 return uid;
end$$;
revoke all on function public.mow_crew_assign_member(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.mow_crew_assign_member(uuid,uuid,text,text) to service_role;
