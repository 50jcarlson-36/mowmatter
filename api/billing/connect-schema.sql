create table if not exists public.mow_payment_checkouts (
 job_id uuid primary key references public.mow_crew_jobs(id),
 company_id uuid not null references public.mow_crew_companies(id),
 session_id text unique, nonce uuid not null, lease_until timestamptz,
 amount_cents integer not null check(amount_cents>0), fee_bps integer not null check(fee_bps in (150,250,350)),
 fee_cents integer not null check(fee_cents>=0), status text not null default 'pending',
 event_created bigint not null default 0, created_at timestamptz not null default now()
);
alter table public.mow_payment_checkouts enable row level security;
revoke all on public.mow_payment_checkouts from anon,authenticated;
grant all on public.mow_payment_checkouts to service_role;
create or replace function public.mow_payment_claim(jid uuid,cid uuid,token uuid,amount integer,bps integer,fee integer)
returns boolean language plpgsql security invoker set search_path=public as $$
begin
 insert into mow_payment_checkouts(job_id,company_id,nonce,lease_until,amount_cents,fee_bps,fee_cents)
 values(jid,cid,token,now()+interval '31 minutes',amount,bps,fee)
 on conflict(job_id) do update set nonce=token,lease_until=now()+interval '31 minutes',amount_cents=amount,fee_bps=bps,fee_cents=fee,session_id=null
 where mow_payment_checkouts.company_id=cid and mow_payment_checkouts.status!='paid' and mow_payment_checkouts.lease_until<now();
 return found;
end $$;
create or replace function public.mow_payment_event(eid text,etype text,ec bigint,cid uuid,sid text,state text)
returns boolean language plpgsql security invoker set search_path=public as $$
begin
 if state not in ('paid','pending','failed') then raise exception 'Invalid payment state'; end if;
 insert into mow_billing_events(event_id,event_type) values(eid,etype) on conflict do nothing;
 if not found then return false; end if;
 update mow_payment_checkouts set status=state,event_created=ec where company_id=cid and session_id=sid and event_created<=ec and status!='paid';
 return true;
end $$;
revoke all on function public.mow_payment_claim(uuid,uuid,uuid,integer,integer,integer),public.mow_payment_event(text,text,bigint,uuid,text,text) from public,anon,authenticated;
grant execute on function public.mow_payment_claim(uuid,uuid,uuid,integer,integer,integer),public.mow_payment_event(text,text,bigint,uuid,text,text) to service_role;


-- Persistent connected-payment activity (no customer details or raw event payloads).
create table if not exists public.mow_payment_activity (
 event_id text primary key,
 company_id uuid not null references public.mow_crew_companies(id),
 account_id text not null,
 event_type text not null check (event_type in ('charge.refunded','charge.dispute.created','charge.dispute.updated','charge.dispute.closed','payout.paid','payout.failed')),
 object_id text not null,
 amount_cents bigint not null check(amount_cents>=0),
 currency text not null,
 status text not null,
 event_created bigint not null,
 created_at timestamptz not null default now()
);
create index if not exists mow_payment_activity_company_time on public.mow_payment_activity(company_id,event_created desc);
alter table public.mow_payment_activity enable row level security;
revoke all on public.mow_payment_activity from public,anon,authenticated;
grant select,insert on public.mow_payment_activity to service_role;