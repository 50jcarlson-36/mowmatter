-- Entitlements come only from verified billing state. Existing records survive downgrades.
alter table public.mow_billing_accounts add column crew_addons integer not null default 0 check(crew_addons between 0 and 100);
create function public.mow_plan_limits(cid uuid) returns jsonb language sql stable security invoker set search_path=public as $$
 select jsonb_build_object('customers',case p when 'growth' then 50 when 'scale' then null else 10 end,
 'credits',case p when 'growth' then 300 when 'scale' then 1000 else 70 end,
 'crews',1+case when p<>'starter' then addons else 0 end)
 from (select coalesce((select case when paid and status='active' and plan in ('growth','scale') then plan else 'starter' end from mow_billing_accounts where company_id=cid),'starter') p,
 coalesce((select crew_addons from mow_billing_accounts where company_id=cid),0) addons) t;
$$;
create function public.mow_billing_entitlements(cid uuid,eid text,ec bigint,addons integer) returns void language plpgsql security invoker set search_path=public as $$
begin
 if not exists(select 1 from mow_billing_events where event_id=eid) then raise exception 'Verified billing event required'; end if;
 update mow_billing_accounts set crew_addons=addons where company_id=cid and event_created=ec;
end $$;
create function public.mow_customer_cap() returns trigger language plpgsql security invoker set search_path=public as $$
declare cap integer;
begin
 perform 1 from mow_crew_companies where id=new.company_id for update;
 if tg_op='UPDATE' and new.company_id<>old.company_id then raise exception 'Customer business cannot change'; end if;
 -- INSERT ... ON CONFLICT updates remain possible at the limit.
 if exists(select 1 from mow_customers where id=new.id and company_id=new.company_id) then return new; end if;
 cap:=(mow_plan_limits(new.company_id)->>'customers')::integer;
 if cap is not null and (select count(*) from mow_customers where company_id=new.company_id)>=cap then raise exception 'Customer limit reached. Upgrade before adding another customer'; end if;
 return new;
end $$;
create trigger mow_customer_cap before insert or update of company_id on public.mow_customers for each row execute function public.mow_customer_cap();
create table public.mow_usage_credits (
 request_id uuid primary key, company_id uuid not null references public.mow_crew_companies(id),
 actor_id uuid not null, purpose text not null check(purpose in ('setup','photo_insight')),
 period date not null default date_trunc('month',now() at time zone 'UTC')::date,
 status text not null default 'reserved' check(status in ('reserved','used','refunded')), created_at timestamptz not null default now()
);
create index mow_usage_credit_period on public.mow_usage_credits(company_id,period) where status<>'refunded';
alter table public.mow_usage_credits enable row level security;
revoke all on public.mow_usage_credits from public,anon,authenticated;
grant select,insert,update on public.mow_usage_credits to service_role;
create function public.mow_credit_reserve(actor uuid,cid uuid,rid uuid,kind text) returns boolean language plpgsql security invoker set search_path=public as $$
declare cap integer; month date:=date_trunc('month',now() at time zone 'UTC')::date;
begin
 perform 1 from mow_crew_companies where id=cid for update;
 if not exists(select 1 from mow_crew_members where company_id=cid and user_id=actor and role='owner') then raise exception 'Owner access required'; end if;
 if exists(select 1 from mow_usage_credits where request_id=rid) then return false; end if;
 cap:=(mow_plan_limits(cid)->>'credits')::integer;
 if (select count(*) from mow_usage_credits where company_id=cid and period=month and status<>'refunded')>=cap then return false; end if;
 insert into mow_usage_credits(request_id,company_id,actor_id,purpose,period) values(rid,cid,actor,kind,month);
 return true;
end $$;
create function public.mow_credit_finish(cid uuid,rid uuid,success boolean) returns void language plpgsql security invoker set search_path=public as $$
begin
 update mow_usage_credits set status=case when success then 'used' else 'refunded' end where company_id=cid and request_id=rid and status='reserved';
end $$;

