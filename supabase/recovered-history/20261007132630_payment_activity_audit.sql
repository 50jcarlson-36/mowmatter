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
