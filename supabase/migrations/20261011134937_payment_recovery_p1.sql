-- A worker lease is not a financial expiration. Preserve every checkout attempt.
create table public.mow_payment_attempts (
 nonce uuid primary key, job_id uuid not null references public.mow_crew_jobs(id),
 company_id uuid not null references public.mow_crew_companies(id),
 replayable boolean not null default true, account_id text, request jsonb, session_id text unique,
 status text not null default 'pending' check(status in ('pending','paid','failed','expired')),
 amount_cents integer not null, fee_bps integer not null, fee_cents integer not null,
 event_created bigint not null default 0, created_at timestamptz not null default now()
);
-- Legacy unknown attempts deliberately have no replay payload: reconciliation is required.
insert into public.mow_payment_attempts(nonce,job_id,company_id,session_id,status,amount_cents,fee_bps,fee_cents,event_created,created_at,replayable)
 select nonce,job_id,company_id,session_id,status,amount_cents,fee_bps,fee_cents,event_created,created_at,false from public.mow_payment_checkouts;
alter table public.mow_payment_attempts enable row level security;
revoke all on public.mow_payment_attempts from public,anon,authenticated;
grant all on public.mow_payment_attempts to service_role;
create table public.mow_webhook_inbox (
 event_id text primary key, event_type text not null, object_id text not null,
 account_id text, event_created bigint not null, livemode boolean not null,
 received_at timestamptz not null default now(), processed_at timestamptz
);
alter table public.mow_webhook_inbox enable row level security;
revoke all on public.mow_webhook_inbox from public,anon,authenticated;
grant select,insert,update on public.mow_webhook_inbox to service_role;
create index mow_webhook_pending on public.mow_webhook_inbox(received_at) where processed_at is null;

create or replace function public.mow_payment_claim(jid uuid,cid uuid,token uuid,amount integer,bps integer,fee integer)
returns boolean language plpgsql security invoker set search_path=public as $$
begin
 perform 1 from mow_crew_jobs where id=jid and company_id=cid for update;
 if not found then raise exception 'Payment job unavailable'; end if;
 insert into mow_payment_checkouts(job_id,company_id,nonce,lease_until,amount_cents,fee_bps,fee_cents)
 values(jid,cid,token,now()+interval '31 minutes',amount,bps,fee)
 on conflict(job_id) do update set nonce=token,lease_until=now()+interval '31 minutes',amount_cents=amount,fee_bps=bps,fee_cents=fee,session_id=null,status='pending',created_at=now(),event_created=0
 where mow_payment_checkouts.company_id=cid and mow_payment_checkouts.status='expired';
 if not found then return false; end if;
 insert into mow_payment_attempts(nonce,job_id,company_id,amount_cents,fee_bps,fee_cents) values(token,jid,cid,amount,bps,fee);
 return true;
end $$;
create function public.mow_payment_prepare(jid uuid,cid uuid,token uuid,account text,request jsonb)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare a mow_payment_attempts;
begin
 perform 1 from mow_payment_checkouts where job_id=jid and company_id=cid and nonce=token and status='pending' for update;
 if not found then raise exception 'Payment attempt unavailable'; end if;
 select * into a from mow_payment_attempts where nonce=token and company_id=cid and job_id=jid for update;
 if not found then raise exception 'Payment attempt unavailable'; end if;
 if a.account_id is null and a.request is null and a.session_id is null and a.created_at>now()-interval '23 hours' then
  if not a.replayable then return to_jsonb(a); end if;
  update mow_payment_attempts set account_id=account,request=mow_payment_prepare.request where nonce=token returning * into a;
 end if;
 if a.account_id is not null and a.account_id<>account then raise exception 'Payment account changed'; end if;
 return to_jsonb(a);
end $$;
create function public.mow_payment_bind(jid uuid,cid uuid,token uuid,sid text)
returns boolean language plpgsql security invoker set search_path=public as $$
begin
 perform 1 from mow_payment_checkouts where job_id=jid and company_id=cid and nonce=token for update;
 if not found then return false; end if;
 update mow_payment_attempts set session_id=sid where nonce=token and company_id=cid and job_id=jid and (session_id is null or session_id=sid);
 if not found then return false; end if;
 update mow_payment_checkouts set session_id=sid where job_id=jid and nonce=token and (session_id is null or session_id=sid);
 return found;
