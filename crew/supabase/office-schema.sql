-- Persistent Office records. Private tables are accessed only by authenticated Edge actions.
create table if not exists public.mow_customers (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.mow_crew_companies(id),
 name text not null check(length(name) between 1 and 100), address text not null check(length(address) between 3 and 200),
 city text not null default 'Palm Coast, FL', email text not null default '', phone text not null default '',
 notes text not null default '', latitude double precision, longitude double precision,
 notification_consent boolean not null default false, created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(), unique(company_id,id)
);
create table if not exists public.mow_service_plans (
 id uuid primary key, company_id uuid not null references public.mow_crew_companies(id), customer_id uuid not null,
 assigned_to uuid not null, interval_days integer not null check(interval_days in (7,14,28)),
 first_date date not null, scheduled_time time not null default '09:00', price_cents integer not null check(price_cents between 0 and 10000000),
 services text[] not null, requires_photo boolean not null default true, active boolean not null default true,
 created_at timestamptz not null default now(), unique(company_id,id),
 foreign key(company_id,customer_id) references public.mow_customers(company_id,id),
 foreign key(company_id,assigned_to) references public.mow_crew_members(company_id,user_id)
);
alter table public.mow_crew_jobs add column if not exists customer_id uuid;
alter table public.mow_crew_jobs add column if not exists plan_id uuid;
alter table public.mow_crew_jobs add column if not exists recurrence_date date;
alter table public.mow_crew_jobs add column if not exists price_cents integer not null default 0;
alter table public.mow_crew_jobs add column if not exists cancelled_at timestamptz;
alter table public.mow_crew_jobs add column if not exists cancellation_reason text;
alter table public.mow_crew_jobs add column if not exists cancellation_source text;
do $$ begin
 if not exists(select 1 from pg_constraint where conname='mow_job_customer_scope') then
  alter table public.mow_crew_jobs add constraint mow_job_customer_scope foreign key(company_id,customer_id) references public.mow_customers(company_id,id);
  alter table public.mow_crew_jobs add constraint mow_job_plan_scope foreign key(company_id,plan_id) references public.mow_service_plans(company_id,id);
 end if;
end $$;
create unique index if not exists mow_job_recurrence on public.mow_crew_jobs(plan_id,recurrence_date);
create table if not exists public.mow_cash_entries (
 id uuid primary key, company_id uuid not null references public.mow_crew_companies(id), kind text not null check(kind in ('income','expense')),
 amount_cents integer not null check(amount_cents between 1 and 10000000), entry_date date not null, note text not null check(length(note) between 1 and 300),
 created_at timestamptz not null default now()
);
create index if not exists mow_customers_company on public.mow_customers(company_id);
create index if not exists mow_plans_customer on public.mow_service_plans(company_id,customer_id);
create index if not exists mow_plans_assignment on public.mow_service_plans(company_id,assigned_to);
create index if not exists mow_cash_company on public.mow_cash_entries(company_id,entry_date);
create index if not exists mow_jobs_customer on public.mow_crew_jobs(company_id,customer_id);
create index if not exists mow_jobs_plan on public.mow_crew_jobs(company_id,plan_id);
create index if not exists mow_events_company on public.mow_crew_events(company_id);
create index if not exists mow_notifications_company on public.mow_crew_notifications(company_id);
create index if not exists mow_notifications_job on public.mow_crew_notifications(job_id);
create index if not exists mow_photos_company on public.mow_crew_photos(company_id);
create index if not exists mow_directory_owner on public.mowmatter_directory_listings(owner_user_id);
create index if not exists mow_featured_listing on public.mowmatter_featured_placements(listing_id);
alter table public.mow_customers enable row level security;
alter table public.mow_service_plans enable row level security;
alter table public.mow_cash_entries enable row level security;
revoke all on public.mow_customers,public.mow_service_plans,public.mow_cash_entries from public,anon,authenticated;
grant all on public.mow_customers,public.mow_service_plans,public.mow_cash_entries to service_role;