create table public.mow_crews (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.mow_crew_companies(id),
 name text not null check(length(name) between 1 and 80), unique(company_id,id)
);
alter table public.mow_crews enable row level security;
revoke all on public.mow_crews from public,anon,authenticated;
grant all on public.mow_crews to service_role;
insert into public.mow_crews(company_id,name) select id,'Main crew' from public.mow_crew_companies;
alter table public.mow_crew_members add column crew_id uuid;
alter table public.mow_crew_members add constraint mow_member_crew_scope foreign key(company_id,crew_id) references public.mow_crews(company_id,id);
update public.mow_crew_members m set crew_id=c.id from public.mow_crews c where c.company_id=m.company_id;
alter table public.mow_crew_jobs add column crew_id uuid;
alter table public.mow_crew_jobs add constraint mow_job_crew_scope foreign key(company_id,crew_id) references public.mow_crews(company_id,id);
update public.mow_crew_jobs j set crew_id=m.crew_id from public.mow_crew_members m where m.company_id=j.company_id and m.user_id=j.assigned_to;
create index mow_jobs_crew_date on public.mow_crew_jobs(company_id,crew_id,service_date,id);
create index mow_jobs_company_date on public.mow_crew_jobs(company_id,service_date,id);
create function public.mow_crew_cap() returns trigger language plpgsql security invoker set search_path=public as $$
begin
 perform 1 from mow_crew_companies where id=new.company_id for update;
 if (select count(*) from mow_crews where company_id=new.company_id)>=(mow_plan_limits(new.company_id)->>'crews')::integer then raise exception 'A paid crew expansion add-on is required'; end if;
 return new;
end $$;
create trigger mow_crew_cap before insert on public.mow_crews for each row execute function public.mow_crew_cap();
create function public.mow_company_default_crew() returns trigger language plpgsql security invoker set search_path=public as $$
begin insert into mow_crews(company_id,name) values(new.id,'Main crew'); return new; end $$;
create trigger mow_company_default_crew after insert on public.mow_crew_companies for each row execute function public.mow_company_default_crew();
create function public.mow_member_default_crew() returns trigger language plpgsql security invoker set search_path=public as $$
begin
 if new.crew_id is null then select id into new.crew_id from mow_crews where company_id=new.company_id order by id limit 1; end if;
 return new;
end $$;
create trigger mow_member_default_crew before insert on public.mow_crew_members for each row execute function public.mow_member_default_crew();
create function public.mow_job_assigned_crew() returns trigger language plpgsql security invoker set search_path=public as $$
begin
 if new.assigned_to is null then new.crew_id:=null;
 else select crew_id into new.crew_id from mow_crew_members where company_id=new.company_id and user_id=new.assigned_to;
 if not found then raise exception 'Assigned member must belong to this business'; end if;
 end if;
 return new;
end $$;
create trigger mow_job_assigned_crew before insert or update of assigned_to,company_id on public.mow_crew_jobs for each row execute function public.mow_job_assigned_crew();
create function public.mow_crew_manage(actor uuid,cid uuid,command text,payload jsonb) returns jsonb language plpgsql security invoker set search_path=public as $$
declare rid uuid;
begin
 perform 1 from mow_crew_companies where id=cid for update;
 if not exists(select 1 from mow_crew_members where company_id=cid and user_id=actor and role='owner') then raise exception 'Owner access required'; end if;
 if command='create_crew' then
  rid:=(payload->>'id')::uuid;
  if not exists(select 1 from mow_crews where id=rid and company_id=cid) then insert into mow_crews(id,company_id,name) values(rid,cid,payload->>'name'); end if;
 elsif command='crew_member' then
  if coalesce(payload->>'role','member') not in ('lead','member') then raise exception 'Choose a field role'; end if;
  update mow_crew_members set crew_id=(payload->>'crew_id')::uuid,role=coalesce(payload->>'role','member') where company_id=cid and user_id=(payload->>'user_id')::uuid and role<>'owner';
  if not found then raise exception 'Crew member unavailable'; end if;
 else raise exception 'Unknown crew command'; end if;
 return jsonb_build_object('ok',true);
end $$;
create function public.mow_job_access(actor uuid,jid uuid) returns boolean language sql stable security invoker set search_path=public as $$
 select exists(select 1 from mow_crew_jobs j join mow_crew_members m on m.company_id=j.company_id and m.user_id=actor where j.id=jid and
 (m.role='owner' or j.assigned_to=actor or (m.role='lead' and m.crew_id=j.crew_id)));
