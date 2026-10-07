begin;
create schema if not exists extensions;
create extension if not exists postgis with schema extensions;
alter table public.mow_crew_companies add column if not exists business_zip text check (business_zip ~ '^[0-9]{5}$');
create table if not exists public.mow_zip_centers (
 zip text primary key check(zip ~ '^[0-9]{5}$'),
 location extensions.geography(Point,4326) not null,
 source text not null default 'zippopotam.us', updated_at timestamptz not null default now()
);
alter table public.mowmatter_homeowner_requests add column if not exists no_provider_found boolean not null default false;
alter table public.mowmatter_homeowner_requests add column if not exists lead_sharing_consent boolean not null default false;
alter table public.mowmatter_homeowner_requests add column if not exists lead_location extensions.geography(Point,4326);
create index if not exists mow_homeowner_identity on public.mowmatter_homeowner_requests(lower(email),created_at desc,id desc);
create index if not exists mow_waiting_homeowner_geo on public.mowmatter_homeowner_requests using gist(lead_location)
 where no_provider_found and request_consent and lead_sharing_consent;
create table if not exists public.mow_growth_profiles (
 company_id uuid primary key references public.mow_crew_companies(id),
 contact_name text not null, phone text not null, services text[] not null,
 terms_version text not null, completed_at timestamptz not null default now(),
 initial_zip text, initial_radius integer, initial_ids uuid[]
);
create table if not exists public.mow_lead_packages (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.mow_crew_companies(id),
 zip text not null, radius integer not null check(radius in (15,25)), lead_ids uuid[] not null,
 amount_cents integer not null check(amount_cents>0), currency text not null default 'usd' check(currency='usd'),
 status text not null default 'pending' check(status in ('pending','paid','refunded')),
 stripe_session text unique, created_at timestamptz not null default now(), paid_at timestamptz
);
create index if not exists mow_lead_package_scope on public.mow_lead_packages(company_id,zip,radius,status);
create index if not exists mow_growth_company_zip on public.mow_crew_companies(business_zip);
alter table public.mow_zip_centers enable row level security;
alter table public.mow_growth_profiles enable row level security;
alter table public.mow_lead_packages enable row level security;
revoke all on public.mow_zip_centers,public.mow_growth_profiles,public.mow_lead_packages from public,anon,authenticated;
grant all on public.mow_zip_centers,public.mow_growth_profiles,public.mow_lead_packages to service_role;
create table if not exists public.mow_growth_seen (
 company_id uuid not null references public.mow_crew_companies(id), zip text not null, radius integer not null check(radius in (15,25)),
 seen_at timestamptz not null, primary key(company_id,zip,radius)
);
alter table public.mow_growth_seen enable row level security;
revoke all on public.mow_growth_seen from public,anon,authenticated;
grant all on public.mow_growth_seen to service_role;
-- Populate point locations for requests when a verified ZIP center is cached.
create or replace function public.mow_growth_zip(p_zip text,p_lat double precision,p_lng double precision) returns void
language plpgsql security invoker set search_path=public,extensions as $$
begin
 if p_zip !~ '^[0-9]{5}$' or p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then raise exception 'Invalid ZIP coordinates'; end if;
 insert into mow_zip_centers(zip,location) values(p_zip,extensions.st_setsrid(extensions.st_makepoint(p_lng,p_lat),4326)::extensions.geography)
 on conflict(zip) do update set location=excluded.location,updated_at=now();
 update mowmatter_homeowner_requests set lead_location=(select location from mow_zip_centers where zip=p_zip) where zip=p_zip and lead_location is null;
end $$;
create or replace function public.mow_growth_owner(actor uuid,cid uuid) returns void
language plpgsql security invoker set search_path=public as $$
begin
 if not exists(select 1 from mow_crew_members where user_id=actor and company_id=cid and role='owner') then raise exception 'Business owner access required' using errcode='42501'; end if;
end $$;
create or replace function public.mow_growth_onboard(actor uuid,cid uuid,p_zip text,p_contact text,p_phone text,p_services text[],p_terms text) returns void
language plpgsql security invoker set search_path=public as $$
begin
 perform mow_growth_owner(actor,cid);
 if not exists(select 1 from auth.users where id=actor and email_confirmed_at is not null) then raise exception 'Confirm your email first'; end if;
 if p_zip is null or p_contact is null or p_phone is null or p_terms is null or p_zip !~ '^[0-9]{5}$' or length(trim(p_contact)) not between 2 and 100 or length(regexp_replace(p_phone,'[^0-9]','','g')) not between 10 and 15
 or cardinality(p_services) is null or cardinality(p_services)=0 or not p_services <@ array['mowing','edging','hedges','leaves','cleanup','mulch'] or p_terms <> '2026-10-07' then raise exception 'Complete all registration fields'; end if;
 update mow_crew_companies set business_zip=p_zip where id=cid;
 insert into mow_growth_profiles(company_id,contact_name,phone,services,terms_version) values(cid,trim(p_contact),p_phone,p_services,p_terms)
 on conflict(company_id) do update set contact_name=excluded.contact_name,phone=excluded.phone,services=excluded.services;