create or replace function public.mow_office_action(actor uuid,cid uuid,command text,payload jsonb) returns jsonb
language plpgsql security invoker set search_path=public as $$
declare c mow_customers; p mow_service_plans; j mow_crew_jobs; rid uuid; count_new integer:=0; d date; stop_date date; old_event mow_crew_events;
begin
 -- Serializes concurrent plan creation, generation and edits for one business.
 perform 1 from mow_crew_companies where id=cid for update;
 if not exists(select 1 from mow_crew_members where company_id=cid and user_id=actor and role='owner') then raise exception 'Owner access required'; end if;
 if command='save_customer' then
  rid:=(payload->>'id')::uuid;
  select * into c from mow_customers where id=rid;
  if found and c.company_id<>cid then raise exception 'Customer access denied'; end if;
  if length(trim(coalesce(payload->>'name',''))) not between 1 and 100 or length(trim(coalesce(payload->>'address',''))) not between 3 and 200 then raise exception 'Enter customer name and property address'; end if;
  if length(coalesce(payload->>'email',''))>254 or length(coalesce(payload->>'phone',''))>30 or length(coalesce(payload->>'notes',''))>1500 then raise exception 'Customer details are too long';end if;
  if (nullif(payload->>'latitude','') is null)<>(nullif(payload->>'longitude','') is null) then raise exception 'Enter both coordinates or neither';end if;
  if abs(nullif(payload->>'latitude','')::double precision)>90 or abs(nullif(payload->>'longitude','')::double precision)>180 then raise exception 'Invalid coordinates';end if;
  insert into mow_customers(id,company_id,name,address,city,email,phone,notes,latitude,longitude,notification_consent)
  values(rid,cid,trim(payload->>'name'),trim(payload->>'address'),left(coalesce(payload->>'city','Palm Coast, FL'),100),coalesce(payload->>'email',''),coalesce(payload->>'phone',''),coalesce(payload->>'notes',''),nullif(payload->>'latitude','')::double precision,nullif(payload->>'longitude','')::double precision,coalesce((payload->>'notification_consent')::boolean,false))
  on conflict(id) do update set name=excluded.name,address=excluded.address,city=excluded.city,email=excluded.email,phone=excluded.phone,notes=excluded.notes,latitude=excluded.latitude,longitude=excluded.longitude,notification_consent=excluded.notification_consent,updated_at=now() where mow_customers.company_id=cid;
  if not found then raise exception 'Customer access denied';end if;
  return jsonb_build_object('ok',true,'customer_id',rid);
 elsif command='create_plan' then
  rid:=(payload->>'id')::uuid;
  select * into p from mow_service_plans where id=rid;
  if found then if p.company_id<>cid then raise exception 'Plan access denied';end if;return jsonb_build_object('ok',true,'plan_id',rid,'duplicate',true);end if;
  if exists(select 1 from mow_service_plans where company_id=cid and customer_id=(payload->>'customer_id')::uuid and active) then raise exception 'This customer already has an active service plan. Pause it before replacing it';end if;
  if (payload->>'first_date')::date < (now() at time zone 'America/New_York')::date or (payload->>'first_date')::date > (now() at time zone 'America/New_York')::date+365 then raise exception 'First visit must be within the next year';end if;
  if jsonb_typeof(payload->'services')<>'array' or jsonb_array_length(payload->'services')=0 or exists(select 1 from jsonb_array_elements_text(payload->'services')s where s not in ('Mow','Edge','Trim','Blow','Cleanup')) then raise exception 'Select valid services';end if;
  insert into mow_service_plans(id,company_id,customer_id,assigned_to,interval_days,first_date,scheduled_time,price_cents,services,requires_photo)
  values(rid,cid,(payload->>'customer_id')::uuid,(payload->>'assigned_to')::uuid,(payload->>'interval_days')::integer,(payload->>'first_date')::date,(payload->>'scheduled_time')::time,(payload->>'price_cents')::integer,array(select jsonb_array_elements_text(payload->'services')),coalesce((payload->>'requires_photo')::boolean,true));
  return public.mow_office_action(actor,cid,'generate_plan',jsonb_build_object('id',rid,'through',(payload->>'first_date')::date+60));
 elsif command in ('generate_plan','pause_plan','resume_plan') then
  rid:=(payload->>'id')::uuid; select * into p from mow_service_plans where id=rid and company_id=cid for update;
  if not found then raise exception 'Plan unavailable';end if;
  if command='pause_plan' then
   update mow_service_plans set active=false where id=rid;
   update mow_crew_jobs set cancelled_at=now(),cancellation_reason='Plan paused',cancellation_source='plan_pause',updated_at=now() where plan_id=rid and service_date>=(now() at time zone 'America/New_York')::date and status='scheduled' and cancelled_at is null;
   return jsonb_build_object('ok',true);
  end if;
  if command='resume_plan' then
   update mow_service_plans set active=true where id=rid;p.active:=true;
   update mow_crew_jobs set cancelled_at=null,cancellation_reason=null,cancellation_source=null,updated_at=now() where plan_id=rid and service_date>=(now() at time zone 'America/New_York')::date and status='scheduled' and cancellation_source='plan_pause';
  end if;
  if not p.active then raise exception 'Resume the plan before generating visits';end if;
  stop_date:=coalesce((payload->>'through')::date,(now() at time zone 'America/New_York')::date+60);
  if stop_date>greatest((now() at time zone 'America/New_York')::date,p.first_date)+93 then raise exception 'Generate no more than 93 days at once';end if;
  select * into c from mow_customers where id=p.customer_id and company_id=cid;
  for d in select x::date from generate_series(p.first_date::timestamp,stop_date::timestamp,make_interval(days=>p.interval_days))x where x::date>=(now() at time zone 'America/New_York')::date loop
   insert into mow_crew_jobs(company_id,customer_id,plan_id,recurrence_date,assigned_to,customer_name,address,city,service_date,scheduled_time,services,notes,latitude,longitude,requires_photo,customer_email,customer_phone,notification_consent,price_cents)
   values(cid,c.id,p.id,d,p.assigned_to,c.name,c.address,c.city,d,p.scheduled_time,p.services,c.notes,c.latitude,c.longitude,p.requires_photo,c.email,c.phone,c.notification_consent,p.price_cents)
   on conflict(plan_id,recurrence_date) do nothing;
   if found then count_new:=count_new+1;end if;
  end loop;
  return jsonb_build_object('ok',true,'plan_id',rid,'generated',count_new);
 elsif command='edit_job' then
  rid:=(payload->>'id')::uuid;select * into j from mow_crew_jobs where id=rid and company_id=cid for update;
  if not found then raise exception 'Job unavailable';end if;
  if j.status not in ('scheduled','blocked') or j.cancelled_at is not null then raise exception 'Only scheduled or blocked active jobs can be changed';end if;
  if not exists(select 1 from mow_crew_members where company_id=cid and user_id=(payload->>'assigned_to')::uuid) then raise exception 'Choose a member of this business';end if;
  if (payload->>'service_date')::date < (now() at time zone 'America/New_York')::date then raise exception 'Choose today or a future date';end if;
  update mow_crew_jobs set assigned_to=(payload->>'assigned_to')::uuid,service_date=(payload->>'service_date')::date,scheduled_time=(payload->>'scheduled_time')::time,notes=left(coalesce(payload->>'notes',j.notes),1500),updated_at=now() where id=rid;
  return jsonb_build_object('ok',true);
 elsif command='cancel_job' then
  rid:=(payload->>'id')::uuid;select * into j from mow_crew_jobs where id=rid and company_id=cid for update;
  if not found or j.status not in ('scheduled','blocked') then raise exception 'Only scheduled or blocked jobs can be cancelled';end if;
  if length(trim(coalesce(payload->>'reason','')))<3 then raise exception 'Add a cancellation reason';end if;
  update mow_crew_jobs set cancelled_at=coalesce(cancelled_at,now()),cancellation_reason=left(payload->>'reason',300),cancellation_source='owner',updated_at=now() where id=rid;
  return jsonb_build_object('ok',true);
 elsif command='cash_entry' then
  rid:=(payload->>'id')::uuid;
  if exists(select 1 from mow_cash_entries where id=rid and company_id<>cid) then raise exception 'Entry access denied';end if;
  insert into mow_cash_entries(id,company_id,kind,amount_cents,entry_date,note) values(rid,cid,payload->>'kind',(payload->>'amount_cents')::integer,(payload->>'entry_date')::date,trim(payload->>'note')) on conflict(id) do nothing;
  return jsonb_build_object('ok',true);
 end if;
 raise exception 'Unknown Office action';
