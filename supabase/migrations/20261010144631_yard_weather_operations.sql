-- Additive, private records. Browser clients never receive service-role privileges.
create table if not exists public.mow_owner_settings (
 company_id uuid primary key references public.mow_crew_companies(id), revision integer not null default 1,
 catalog jsonb not null, labor jsonb not null default '{}'::jsonb, updated_at timestamptz not null default now()
);
create table if not exists public.mow_customer_access (
 company_id uuid not null, customer_id uuid not null, user_id uuid not null references auth.users(id),
 primary key(company_id,customer_id,user_id),foreign key(company_id,customer_id) references public.mow_customers(company_id,id)
);
create index if not exists mow_customer_access_user on public.mow_customer_access(user_id);
create table if not exists public.mow_insight_allowances (
 company_id uuid primary key references public.mow_crew_companies(id), remaining integer not null default 0 check(remaining>=0),
 enabled boolean not null default false, updated_at timestamptz not null default now()
);
create table if not exists public.mow_yard_assessments (
 id uuid primary key, company_id uuid not null references public.mow_crew_companies(id), job_id uuid not null,
 actor_id uuid not null references auth.users(id),photo_ids uuid[] not null, state text not null check(state in ('processing','owner_review','failed')),
 result jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(job_id) references public.mow_crew_jobs(id)
);
create index if not exists mow_yard_assessments_company on public.mow_yard_assessments(company_id,created_at);
create index if not exists mow_yard_assessments_job on public.mow_yard_assessments(job_id);
create index if not exists mow_yard_assessments_actor on public.mow_yard_assessments(actor_id);
create table if not exists public.mow_yard_offers (
 id uuid primary key,company_id uuid not null,customer_id uuid not null,assessment_id uuid not null references public.mow_yard_assessments(id),
 title text not null check(length(title) between 1 and 100),description text not null check(length(description) between 1 and 1000),
 quote jsonb not null, catalog_revision integer not null, state text not null default 'offered' check(state in ('offered','accepted','declined','withdrawn')),
 responded_by uuid references auth.users(id), responded_at timestamptz,created_at timestamptz not null default now(),
 foreign key(company_id,customer_id) references public.mow_customers(company_id,id)
);
create index if not exists mow_yard_offers_customer on public.mow_yard_offers(company_id,customer_id);
create index if not exists mow_yard_offers_assessment on public.mow_yard_offers(assessment_id);
create index if not exists mow_yard_offers_responder on public.mow_yard_offers(responded_by);
do $$ declare t text; begin
 foreach t in array array['mow_owner_settings','mow_customer_access','mow_insight_allowances','mow_yard_assessments','mow_yard_offers'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;

create or replace function public.mow_settings_save(actor uuid,cid uuid,expected_revision integer,new_catalog jsonb,new_labor jsonb) returns jsonb
language plpgsql security invoker set search_path=public,pg_temp as $$
declare s mow_owner_settings;
begin
 perform 1 from mow_crew_companies where id=cid for update;
 if not exists(select 1 from mow_crew_members where company_id=cid and user_id=actor and role='owner') then raise exception 'Owner access required';end if;
 select * into s from mow_owner_settings where company_id=cid;
 if coalesce(s.revision,0)<>expected_revision then raise exception 'Settings changed. Reload before saving';end if;
 if jsonb_typeof(new_catalog)<>'object' or jsonb_typeof(new_labor)<>'object' or length(new_catalog::text)>200000 or length(new_labor::text)>100000 then raise exception 'Invalid configuration';end if;
 insert into mow_owner_settings(company_id,revision,catalog,labor) values(cid,expected_revision+1,new_catalog,new_labor)
 on conflict(company_id) do update set revision=excluded.revision,catalog=excluded.catalog,labor=excluded.labor,updated_at=now();
 return jsonb_build_object('revision',expected_revision+1);
end $$;

create or replace function public.mow_insight_reserve(actor uuid,cid uuid,jid uuid,rid uuid,pids uuid[],daily_limit integer) returns jsonb
language plpgsql security invoker set search_path=public,pg_temp as $$
declare a mow_yard_assessments; allowance mow_insight_allowances;
begin
 -- Company lock serializes both quota and idempotency. Global lock bounds daily provider spend.
 perform pg_advisory_xact_lock(20261010,1);
 perform 1 from mow_crew_companies where id=cid for update;
 if not exists(select 1 from mow_crew_members where company_id=cid and user_id=actor and role='owner') then raise exception 'Owner access required';end if;
 select * into a from mow_yard_assessments where id=rid;
 if found then
 if a.company_id<>cid or a.actor_id<>actor or a.job_id<>jid or a.photo_ids<>pids then raise exception 'Request conflict';end if;
 return jsonb_build_object('claimed',false,'state',a.state,'result',a.result);
 end if;
 if daily_limit not between 1 and 1000 or (select count(*) from mow_yard_assessments where created_at>=date_trunc('day',now()))>=daily_limit then raise exception 'Daily analysis limit reached';end if;
 if not exists(select 1 from mow_crew_jobs where id=jid and company_id=cid and cancelled_at is null) then raise exception 'Job unavailable';end if;
 if cardinality(pids) not between 1 and 3 or cardinality(pids)<>(select count(distinct x) from unnest(pids)x) or cardinality(pids)<>(select count(*) from mow_crew_photos where id=any(pids) and job_id=jid and company_id=cid) then raise exception 'Choose authorized job photos';end if;
 select * into allowance from mow_insight_allowances where company_id=cid for update;
 if not found or not allowance.enabled or allowance.remaining<1 then raise exception 'Photo Insights allowance is not activated';end if;
 update mow_insight_allowances set remaining=remaining-1,updated_at=now() where company_id=cid;
 insert into mow_yard_assessments(id,company_id,job_id,actor_id,photo_ids,state) values(rid,cid,jid,actor,pids,'processing');
 return jsonb_build_object('claimed',true);
end $$;

create or replace function public.mow_insight_finish(rid uuid,cid uuid,success boolean,assessment jsonb) returns boolean
language plpgsql security invoker set search_path=public,pg_temp as $$
declare a mow_yard_assessments;
begin
 select * into a from mow_yard_assessments where id=rid and company_id=cid for update;
 if not found or a.state<>'processing' then return false;end if;
 if success and (jsonb_typeof(assessment)<>'object' or length(assessment::text)>30000) then raise exception 'Invalid result';end if;
 update mow_yard_assessments set state=case when success then 'owner_review' else 'failed' end,result=case when success then assessment else null end,updated_at=now() where id=rid;
 if not success then update mow_insight_allowances set remaining=remaining+1,updated_at=now() where company_id=cid;end if;
 return true;
end $$;

create or replace function public.mow_customer_link(actor uuid,cid uuid,customer uuid) returns boolean
language plpgsql security invoker set search_path=public,pg_temp as $$
declare customer_email text; uid uuid;
begin
 if not exists(select 1 from mow_crew_members where company_id=cid and user_id=actor and role='owner') then raise exception 'Owner access required';end if;
 select lower(trim(email)) into customer_email from mow_customers where id=customer and company_id=cid;
 if coalesce(customer_email,'')='' then raise exception 'Customer email required';end if;
 select id into uid from auth.users where lower(email)=customer_email and email_confirmed_at is not null;
 if uid is null then raise exception 'Customer must create and confirm their account first';end if;
 insert into mow_customer_access(company_id,customer_id,user_id) values(cid,customer,uid) on conflict do nothing;
 return true;
end $$;

create or replace function public.mow_yard_respond(actor uuid,offer uuid,choice text) returns jsonb
language plpgsql security invoker set search_path=public,pg_temp as $$
declare o mow_yard_offers;
begin
 select * into o from mow_yard_offers where id=offer for update;
 if not found or not exists(select 1 from mow_customer_access where company_id=o.company_id and customer_id=o.customer_id and user_id=actor) then raise exception 'Offer unavailable';end if;
 if choice not in ('accepted','declined') then raise exception 'Invalid response';end if;
 if o.state=choice then return jsonb_build_object('state',o.state,'duplicate',true);end if;
 if o.state<>'offered' then raise exception 'Offer is no longer open';end if;
 update mow_yard_offers set state=choice,responded_by=actor,responded_at=now() where id=offer;
 return jsonb_build_object('state',choice,'scheduling_required',choice='accepted','charged',false);
end $$;
revoke all on function public.mow_settings_save(uuid,uuid,integer,jsonb,jsonb),public.mow_insight_reserve(uuid,uuid,uuid,uuid,uuid[],integer),public.mow_insight_finish(uuid,uuid,boolean,jsonb),public.mow_customer_link(uuid,uuid,uuid),public.mow_yard_respond(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.mow_settings_save(uuid,uuid,integer,jsonb,jsonb),public.mow_insight_reserve(uuid,uuid,uuid,uuid,uuid[],integer),public.mow_insight_finish(uuid,uuid,boolean,jsonb),public.mow_customer_link(uuid,uuid,uuid),public.mow_yard_respond(uuid,uuid,text) to service_role;

create or replace function public.mow_yard_publish(actor uuid,cid uuid,aid uuid,oid uuid,revision integer,t text,d text,q jsonb) returns jsonb
language plpgsql security invoker set search_path=public,pg_temp as $$
declare a mow_yard_assessments;j mow_crew_jobs;o mow_yard_offers;
begin
 perform 1 from mow_crew_companies where id=cid for update;
 if not exists(select 1 from mow_crew_members where company_id=cid and user_id=actor and role='owner') then raise exception 'Owner access required';end if;
 if not exists(select 1 from mow_owner_settings where company_id=cid and mow_owner_settings.revision=mow_yard_publish.revision) then raise exception 'Catalog changed. Rebuild quote';end if;
 select * into a from mow_yard_assessments where id=aid and company_id=cid and state='owner_review';if not found then raise exception 'Assessment unavailable';end if;
 select * into j from mow_crew_jobs where id=a.job_id and company_id=cid;
 if j.customer_id is null then raise exception 'Customer connection required';end if;
 select * into o from mow_yard_offers where id=oid;
 if found then
 if o.company_id<>cid or o.assessment_id<>aid or o.quote<>q or o.title<>t or o.description<>d then raise exception 'Offer conflict';end if;
 return jsonb_build_object('id',oid,'duplicate',true);
 end if;
 if jsonb_typeof(q)<>'object' or length(q::text)>30000 or (q->>'perVisitCents')::integer<=0 then raise exception 'Invalid optional quote';end if;
 insert into mow_yard_offers(id,company_id,customer_id,assessment_id,title,description,quote,catalog_revision) values(oid,cid,j.customer_id,aid,t,d,q,revision);
 return jsonb_build_object('id',oid,'charged',false,'state','offered');
end $$;
revoke all on function public.mow_yard_publish(uuid,uuid,uuid,uuid,integer,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.mow_yard_publish(uuid,uuid,uuid,uuid,integer,text,text,jsonb) to service_role;