end $$;
-- Distinct homeowners; use ZIP centroid estimates consistently for all radius queries.
create or replace function public.mow_growth_candidates(p_zip text,p_radius integer) returns setof public.mowmatter_homeowner_requests
language sql stable security invoker set search_path=public,extensions as $$
 select distinct on (lower(h.email)) h.* from mowmatter_homeowner_requests h join mow_zip_centers z on z.zip=p_zip
 where h.no_provider_found and h.request_consent and h.lead_sharing_consent and h.status='awaiting_provider'
 and not exists(select 1 from mowmatter_homeowner_requests newer where lower(newer.email)=lower(h.email) and (newer.created_at,newer.id)>(h.created_at,h.id))
 and h.created_at >= now()-interval '30 days'
 and p_radius in (15,25) and extensions.st_dwithin(h.lead_location,z.location,p_radius*1609.344)
 order by lower(h.email),h.created_at desc,h.id
$$;
create or replace function public.mow_growth_scan(actor uuid,cid uuid,p_zip text,p_radius integer,p_offset integer default 0) returns jsonb
language plpgsql security invoker set search_path=public,extensions as $$
declare ids uuid[]; visible uuid[]; purchased uuid[]; profile mow_growth_profiles; reason text:='locked'; total integer; items jsonb;
begin
 perform mow_growth_owner(actor,cid);
 if p_zip is null or p_radius is null or p_offset is null or p_zip !~ '^[0-9]{5}$' or p_radius not in (15,25) or p_offset<0 then raise exception 'Choose a valid ZIP and radius'; end if;
 if not exists(select 1 from mow_zip_centers where zip=p_zip) then raise exception 'ZIP center unavailable'; end if;
 select coalesce(array_agg(id order by created_at desc,id),'{}'::uuid[]) into ids from mow_growth_candidates(p_zip,p_radius);
 total:=cardinality(ids);
 -- Serialize first incentive grant: repeated scans cannot expand it.
 select * into profile from mow_growth_profiles where company_id=cid for update;
 if exists(select 1 from mow_billing_accounts where company_id=cid and paid and status='active' and plan in ('growth','grow','scale')) then
  visible:=ids; reason:='subscription';
 elsif profile.company_id is not null and profile.initial_ids is null and total>0 and p_zip=(select business_zip from mow_crew_companies where id=cid) then
  update mow_growth_profiles set initial_zip=p_zip,initial_radius=p_radius,initial_ids=ids where company_id=cid;
  visible:=ids; reason:='onboarding';
 elsif profile.initial_ids is not null then
  visible:=array(select unnest(ids) intersect select unnest(profile.initial_ids)); reason:='onboarding';
 else
  select coalesce(array_agg(distinct h.id),'{}'::uuid[]) into visible from mowmatter_homeowner_requests h
   where h.id=any(ids) and exists(select 1 from mow_lead_packages p cross join lateral unnest(p.lead_ids) lid
    join mowmatter_homeowner_requests owned on owned.id=lid where p.company_id=cid and p.status='paid' and lower(owned.email)=lower(h.email));
  if cardinality(visible)>0 then reason:='purchase'; end if;
 end if;
 -- A paid bundle augments, rather than being hidden by, the onboarding snapshot.
 select coalesce(array_agg(distinct h.id),'{}'::uuid[]) into purchased from mowmatter_homeowner_requests h
   where h.id=any(ids) and exists(select 1 from mow_lead_packages p cross join lateral unnest(p.lead_ids) lid
    join mowmatter_homeowner_requests owned on owned.id=lid where p.company_id=cid and p.status='paid' and lower(owned.email)=lower(h.email));
 if cardinality(purchased)>0 then
  if reason='locked' then reason:='purchase'; elsif reason='onboarding' then reason:='combined'; end if;
  visible:=array(select unnest(coalesce(visible,'{}'::uuid[])) union select unnest(purchased));
 end if;
 select coalesce(jsonb_agg(x),'[]'::jsonb) into items from (
  select h.id,h.first_name,h.email,h.phone,h.address,h.city,h.state,h.zip,h.services,h.frequency,h.created_at,
   round((extensions.st_distance(h.lead_location,z.location)/1609.344)::numeric,1) distance_miles
  from mowmatter_homeowner_requests h join mow_zip_centers z on z.zip=p_zip where h.id=any(visible)
  order by h.created_at desc,h.id limit 50 offset p_offset
 ) x;
 insert into mow_growth_seen(company_id,zip,radius,seen_at) values(cid,p_zip,p_radius,statement_timestamp())
 on conflict(company_id,zip,radius) do update set seen_at=excluded.seen_at;
 if p_radius=25 then
  insert into mow_growth_seen(company_id,zip,radius,seen_at) values(cid,p_zip,15,statement_timestamp())
  on conflict(company_id,zip,radius) do update set seen_at=excluded.seen_at;
 end if;
 return jsonb_build_object('count',total,'unlocked',reason<>'locked','access_reason',reason,'unlocked_count',coalesce(cardinality(visible),0),
 'package_count',total-coalesce(cardinality(visible),0),'package_amount_cents',least((total-coalesce(cardinality(visible),0))*500,3900),
 'leads',items,'offset',p_offset,'onboarding_complete',profile.company_id is not null,'initial_zip',profile.initial_zip,'initial_radius',profile.initial_radius);
