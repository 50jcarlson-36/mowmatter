-- Offer texts requested outside the recipient's quiet-hours window are deferred, not dropped.
-- The API decides the window (api/commerce/quiet-hours.mjs); this stores the deferral and
-- claims due messages for the worker. Pending legal review of Florida and federal rules.
alter table public.mow_quote_messages add column if not exists send_after timestamptz;
alter table public.mow_quote_messages drop constraint if exists mow_quote_messages_status_check;
alter table public.mow_quote_messages add constraint mow_quote_messages_status_check
 check(status in ('deferred','sending','accepted','sent','delivered','undelivered','failed'));
create index if not exists mow_quote_messages_deferred_due on public.mow_quote_messages(send_after) where status='deferred';
create or replace function public.mow_quote_sms_claim_due() returns jsonb language plpgsql security invoker set search_path='' as $$
declare m public.mow_quote_messages;q public.mow_customer_quotes;c public.mow_customer_channels;co public.mow_crew_companies;
begin
 select * into m from public.mow_quote_messages where status='deferred' and send_after<=now() order by send_after limit 1 for update skip locked;
 if not found then return jsonb_build_object('claimed',false,'status','idle');end if;
 select * into q from public.mow_customer_quotes where id=m.quote_id;
 select * into c from public.mow_customer_channels where company_id=m.company_id and customer_id=q.customer_id;
 if c.phone is not null then perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sms:'||c.phone,0));end if;
 -- Recheck at send time: a quote that lapsed or a customer who withdrew consent or replied STOP while deferred is never texted.
 if q.id is null or q.state<>'sent' or q.expires_at<=now() or c.phone is null or not c.sms_offer_consent
    or exists(select 1 from public.mow_sms_suppressions where phone=c.phone) then
  update public.mow_quote_messages set status='failed',updated_at=now() where quote_id=m.quote_id;
  return jsonb_build_object('claimed',false,'status','cancelled');
 end if;
 update public.mow_quote_messages set status='sending',updated_at=now() where quote_id=m.quote_id;
 select * into co from public.mow_crew_companies where id=m.company_id;
 return jsonb_build_object('claimed',true,'quote_id',m.quote_id,'company_id',m.company_id,'customer_id',q.customer_id,'phone',c.phone,
  'company_name',co.name,'amount_cents',q.amount_cents,'business_time_zone',co.communication_timezone);
end $$;
revoke all on function public.mow_quote_sms_claim_due() from public,anon,authenticated;
grant execute on function public.mow_quote_sms_claim_due() to service_role;