end $$;
create function public.mow_payment_expire(jid uuid,cid uuid,sid text)
returns boolean language plpgsql security invoker set search_path=public as $$
begin
 update mow_payment_checkouts set status='expired' where job_id=jid and company_id=cid and session_id=sid and status in ('pending','failed');
 if not found then return false; end if;
 update mow_payment_attempts set status='expired' where job_id=jid and company_id=cid and session_id=sid and status in ('pending','failed');
 return true;
end $$;
create function public.mow_payment_reconcile(eid text,etype text,ec bigint,cid uuid,sid text,jid uuid,token uuid,amount integer,currency text,account text,state text)
returns boolean language plpgsql security invoker set search_path=public as $$
declare a mow_payment_attempts;
begin
 if state is null or state not in ('paid','pending','failed') or currency is distinct from 'usd' or amount is null or amount<=0 then raise exception 'Invalid payment state or currency'; end if;
 if not exists(select 1 from mow_billing_accounts where company_id=cid and customer_id=account) then raise exception 'Payment account mismatch'; end if;
 perform 1 from mow_payment_checkouts where job_id=jid and company_id=cid for update;
 if not found then return false; end if;
 select * into a from mow_payment_attempts where company_id=cid and job_id=jid and (session_id=sid or (token is not null and nonce=token)) for update;
 if not found then return false; end if;
 if a.amount_cents<>amount or (a.session_id is not null and a.session_id<>sid) or (a.account_id is not null and a.account_id<>account) then raise exception 'Payment record mismatch'; end if;
 if exists(select 1 from mow_billing_events where event_id=eid) then return true; end if;
 insert into mow_billing_events(event_id,event_type) values(eid,etype) on conflict do nothing;
 if not found then return true; end if;
 update mow_payment_attempts set session_id=sid,account_id=account,status=state,event_created=ec
 where nonce=a.nonce and event_created<=ec and status<>'paid';
 -- A paid attempt wins even when a newer attempt is now current.
 update mow_payment_checkouts set status=state,event_created=greatest(event_created,ec),session_id=case when nonce=a.nonce then sid else session_id end
 where job_id=jid and company_id=cid and status<>'paid' and (state='paid' or (nonce=a.nonce and event_created<=ec));
 return true;
end $$;
-- Keep the legacy entry point consistent: unmatched events must not be consumed.
create or replace function public.mow_payment_event(eid text,etype text,ec bigint,cid uuid,sid text,state text)
returns boolean language plpgsql security invoker set search_path=public as $$
declare a mow_payment_attempts; account text;
begin
 select * into a from mow_payment_attempts where session_id=sid and company_id=cid;
 if not found then return false; end if;
 select customer_id into account from mow_billing_accounts where company_id=cid;
 return mow_payment_reconcile(eid,etype,ec,cid,sid,a.job_id,a.nonce,a.amount_cents,'usd',account,state);
end $$;
revoke all on function public.mow_payment_prepare(uuid,uuid,uuid,text,jsonb),public.mow_payment_bind(uuid,uuid,uuid,text),public.mow_payment_expire(uuid,uuid,text),public.mow_payment_reconcile(text,text,bigint,uuid,text,uuid,uuid,integer,text,text,text) from public,anon,authenticated;
grant execute on function public.mow_payment_prepare(uuid,uuid,uuid,text,jsonb),public.mow_payment_bind(uuid,uuid,uuid,text),public.mow_payment_expire(uuid,uuid,text),public.mow_payment_reconcile(text,text,bigint,uuid,text,uuid,uuid,integer,text,text,text) to service_role;
-- Subscription leases also preserve unresolved identities. Known expired sessions can be cleared only after provider reconciliation.
create or replace function public.mow_billing_checkout_claim(cid uuid,nonce uuid)
returns boolean language plpgsql security invoker set search_path=public as $$
begin
 update mow_billing_accounts set checkout_nonce=nonce,checkout_until=now()+interval '31 minutes'
 where company_id=cid and checkout_nonce is null and checkout_session is null;
 return found;
end $$;

create table public.mow_subscription_attempts (
 nonce uuid primary key, company_id uuid not null references public.mow_crew_companies(id),
 kind text not null check(kind in ('office','homeowner')),subject_id uuid not null,
 account_id text, request jsonb, session_id text unique, replayable boolean not null default true,
 status text not null default 'pending' check(status in ('pending','expired')),created_at timestamptz not null default now()
);
alter table public.mow_subscription_attempts enable row level security;
revoke all on public.mow_subscription_attempts from public,anon,authenticated;
grant select,insert,update on public.mow_subscription_attempts to service_role;
insert into public.mow_subscription_attempts(nonce,company_id,kind,subject_id,session_id,replayable,created_at)
 select checkout_nonce,company_id,'office',company_id,checkout_session,false,coalesce(checkout_until-interval '31 minutes',updated_at) from public.mow_billing_accounts where checkout_nonce is not null;