end $$;
create or replace function public.mow_growth_package(actor uuid,cid uuid,p_zip text,p_radius integer,p_amount integer) returns jsonb
language plpgsql security invoker set search_path=public as $$
declare ids uuid[]; pid uuid; scan jsonb; existing mow_lead_packages; price integer;
begin
 perform mow_growth_owner(actor,cid);
 perform 1 from mow_crew_companies where id=cid for update;
 scan:=mow_growth_scan(actor,cid,p_zip,p_radius,0);
 if (scan->>'unlocked_count')::integer=(scan->>'count')::integer then raise exception 'These leads are already free or unlocked'; end if;
 select * into existing from mow_lead_packages where company_id=cid and zip=p_zip and radius=p_radius and status='pending' and created_at>now()-interval '61 minutes' order by created_at desc limit 1;
 if found then return jsonb_build_object('id',existing.id,'count',cardinality(existing.lead_ids),'amount_cents',existing.amount_cents,'stripe_session',existing.stripe_session,'expires_at',floor(extract(epoch from existing.created_at))+3600); end if;
 select array_agg(h.id) into ids from mow_growth_candidates(p_zip,p_radius) h
 where not exists(select 1 from mow_growth_profiles g where g.company_id=cid and h.id=any(g.initial_ids))
 and not exists(select 1 from mow_lead_packages p cross join lateral unnest(p.lead_ids) lid
  join mowmatter_homeowner_requests owned on owned.id=lid where p.company_id=cid and p.status='paid' and lower(owned.email)=lower(h.email));
 if coalesce(cardinality(ids),0)=0 then raise exception 'No leads to purchase'; end if;
 price:=least(cardinality(ids)*500,3900); -- Approved $5 per NEW lead, maximum $39.
 insert into mow_lead_packages(company_id,zip,radius,lead_ids,amount_cents) values(cid,p_zip,p_radius,ids,price) returning id into pid;
 return jsonb_build_object('id',pid,'count',cardinality(ids),'amount_cents',price,'expires_at',floor(extract(epoch from now()))+3600);
end $$;
create or replace function public.mow_growth_alerts(actor uuid,cid uuid,p_zip text,p_radius integer default 15) returns jsonb
language plpgsql security invoker set search_path=public as $$
declare seen timestamptz; total integer; new_count integer;
begin
 perform mow_growth_owner(actor,cid);
 if p_zip is null or p_zip !~ '^[0-9]{5}$' or p_radius is null or p_radius not in (15,25) then raise exception 'Choose a valid ZIP and radius'; end if;
 select seen_at into seen from mow_growth_seen where company_id=cid and zip=p_zip and radius=p_radius;
 select count(*),count(*) filter(where created_at>coalesce(seen,'epoch'::timestamptz)) into total,new_count from mow_growth_candidates(p_zip,p_radius);
 return jsonb_build_object('count',total,'new_count',new_count,'zip',p_zip,'radius',p_radius,'last_seen_at',seen);
end $$;
revoke all on function public.mow_growth_alerts(uuid,uuid,text,integer) from public,anon,authenticated;
grant execute on function public.mow_growth_alerts(uuid,uuid,text,integer) to service_role;
-- Bind purchase entitlement to the persisted snapshot, session and server amount.
create or replace function public.mow_growth_fulfill(pid uuid,sid text,amount integer,cur text,refunded boolean default false) returns boolean
language plpgsql security invoker set search_path=public as $$
begin
 update mow_lead_packages set status=case when refunded then 'refunded' else 'paid' end,paid_at=case when refunded then paid_at else coalesce(paid_at,now()) end
 where id=pid and stripe_session=sid and amount_cents=amount and currency=cur and status<>'refunded';
 if not found then return exists(select 1 from mow_lead_packages where id=pid and stripe_session=sid and amount_cents=amount and currency=cur and status='refunded'); end if;
 return found;
end $$;
revoke all on function public.mow_growth_zip(text,double precision,double precision),public.mow_growth_owner(uuid,uuid),public.mow_growth_onboard(uuid,uuid,text,text,text,text[],text),public.mow_growth_candidates(text,integer),public.mow_growth_scan(uuid,uuid,text,integer,integer),public.mow_growth_package(uuid,uuid,text,integer,integer),public.mow_growth_fulfill(uuid,text,integer,text,boolean) from public,anon,authenticated;
grant execute on function public.mow_growth_zip(text,double precision,double precision),public.mow_growth_owner(uuid,uuid),public.mow_growth_onboard(uuid,uuid,text,text,text,text[],text),public.mow_growth_candidates(text,integer),public.mow_growth_scan(uuid,uuid,text,integer,integer),public.mow_growth_package(uuid,uuid,text,integer,integer),public.mow_growth_fulfill(uuid,text,integer,text,boolean) to service_role;
commit;
