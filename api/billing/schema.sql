-- Server-only billing records; browser clients have no grants or policies.
create table if not exists public.mow_billing_accounts (
 company_id uuid primary key references public.mow_crew_companies(id),
 customer_id text unique, subscription_id text, plan text not null default 'starter',
 status text not null default 'free', paid boolean not null default false,
 period_end bigint, cancel_at_period_end boolean not null default false,
 event_created bigint not null default 0, updated_at timestamptz not null default now(),
 checkout_nonce uuid, checkout_until timestamptz, checkout_session text
);
create table if not exists public.mow_billing_events (
 event_id text primary key, event_type text not null, created_at timestamptz not null default now()
);
alter table public.mow_billing_accounts enable row level security;
alter table public.mow_billing_events enable row level security;
revoke all on public.mow_billing_accounts,public.mow_billing_events from anon,authenticated;
grant all on public.mow_billing_accounts,public.mow_billing_events to service_role;
create or replace function public.mow_billing_apply(eid text,etype text,ec bigint,customer text,subscription text,p text,s text,is_paid boolean,pend bigint,cancel_end boolean)
returns boolean language plpgsql security invoker set search_path=public as $$
begin
 insert into mow_billing_events(event_id,event_type) values(eid,etype) on conflict do nothing;
 if not found then return false; end if;
 update mow_billing_accounts set subscription_id=subscription,plan=p,status=s,paid=is_paid,
 period_end=pend,cancel_at_period_end=cancel_end,event_created=ec,updated_at=now()
 where customer_id=customer and event_created<=ec;
 return true;
end $$;
revoke all on function public.mow_billing_apply(text,text,bigint,text,text,text,text,boolean,bigint,boolean) from public,anon,authenticated;
grant execute on function public.mow_billing_apply(text,text,bigint,text,text,text,text,boolean,bigint,boolean) to service_role;
create or replace function public.mow_billing_checkout_claim(cid uuid,nonce uuid)
returns boolean language plpgsql security invoker set search_path=public as $$
begin
 update mow_billing_accounts set checkout_nonce=nonce,checkout_until=now()+interval '31 minutes',checkout_session=null
 where company_id=cid and (checkout_until is null or checkout_until<now());
 return found;
end $$;
revoke all on function public.mow_billing_checkout_claim(uuid,uuid) from public,anon,authenticated;
grant execute on function public.mow_billing_checkout_claim(uuid,uuid) to service_role;
