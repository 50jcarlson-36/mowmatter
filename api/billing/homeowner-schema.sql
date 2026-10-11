create table public.mow_homeowner_subscriptions (
 plan_id uuid primary key references public.mow_service_plans(id),company_id uuid not null references public.mow_crew_companies(id),customer_id uuid not null,
 event_created bigint not null default 0,monthly_cents integer not null check(monthly_cents between 1 and 10000000),terms text not null check(length(terms) between 3 and 1500),
 snapshot jsonb not null,status text not null default 'proposed',stripe_customer text,subscription_id text unique,checkout_session text unique,
 nonce uuid,lease_until timestamptz,accepted_by uuid references auth.users(id),accepted_at timestamptz,notice_version text,
 period_start bigint,period_end bigint,cancel_at_period_end boolean not null default false,last_invoice_status text,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 foreign key(company_id,customer_id) references public.mow_customers(company_id,id)
);
alter table public.mow_homeowner_subscriptions enable row level security;
revoke all on public.mow_homeowner_subscriptions from public,anon,authenticated;
grant select,insert,update on public.mow_homeowner_subscriptions to service_role;
create index mow_homeowner_subscriptions_customer on public.mow_homeowner_subscriptions(company_id,customer_id);
create function public.mow_homeowner_checkout_claim(pid uuid,cid uuid,customer uuid,actor uuid,actor_email text,token uuid) returns boolean
language plpgsql security invoker set search_path='' as $$
declare s public.mow_homeowner_subscriptions;p public.mow_service_plans;cu public.mow_customers;
begin
 select * into s from public.mow_homeowner_subscriptions where plan_id=pid and company_id=cid and customer_id=customer for update;
 if not found then raise exception 'Plan unavailable';end if;
 select * into p from public.mow_service_plans where id=pid and company_id=cid and customer_id=customer;
 select * into cu from public.mow_customers where id=customer and company_id=cid;
 if actor_email is null or cu.email='' or lower(actor_email)<>lower(cu.email) then raise exception 'Customer access denied';end if;
 if not p.active or p.price_cents is distinct from (s.snapshot->>'per_visit_cents')::integer or p.interval_days is distinct from (s.snapshot->>'interval_days')::integer then raise exception 'Service plan changed. Ask the provider for a new proposal';end if;
 if s.status not in ('proposed','incomplete_expired') or s.subscription_id is not null then raise exception 'Manage the existing subscription';end if;
 if s.lease_until>now() then return false;end if;
 update public.mow_homeowner_subscriptions set nonce=token,lease_until=now()+interval '31 minutes',accepted_by=actor,accepted_at=now(),notice_version='2026-10-11',checkout_session=null,updated_at=now() where plan_id=pid;
 return true;
end $$;
create function public.mow_homeowner_sync(eid text,etype text,ec bigint,pid uuid,cid uuid,subid text,scustomer text,new_state text,pstart bigint,pend bigint,cancel_end boolean,invoice_state text) returns boolean
language plpgsql security invoker set search_path='' as $$
declare s public.mow_homeowner_subscriptions;
begin
 perform 1 from public.mow_crew_companies where id=cid for update;
 select * into s from public.mow_homeowner_subscriptions where plan_id=pid and company_id=cid for update;
 if not found or s.accepted_at is null or s.stripe_customer is distinct from scustomer or (s.subscription_id is not null and s.subscription_id<>subid) then raise exception 'Subscription record mismatch';end if;
 if s.event_created>ec or (s.status='canceled' and new_state<>'canceled') then return false;end if;
 insert into public.mow_billing_events(event_id,event_type) values(eid,etype) on conflict do nothing;
 if not found then return false;end if;
 update public.mow_homeowner_subscriptions set event_created=ec,subscription_id=subid,status=new_state,period_start=pstart,period_end=pend,cancel_at_period_end=cancel_end,last_invoice_status=invoice_state,updated_at=now() where plan_id=pid;
 if new_state='canceled' then
  update public.mow_service_plans set active=false where id=pid and company_id=cid;
  update public.mow_crew_jobs set cancelled_at=now(),cancellation_source='subscription_cancel',cancellation_reason='Recurring payment plan ended',updated_at=now() where plan_id=pid and company_id=cid and cancelled_at is null and status in ('scheduled','blocked') and service_date>=(now() at time zone 'America/New_York')::date;
 end if;
 return true;
end $$;
revoke all on function public.mow_homeowner_checkout_claim(uuid,uuid,uuid,uuid,text,uuid),public.mow_homeowner_sync(text,text,bigint,uuid,uuid,text,text,text,bigint,bigint,boolean,text) from public,anon,authenticated;
grant execute on function public.mow_homeowner_checkout_claim(uuid,uuid,uuid,uuid,text,uuid),public.mow_homeowner_sync(text,text,bigint,uuid,uuid,text,text,text,bigint,bigint,boolean,text) to service_role;
create function public.mow_guard_recurring_service_changes() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if exists(select 1 from public.mow_homeowner_subscriptions s where s.plan_id=new.id and s.status not in ('proposed','canceled','incomplete_expired')) then
  if new.active is distinct from old.active or new.price_cents is distinct from old.price_cents or new.interval_days is distinct from old.interval_days or new.services is distinct from old.services then raise exception 'Manage recurring billing before changing this authorized service plan';end if;
 end if;
 return new;
end $$;
create trigger mow_guard_recurring_service_changes before update on public.mow_service_plans for each row execute function public.mow_guard_recurring_service_changes();
revoke all on function public.mow_guard_recurring_service_changes() from public,anon,authenticated;
