alter table public.mow_homeowner_subscriptions add column event_created bigint not null default 0;
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

revoke all on function public.mow_homeowner_sync(text,text,bigint,uuid,uuid,text,text,text,bigint,bigint,boolean,text) from public,anon,authenticated;
grant execute on function public.mow_homeowner_sync(text,text,bigint,uuid,uuid,text,text,text,bigint,bigint,boolean,text) to service_role;
drop function public.mow_homeowner_sync(text,text,uuid,uuid,text,text,text,bigint,bigint,boolean,text);
alter table public.mow_customer_invoices add column if not exists due_at timestamptz not null default (now()+interval '14 days');
alter table public.mow_customer_invoices add column if not exists settlement_status text not null default 'open' check(settlement_status in ('open','paid_external','void'));
create table public.mow_invoice_deliveries (
 invoice_id uuid not null references public.mow_customer_invoices(id),step integer not null check(step between 0 and 2),
 company_id uuid not null references public.mow_crew_companies(id),status text not null default 'sending' check(status in ('sending','sent','needs_review')),
 created_at timestamptz not null default now(),provider_id text,primary key(invoice_id,step)
);
alter table public.mow_invoice_deliveries enable row level security;
revoke all on public.mow_invoice_deliveries from public,anon,authenticated;
grant select,insert,update on public.mow_invoice_deliveries to service_role;
create function public.mow_invoice_delivery_claim(iid uuid,stage integer,cid uuid,manual boolean) returns boolean language plpgsql security invoker set search_path='' as $$
declare i public.mow_customer_invoices;j public.mow_crew_jobs;c public.mow_customers;co public.mow_crew_companies;
begin
 if stage not between 0 and 2 then raise exception 'Invalid delivery stage';end if;
 select * into i from public.mow_customer_invoices where id=iid and company_id=cid for update;
 if not found or i.settlement_status<>'open' then return false;end if;
 select * into j from public.mow_crew_jobs where id=i.job_id and company_id=cid;
 if j.status<>'completed' or j.cancelled_at is not null then return false;end if;
 if exists(select 1 from public.mow_payment_checkouts where job_id=j.id and status='paid') or exists(select 1 from public.mow_homeowner_subscriptions where plan_id=j.plan_id) then return false;end if;
 select * into c from public.mow_customers where id=i.customer_id and company_id=cid;
 if not c.notification_consent or c.email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then return false;end if;
 select * into co from public.mow_crew_companies where id=cid;
 if stage=0 then
  if i.email_status not in ('draft','failed') then return false;end if;
  if not manual and co.branding->>'auto_send_invoice' is distinct from 'true' then return false;end if;
 else
  if co.branding->>'invoice_reminders' is distinct from 'true' or i.email_status<>'sent' or now()<i.due_at+make_interval(days=>stage*7) then return false;end if;
 end if;
 insert into public.mow_invoice_deliveries(invoice_id,step,company_id) values(iid,stage,cid) on conflict do nothing;
 if not found then return false;end if;
 if stage=0 then update public.mow_customer_invoices set email_status='sending',email_attempt_at=now() where id=iid;end if;
 return true;
end $$;
revoke all on function public.mow_invoice_delivery_claim(uuid,integer,uuid,boolean) from public,anon,authenticated;
grant execute on function public.mow_invoice_delivery_claim(uuid,integer,uuid,boolean) to service_role;
alter table public.mow_customer_invoices add column if not exists settlement_note text not null default '';
alter table public.mow_customer_invoices add column if not exists settlement_by uuid references auth.users(id);
alter table public.mow_customer_invoices add column if not exists settlement_at timestamptz;
create function public.mow_invoice_delivery_candidates() returns setof public.mow_customer_invoices language sql security invoker set search_path='' as $$
 select i.* from public.mow_customer_invoices i join public.mow_crew_companies co on co.id=i.company_id join public.mow_crew_jobs j on j.id=i.job_id join public.mow_customers c on c.id=i.customer_id and c.company_id=i.company_id
 where i.settlement_status='open' and j.status='completed' and j.cancelled_at is null and c.notification_consent and c.email<>''
 and not exists(select 1 from public.mow_payment_checkouts p where p.job_id=j.id and p.status='paid')
 and not exists(select 1 from public.mow_homeowner_subscriptions s where s.plan_id=j.plan_id)
 and ((co.branding->>'auto_send_invoice'='true' and i.email_status in ('draft','failed') and not exists(select 1 from public.mow_invoice_deliveries d where d.invoice_id=i.id and d.step=0))
 or (co.branding->>'invoice_reminders'='true' and i.email_status='sent' and i.due_at+interval '7 days'<=now() and not exists(select 1 from public.mow_invoice_deliveries d where d.invoice_id=i.id and d.step=case when i.due_at+interval '14 days'<=now() then 2 else 1 end)))
 order by i.created_at limit 10;
$$;
revoke all on function public.mow_invoice_delivery_candidates() from public,anon,authenticated;
grant execute on function public.mow_invoice_delivery_candidates() to service_role;
