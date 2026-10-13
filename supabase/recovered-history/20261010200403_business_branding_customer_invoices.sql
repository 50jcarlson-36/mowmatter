alter table public.mow_crew_companies add column if not exists branding jsonb not null default '{}'::jsonb;
create table if not exists public.mow_customer_invoices (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.mow_crew_companies(id),
 customer_id uuid not null, job_id uuid not null unique references public.mow_crew_jobs(id),
 number bigint generated always as identity unique, amount_cents integer not null check(amount_cents>0),
 snapshot jsonb not null, email_status text not null default 'draft' check(email_status in ('draft','sending','sent','failed')), email_attempt_at timestamptz, created_at timestamptz not null default now(),
 foreign key(company_id,customer_id) references public.mow_customers(company_id,id)
);
create index if not exists mow_customer_invoice_scope on public.mow_customer_invoices(company_id,customer_id);
alter table public.mow_customer_invoices enable row level security;
revoke all on public.mow_customer_invoices from public,anon,authenticated;
grant all on public.mow_customer_invoices to service_role;
grant usage,select on sequence public.mow_customer_invoices_number_seq to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('mow-business-logos','mow-business-logos',true,2097152,array['image/png','image/jpeg','image/webp']) on conflict(id) do nothing;
-- Runs in the same transaction as completion. Private invoice data never has public access.
create or replace function public.mow_make_customer_invoice() returns trigger
language plpgsql security invoker set search_path=public as $$
declare co public.mow_crew_companies; cu public.mow_customers;
begin
 if new.status='completed' and new.cancelled_at is null and new.customer_id is not null and new.price_cents>0 then
  select * into co from public.mow_crew_companies where id=new.company_id;
  if co.branding->>'auto_invoice'='true' then
   select * into cu from public.mow_customers where id=new.customer_id and company_id=new.company_id;
   if found then
    insert into public.mow_customer_invoices(company_id,customer_id,job_id,amount_cents,snapshot)
    values(new.company_id,new.customer_id,new.id,new.price_cents,jsonb_build_object('business',co.name,'branding',co.branding,'customer',cu.name,'address',new.address,'service_date',new.service_date,'services',new.services)) on conflict(job_id) do nothing;
   end if;
  end if;
 end if;
 return new;
end $$;
drop trigger if exists mow_customer_invoice_completion on public.mow_crew_jobs;
create trigger mow_customer_invoice_completion after insert or update of status on public.mow_crew_jobs for each row execute function public.mow_make_customer_invoice();
revoke all on function public.mow_make_customer_invoice() from public,anon,authenticated;