end $$;
revoke all on function public.mow_office_action(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.mow_office_action(uuid,uuid,text,jsonb) to service_role;

create or replace function public.mow_crew_transition(actor uuid,jid uuid,eid uuid,verb text,details jsonb) returns jsonb language plpgsql security invoker set search_path=public as $$declare j mow_crew_jobs; r text;e mow_crew_events;n text;company_name text;begin select * into j from mow_crew_jobs where id=jid for update;if not found then raise exception 'Job unavailable';end if;select role into r from mow_crew_members where company_id=j.company_id and user_id=actor;if r is null or (r not in ('owner','lead') and j.assigned_to is distinct from actor) then raise exception 'Job access denied';end if;select * into e from mow_crew_events where id=eid;if found then if e.job_id<>jid or e.actor_id<>actor or e.action<>verb then raise exception 'Event conflict';end if;select status into n from mow_crew_notifications where event_id=eid;return jsonb_build_object('ok',true,'duplicate',true,'status',j.status,'notification_status',n);end if;
if j.cancelled_at is not null then raise exception 'This visit was cancelled. Refresh your route';end if; if verb='check_in' then if j.status not in ('scheduled','blocked') then raise exception 'Cannot check in from this job status';end if;j.status='arrived';j.arrived_at=coalesce(j.arrived_at,now());
elsif verb='start' then if j.status not in ('scheduled','arrived','blocked') then raise exception 'Job cannot be started';end if;j.status='in_progress';j.arrived_at=coalesce(j.arrived_at,now());j.started_at=coalesce(j.started_at,now());
elsif verb='complete' then if j.status<>'in_progress' then raise exception 'Start the job before completing it';end if;if not (to_jsonb(j.services) <@ coalesce(details->'completed_tasks','[]'::jsonb)) then raise exception 'Complete the service checklist';end if;if j.requires_photo and not exists(select 1 from mow_crew_photos where job_id=jid) then raise exception 'Add a completion photo';end if;j.status='completed';j.completed_at=now();
elsif verb='issue' then if j.status='completed' then raise exception 'Completed job cannot be blocked';end if;if length(coalesce(details->>'reason',''))<3 then raise exception 'Describe the issue';end if;j.status='blocked';else raise exception 'Unknown action';end if;
insert into mow_crew_events(id,company_id,job_id,actor_id,action,payload) values(eid,j.company_id,jid,actor,verb,details);update mow_crew_jobs set status=j.status,arrived_at=j.arrived_at,started_at=j.started_at,completed_at=j.completed_at,updated_at=now() where id=jid;
if verb in ('start','complete') then select name into company_name from mow_crew_companies where id=j.company_id;n=case when not j.notification_consent then 'held_no_consent' when coalesce(j.customer_email,'')='' and coalesce(j.customer_phone,'')='' then 'held_no_contact' else 'pending_provider' end;insert into mow_crew_notifications(company_id,job_id,event_id,channel,body,status) values(j.company_id,jid,eid,case when coalesce(j.customer_phone,'')<>'' then 'sms' else 'email' end,case when verb='start' then 'Good news—'||company_name||' is starting your lawn care at '||j.address||'. We’ll let you know when your yard is ready.' else 'Fresh cut. Clean edges. All handled. '||company_name||' has finished your lawn care at '||j.address||'. Your yard is ready to enjoy.' end,n);end if;return jsonb_build_object('ok',true,'status',j.status,'notification_status',n);end$$;
