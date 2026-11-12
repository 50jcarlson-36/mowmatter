-- Mow Matter's own marketing to lawn business owners (leads and Office accounts), synced to Klaviyo.
-- Homeowners are never added: they belong to each lawn business and their texts stay on Bird.
-- Email consent: an explicit marketing opt-in, or launch updates chosen on the business login/settings.
-- SMS consent: a separate, unchecked opt-in with its own phone, date and notice version.
alter table public.mowmatter_leads
 add column if not exists sms_marketing_consent boolean not null default false,
 add column if not exists sms_marketing_phone text check(sms_marketing_phone is null or sms_marketing_phone ~ '^\+1[2-9][0-9]{9}$'),
 add column if not exists sms_marketing_consented_at timestamptz,
 add column if not exists sms_marketing_notice text,
 add column if not exists klaviyo_status text not null default 'synced' check(klaviyo_status in ('pending','syncing','synced','failed')),
 add column if not exists klaviyo_version integer not null default 0,
 add column if not exists klaviyo_synced_at timestamptz,
 add column if not exists klaviyo_claimed_at timestamptz;
create index if not exists mowmatter_leads_klaviyo_pending on public.mowmatter_leads(klaviyo_claimed_at) where klaviyo_status in ('pending','syncing');

create or replace function public.mowmatter_lead_email_marketing(l public.mowmatter_leads) returns boolean language sql stable security invoker set search_path='' as $$
 select (l.marketing_consent or (l.launch_updates and l.consent_version like '2026-1%-login%') or (l.launch_updates and l.consent_version like '%-settings'))
  and not exists(select 1 from public.mowmatter_marketing_suppressions where lower(email)=lower(l.email))
$$;

-- Any consent change queues a sync; the version guards against a change landing mid-sync.
create or replace function mowmatter_private.klaviyo_queue() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='INSERT' or (new.marketing_consent,new.launch_updates,new.consent_version,new.sms_marketing_consent,new.sms_marketing_phone,new.email)
   is distinct from (old.marketing_consent,old.launch_updates,old.consent_version,old.sms_marketing_consent,old.sms_marketing_phone,old.email) then
  new.klaviyo_status:='pending';
  new.klaviyo_version:=coalesce(old.klaviyo_version,0)+1;
 end if;
 return new;
end $$;
drop trigger if exists mowmatter_leads_klaviyo_queue on public.mowmatter_leads;
create trigger mowmatter_leads_klaviyo_queue before insert or update on public.mowmatter_leads for each row execute function mowmatter_private.klaviyo_queue();

-- A STOP on any Mow Matter number (Bird or Klaviyo) ends marketing texts to that phone.
create or replace function mowmatter_private.sms_suppressed() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 update public.mowmatter_leads set sms_marketing_consent=false where sms_marketing_phone=new.phone and sms_marketing_consent;
 return new;
end $$;
drop trigger if exists mow_sms_suppressions_marketing on public.mow_sms_suppressions;
create trigger mow_sms_suppressions_marketing after insert on public.mow_sms_suppressions for each row execute function mowmatter_private.sms_suppressed();

create or replace function public.mowmatter_klaviyo_claim() returns jsonb language plpgsql security invoker set search_path='' as $$
declare l public.mowmatter_leads;
begin
 select * into l from public.mowmatter_leads
  where klaviyo_status='pending' or (klaviyo_status='syncing' and klaviyo_claimed_at<now()-interval '10 minutes')
  order by klaviyo_claimed_at nulls first limit 1 for update skip locked;
 if not found then return jsonb_build_object('claimed',false,'status','idle');end if;
 update public.mowmatter_leads set klaviyo_status='syncing',klaviyo_claimed_at=now() where id=l.id;
 return jsonb_build_object('claimed',true,'id',l.id,'version',l.klaviyo_version,'email',l.email,'first_name',l.first_name,'company',l.company,
  'email_marketing',public.mowmatter_lead_email_marketing(l),
  'sms_marketing',l.sms_marketing_consent and l.sms_marketing_phone is not null and not exists(select 1 from public.mow_sms_suppressions where phone=l.sms_marketing_phone),
  'phone',l.sms_marketing_phone,'previously_synced',l.klaviyo_synced_at is not null);
end $$;

create or replace function public.mowmatter_klaviyo_done(p_id uuid,p_version integer,p_ok boolean) returns boolean language plpgsql security invoker set search_path='' as $$
begin
 -- A consent change during the sync bumped the version and stays pending for another pass.
 update public.mowmatter_leads set klaviyo_status=case when p_ok then 'synced' else 'failed' end,
  klaviyo_synced_at=case when p_ok then now() else klaviyo_synced_at end
  where id=p_id and klaviyo_version=p_version and klaviyo_status='syncing';
 update public.mowmatter_leads set klaviyo_status='pending' where id=p_id and klaviyo_version<>p_version and klaviyo_status='syncing';
 return true;