$$;
revoke all on function public.mow_plan_limits(uuid),public.mow_billing_entitlements(uuid,text,bigint,integer),public.mow_customer_cap(),public.mow_credit_reserve(uuid,uuid,uuid,text),public.mow_credit_finish(uuid,uuid,boolean),public.mow_crew_cap(),public.mow_company_default_crew(),public.mow_member_default_crew(),public.mow_job_assigned_crew(),public.mow_crew_manage(uuid,uuid,text,jsonb),public.mow_job_access(uuid,uuid) from public,anon,authenticated;
grant execute on function public.mow_plan_limits(uuid),public.mow_billing_entitlements(uuid,text,bigint,integer),public.mow_customer_cap(),public.mow_credit_reserve(uuid,uuid,uuid,text),public.mow_credit_finish(uuid,uuid,boolean),public.mow_crew_cap(),public.mow_company_default_crew(),public.mow_member_default_crew(),public.mow_job_assigned_crew(),public.mow_crew_manage(uuid,uuid,text,jsonb),public.mow_job_access(uuid,uuid) to service_role;

create or replace function public.mow_crew_transition(actor uuid,jid uuid,eid uuid,verb text,details jsonb) returns jsonb language plpgsql security invoker set search_path=public as $$declare j mow_crew_jobs; r text;e mow_crew_events;n text;company_name text;begin select * into j from mow_crew_jobs where id=jid for update;if not found then raise exception 'Job unavailable';end if;select role into r from mow_crew_members where company_id=j.company_id and user_id=actor;if not public.mow_job_access(actor,jid) then raise exception 'Job access denied';end if;select * into e from mow_crew_events where id=eid;if found then if e.job_id<>jid or e.actor_id<>actor or e.action<>verb then raise exception 'Event conflict';end if;select status into n from mow_crew_notifications where event_id=eid;return jsonb_build_object('ok',true,'duplicate',true,'status',j.status,'notification_status',n);end if;
if j.cancelled_at is not null then raise exception 'This visit was cancelled. Refresh your route';end if; if verb='check_in' then if j.status not in ('scheduled','blocked') then raise exception 'Cannot check in from this job status';end if;j.status='arrived';j.arrived_at=coalesce(j.arrived_at,now());
elsif verb='start' then if j.status not in ('scheduled','arrived','blocked') then raise exception 'Job cannot be started';end if;j.status='in_progress';j.arrived_at=coalesce(j.arrived_at,now());j.started_at=coalesce(j.started_at,now());
elsif verb='complete' then if j.status<>'in_progress' then raise exception 'Start the job before completing it';end if;if not (to_jsonb(j.services) <@ coalesce(details->'completed_tasks','[]'::jsonb)) then raise exception 'Complete the service checklist';end if;if j.requires_photo and not exists(select 1 from mow_crew_photos where job_id=jid) then raise exception 'Add a completion photo';end if;j.status='completed';j.completed_at=now();
elsif verb='issue' then if j.status='completed' then raise exception 'Completed job cannot be blocked';end if;if length(coalesce(details->>'reason',''))<3 then raise exception 'Describe the issue';end if;j.status='blocked';else raise exception 'Unknown action';end if;
insert into mow_crew_events(id,company_id,job_id,actor_id,action,payload) values(eid,j.company_id,jid,actor,verb,details);update mow_crew_jobs set status=j.status,arrived_at=j.arrived_at,started_at=j.started_at,completed_at=j.completed_at,updated_at=now() where id=jid;
if verb in ('start','complete') then select name into company_name from mow_crew_companies where id=j.company_id;n=case when not j.notification_consent then 'held_no_consent' when coalesce(j.customer_email,'')='' and coalesce(j.customer_phone,'')='' then 'held_no_contact' else 'pending_provider' end;insert into mow_crew_notifications(company_id,job_id,event_id,channel,body,status) values(j.company_id,jid,eid,case when coalesce(j.customer_phone,'')<>'' then 'sms' else 'email' end,case when verb='start' then 'Good news—'||company_name||' is starting your lawn care at '||j.address||'. We’ll let you know when your yard is ready.' else 'Fresh cut. Clean edges. All handled. '||company_name||' has finished your lawn care at '||j.address||'. Your yard is ready to enjoy.' end,n);end if;return jsonb_build_object('ok',true,'status',j.status,'notification_status',n);end$$;

