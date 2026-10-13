alter table public.mowmatter_leads add column if not exists launch_updates boolean not null default true;
create schema if not exists mowmatter_private;
create or replace function mowmatter_private.launch_updates(p_enabled boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); account_email text; confirmed timestamptz; enabled boolean;
begin
 if uid is null or p_enabled is null then raise exception 'Sign in to save an update preference.' using errcode='42501'; end if;
 select lower(trim(email)),email_confirmed_at into account_email,confirmed from auth.users where id=uid;
 if account_email is null or confirmed is null then raise exception 'Confirm your email first.' using errcode='42501'; end if;
 enabled:=p_enabled and not exists(select 1 from public.mowmatter_marketing_suppressions where lower(email)=account_email);
 insert into public.mowmatter_leads(email,launch_updates,consent_version,source) values(account_email,enabled,'2026-10-08-login','{"channel":"business_login"}'::jsonb)
 on conflict(email) do update set launch_updates=excluded.launch_updates,consent_version=excluded.consent_version,source=public.mowmatter_leads.source||excluded.source;
 return jsonb_build_object('ok',true,'enabled',enabled);
end $$;
revoke all on function mowmatter_private.launch_updates(boolean) from public,anon;
grant usage on schema mowmatter_private to authenticated;
grant execute on function mowmatter_private.launch_updates(boolean) to authenticated;
create or replace function public.mm_launch_updates(p_enabled boolean) returns jsonb language sql security invoker set search_path='' as $$ select mowmatter_private.launch_updates(p_enabled) $$;
revoke all on function public.mm_launch_updates(boolean) from public,anon;
grant execute on function public.mm_launch_updates(boolean) to authenticated;