end $$;

-- Unsubscribes reported by Klaviyo flows. Email joins the existing suppression list; SMS uses the shared STOP list.
create or replace function public.mowmatter_marketing_unsubscribe(p_channel text,p_email text,p_phone text) returns boolean language plpgsql security invoker set search_path='' as $$
begin
 if p_channel='email' and p_email ~ '^\S+@[^\s@]+\.[^\s@]+$' then
  insert into public.mowmatter_marketing_suppressions(email) values(lower(trim(p_email))) on conflict(email) do nothing;
  update public.mowmatter_leads set marketing_consent=false,launch_updates=false where lower(email)=lower(trim(p_email));
  return true;
 elsif p_channel='sms' and p_phone ~ '^\+1[2-9][0-9]{9}$' then
  perform public.mow_sms_stop(p_phone);
  return true;
 end if;
 raise exception 'Unknown unsubscribe';
end $$;

-- Signed-in business owners manage their own Mow Matter news preferences in Office settings.
create or replace function mowmatter_private.marketing_preferences(p_email boolean,p_sms boolean,p_phone text) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); account_email text; confirmed timestamptz; l public.mowmatter_leads;
begin
 if uid is null then raise exception 'Sign in to manage Mow Matter news.' using errcode='42501';end if;
 select lower(trim(email)),email_confirmed_at into account_email,confirmed from auth.users where id=uid;
 if account_email is null or confirmed is null then raise exception 'Confirm your email first.' using errcode='42501';end if;
 if p_email is not null or p_sms is not null then
  if p_sms and (p_phone is null or p_phone !~ '^\+1[2-9][0-9]{9}$') then raise exception 'Enter a US mobile number for texts.' using errcode='22023';end if;
  if p_sms then
   perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sms:'||p_phone,0));
   if exists(select 1 from public.mow_sms_suppressions where phone=p_phone) then raise exception 'This number replied STOP. Contact support@mowmatter.com to re-enroll it.' using errcode='22023';end if;
  end if;
  -- An explicit, signed-in email opt-in replaces an earlier unsubscribe for this address.
  if p_email then delete from public.mowmatter_marketing_suppressions where lower(email)=account_email;end if;
  insert into public.mowmatter_leads(email,source) values(account_email,'{"channel":"office_settings"}'::jsonb) on conflict(email) do nothing;
  update public.mowmatter_leads set
   launch_updates=coalesce(p_email,launch_updates),marketing_consent=coalesce(p_email,marketing_consent),
   consent_version=case when p_email is not null then '2026-11-03-settings' else consent_version end,
   sms_marketing_consent=coalesce(p_sms,sms_marketing_consent),
   sms_marketing_phone=case when p_sms then p_phone else sms_marketing_phone end,
   sms_marketing_consented_at=case when p_sms then now() else sms_marketing_consented_at end,
   sms_marketing_notice=case when p_sms then '2026-11-03-operator-sms' else sms_marketing_notice end
  where email=account_email;
  if p_email=false then insert into public.mowmatter_marketing_suppressions(email) values(account_email) on conflict(email) do nothing;end if;
 end if;
 select * into l from public.mowmatter_leads where email=account_email;
 return jsonb_build_object('ok',true,'email',coalesce(public.mowmatter_lead_email_marketing(l),false),
  'sms',coalesce(l.sms_marketing_consent and not exists(select 1 from public.mow_sms_suppressions where phone=l.sms_marketing_phone),false),'phone',l.sms_marketing_phone);
end $$;
create or replace function public.mm_marketing_preferences(p_email boolean default null,p_sms boolean default null,p_phone text default null) returns jsonb language sql security invoker set search_path='' as $$ select mowmatter_private.marketing_preferences(p_email,p_sms,p_phone) $$;

revoke all on function public.mowmatter_lead_email_marketing(public.mowmatter_leads),mowmatter_private.klaviyo_queue(),mowmatter_private.sms_suppressed(),
 public.mowmatter_klaviyo_claim(),public.mowmatter_klaviyo_done(uuid,integer,boolean),public.mowmatter_marketing_unsubscribe(text,text,text),
 mowmatter_private.marketing_preferences(boolean,boolean,text),public.mm_marketing_preferences(boolean,boolean,text) from public,anon,authenticated;
grant execute on function public.mowmatter_lead_email_marketing(public.mowmatter_leads),public.mowmatter_klaviyo_claim(),public.mowmatter_klaviyo_done(uuid,integer,boolean),
 public.mowmatter_marketing_unsubscribe(text,text,text) to service_role;
grant execute on function mowmatter_private.marketing_preferences(boolean,boolean,text),public.mm_marketing_preferences(boolean,boolean,text) to authenticated;

-- Queue existing consenting leads once; everyone else stays out of Klaviyo.
update public.mowmatter_leads l set klaviyo_status='pending' where public.mowmatter_lead_email_marketing(l);