create or replace function public.mow_crew_bootstrap(actor uuid,business_name text) returns uuid language plpgsql security invoker set search_path=public as $$declare cid uuid;begin select id into cid from mow_crew_companies where owner_id=actor order by created_at limit 1;if cid is not null then return cid;end if;insert into mow_crew_companies(owner_id,name) values(actor,business_name) returning id into cid;insert into mow_crew_members(company_id,user_id,display_name,role) values(cid,actor,'Owner','owner');return cid;end$$;
create or replace function public.mow_crew_assign_member(actor uuid,cid uuid,member_email text,member_name text) returns uuid
language plpgsql security definer set search_path='' as $$
declare uid uuid;
begin
 if not exists(select 1 from public.mow_crew_members where company_id=cid and user_id=actor and role='owner') then raise exception 'Owner access required';end if;
 select id into uid from auth.users where lower(email)=lower(member_email) and email_confirmed_at is not null limit 1;
 if uid is null then raise exception 'Crew member must first create and verify their account';end if;
 insert into public.mow_crew_members(company_id,user_id,display_name,role) values(cid,uid,member_name,'member') on conflict(company_id,user_id) do update set display_name=excluded.display_name;
 return uid;
end$$;

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
 if not public.mow_credit_reserve(actor,cid,rid,'photo_insight') then raise exception 'Monthly usage credits are exhausted';end if;
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
 perform public.mow_credit_finish(cid,rid,success);
 if not success then update mow_insight_allowances set remaining=remaining+1,updated_at=now() where company_id=cid;end if;
 return true;
end $$;

alter table public.mow_crew_messages add column crew_id uuid;
alter table public.mow_crew_messages add constraint mow_message_crew_scope foreign key(company_id,crew_id) references public.mow_crews(company_id,id);
update public.mow_crew_messages x set crew_id=m.crew_id from public.mow_crew_members m where m.company_id=x.company_id and m.user_id=x.actor_id and m.role<>'owner';
create function public.mow_crew_list_jobs(actor uuid,cid uuid,from_date date,to_date date,after_date date default null,after_time time default null,after_id uuid default null,page_size integer default 200)
returns setof public.mow_crew_jobs language plpgsql security invoker set search_path=public as $$
begin
 if to_date<from_date or to_date-from_date>62 or page_size not between 1 and 200 then raise exception 'Choose a job window up to 62 days'; end if;
 if not exists(select 1 from mow_crew_members where company_id=cid and user_id=actor) then raise exception 'Business access required'; end if;
 return query select j.* from mow_crew_jobs j join mow_crew_members m on m.company_id=j.company_id and m.user_id=actor
 where j.company_id=cid and j.service_date between from_date and to_date
 and (m.role='owner' or (j.cancelled_at is null and (j.assigned_to=actor or (m.role='lead' and j.crew_id=m.crew_id))))
 and (after_id is null or (j.service_date,j.scheduled_time,j.id)>(after_date,after_time,after_id))
 order by j.service_date,j.scheduled_time,j.id limit page_size;
end $$;
revoke all on function public.mow_crew_list_jobs(uuid,uuid,date,date,date,time,uuid,integer) from public,anon,authenticated;
grant execute on function public.mow_crew_list_jobs(uuid,uuid,date,date,date,time,uuid,integer) to service_role;

do $$ declare signature text; definition text; old_guard text; new_guard text; begin
 for signature,old_guard,new_guard in values
 ('public.mow_visit_sms_claim(uuid,uuid)', 'if not exists(select 1 from public.mow_crew_members m where m.company_id=j.company_id and m.user_id=actor and (m.role in (''owner'',''lead'') or j.assigned_to=actor))', 'if not public.mow_job_access(actor,j.id)'),
 ('public.mow_visit_propose(uuid,uuid,uuid,text,text)', 'if r is null or (r not in (''owner'',''lead'') and j.assigned_to is distinct from actor)', 'if not public.mow_job_access(actor,j.id)')
 loop
 if to_regprocedure(signature) is not null then
 definition:=pg_get_functiondef(to_regprocedure(signature));
 if position(old_guard in definition)=0 then raise exception 'Crew guard changed for %; review the migration',signature; end if;
 execute replace(definition,old_guard,new_guard);
 end if;
 end loop;
end $$;

create or replace function public.mow_billing_apply(eid text,etype text,ec bigint,customer text,subscription text,p text,s text,is_paid boolean,pend bigint,cancel_end boolean)
returns boolean language plpgsql security invoker set search_path=public as $$
begin
 perform 1 from mow_crew_companies where id=(select company_id from mow_billing_accounts where customer_id=customer) for update;
 insert into mow_billing_events(event_id,event_type) values(eid,etype) on conflict do nothing;
 if not found then return false; end if;
 update mow_billing_accounts set subscription_id=subscription,plan=p,status=s,paid=is_paid,
 period_end=pend,cancel_at_period_end=cancel_end,event_created=ec,updated_at=now()
 where customer_id=customer and event_created<=ec;
 return true;
end $$;