insert into public.mow_subscription_attempts(nonce,company_id,kind,subject_id,session_id,replayable,created_at)
 select nonce,company_id,'homeowner',plan_id,checkout_session,false,coalesce(lease_until-interval '31 minutes',created_at) from public.mow_homeowner_subscriptions where nonce is not null;
create or replace function public.mow_billing_checkout_claim(cid uuid,nonce uuid)
returns boolean language plpgsql security invoker set search_path=public as $$
begin
 update mow_billing_accounts set checkout_nonce=nonce,checkout_until=now()+interval '31 minutes'
 where company_id=cid and checkout_nonce is null and checkout_session is null;
 if not found then return false; end if;
 insert into mow_subscription_attempts(nonce,company_id,kind,subject_id) values(nonce,cid,'office',cid);
 return true;
end $$;
create function public.mow_subscription_prepare(cid uuid,token uuid,kind text,subject uuid,account text,request jsonb)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare a mow_subscription_attempts;
begin
 select * into a from mow_subscription_attempts where nonce=token and company_id=cid and mow_subscription_attempts.kind=mow_subscription_prepare.kind and subject_id=subject for update;
 if not found then return null; end if;
 if a.account_id is not null and a.account_id is distinct from account then raise exception 'Checkout account changed'; end if;
 if a.replayable and a.request is null and request is not null then
 update mow_subscription_attempts set account_id=account,request=mow_subscription_prepare.request where nonce=token returning * into a;
 end if;
 return to_jsonb(a);
end $$;
create function public.mow_subscription_bind(cid uuid,token uuid,sid text)
returns boolean language plpgsql security invoker set search_path=public as $$
declare a mow_subscription_attempts;
begin
 select * into a from mow_subscription_attempts where nonce=token and company_id=cid for update;
 if not found or a.status<>'pending' or (a.session_id is not null and a.session_id<>sid) then return false; end if;
 if a.kind='office' then update mow_billing_accounts set checkout_session=sid where company_id=cid and checkout_nonce=token and (checkout_session is null or checkout_session=sid);
 else update mow_homeowner_subscriptions set checkout_session=sid where company_id=cid and plan_id=a.subject_id and nonce=token and (checkout_session is null or checkout_session=sid); end if;
 if not found then return false; end if;
 update mow_subscription_attempts set session_id=sid where nonce=token;
 return true;
end $$;
create function public.mow_subscription_expire(cid uuid,token uuid,sid text)
returns boolean language plpgsql security invoker set search_path=public as $$
declare a mow_subscription_attempts;
begin
 select * into a from mow_subscription_attempts where nonce=token and company_id=cid and session_id=sid for update;
 if not found then return false; end if;
 if a.kind='office' then update mow_billing_accounts set checkout_nonce=null,checkout_session=null,checkout_until=null where company_id=cid and checkout_nonce=token and checkout_session=sid;
 else update mow_homeowner_subscriptions set nonce=null,checkout_session=null,lease_until=null where company_id=cid and plan_id=a.subject_id and nonce=token and checkout_session=sid and subscription_id is null;end if;
 if not found then return false; end if;
 update mow_subscription_attempts set status='expired' where nonce=token;
 return true;
end $$;
revoke all on function public.mow_subscription_prepare(uuid,uuid,text,uuid,text,jsonb),public.mow_subscription_bind(uuid,uuid,text),public.mow_subscription_expire(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.mow_subscription_prepare(uuid,uuid,text,uuid,text,jsonb),public.mow_subscription_bind(uuid,uuid,text),public.mow_subscription_expire(uuid,uuid,text) to service_role;

create or replace function public.mow_homeowner_checkout_claim(pid uuid,cid uuid,customer uuid,actor uuid,actor_email text,token uuid) returns boolean
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
 if s.nonce is not null or s.checkout_session is not null then return false;end if;
 update public.mow_homeowner_subscriptions set nonce=token,lease_until=now()+interval '31 minutes',accepted_by=actor,accepted_at=now(),notice_version='2026-10-11',checkout_session=null,updated_at=now() where plan_id=pid;
 insert into public.mow_subscription_attempts(nonce,company_id,kind,subject_id) values(token,cid,'homeowner',pid);
 return true;
end $$;
