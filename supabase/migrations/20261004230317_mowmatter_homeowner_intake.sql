create table public.mowmatter_homeowner_requests (
id uuid primary key default gen_random_uuid(),
created_at timestamptz not null default now(),
email text not null check(length(email)<=254),
first_name text not null default '' check(length(first_name)<=80),
phone text not null default '' check(length(phone)<=32),
address text not null check(length(address)<=200),
city text not null check(length(city)<=80),
state text not null check(length(state)=2),
zip text not null check(zip ~ '^[0-9]{5}$'),
services jsonb not null,
frequency text not null,
lawn_height text not null default 'unsure',
access_notes text not null default '' check(length(access_notes)<=1000),
preferred_date date,
request_consent boolean not null default true,
source jsonb not null default '{}'::jsonb,
status text not null default 'awaiting_provider',
submission_id uuid not null unique
);
alter table public.mowmatter_homeowner_requests enable row level security;
revoke all on public.mowmatter_homeowner_requests from anon,authenticated;
grant all on public.mowmatter_homeowner_requests to service_role;
alter table public.mowmatter_leads add column interest text not null default 'platform';
