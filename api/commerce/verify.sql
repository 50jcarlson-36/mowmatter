begin;
insert into auth.users(id,email,email_confirmed_at) values
('d1111111-1111-4111-8111-111111111111','owner-commerce@example.invalid',now()),
('d2222222-2222-4222-8222-222222222222','customer-commerce@example.invalid',now());
insert into public.mow_crew_companies(id,owner_id,name) values('d3333333-3333-4333-8333-333333333333','d1111111-1111-4111-8111-111111111111','Commerce rollback test');
insert into public.mow_crew_members(company_id,user_id,role) values('d3333333-3333-4333-8333-333333333333','d1111111-1111-4111-8111-111111111111','owner');
insert into public.mow_customers(id,company_id,name,address,email) values('d4444444-4444-4444-8444-444444444444','d3333333-3333-4333-8333-333333333333','Test customer','Test address','customer-commerce@example.invalid');
set local role service_role;
do $$
declare co uuid:='d3333333-3333-4333-8333-333333333333';cu uuid:='d4444444-4444-4444-8444-444444444444';own uuid:='d1111111-1111-4111-8111-111111111111';actor uuid:='d2222222-2222-4222-8222-222222222222';qid uuid:=gen_random_uuid();jid uuid;pid uuid:=gen_random_uuid();extra uuid;result jsonb;today date:=(now() at time zone 'America/New_York')::date;
begin
 perform public.mow_commerce_action(own,'owner-commerce@example.invalid',co,cu,'quote',jsonb_build_object('id',qid,'title','Extra cleanup','scope','Remove approved clippings','services',jsonb_build_array('Cleanup'),'amount_cents',2500,'planned_minutes',30,'expires_at',now()+interval '1 day','terms','Total includes applicable tax. No recurring charge.','confirm_review',true));
 begin
  perform public.mow_commerce_action(actor,'wrong@example.invalid',co,cu,'respond',jsonb_build_object('id',qid,'choice','accepted','confirm_quote',true,'expected_amount_cents',2500,'notice_version','2026-10-11'));
  raise exception 'Cross-customer access should fail';
 exception when others then if sqlerrm='Cross-customer access should fail' then raise;end if;end;
 begin
  perform public.mow_commerce_action(actor,'customer-commerce@example.invalid',co,cu,'respond',jsonb_build_object('id',qid,'choice','accepted','confirm_quote',true,'expected_amount_cents',1,'notice_version','2026-10-11'));
  raise exception 'Forged amount should fail';
 exception when others then if sqlerrm='Forged amount should fail' then raise;end if;end;
 perform public.mow_commerce_action(actor,'customer-commerce@example.invalid',co,cu,'respond',jsonb_build_object('id',qid,'choice','accepted','confirm_quote',true,'expected_amount_cents',2500,'notice_version','2026-10-11'));
 result:=public.mow_commerce_action(own,'owner-commerce@example.invalid',co,cu,'book',jsonb_build_object('id',qid,'service_date',today,'scheduled_time','12:00','assigned_to',own,'confirm_booking',true));
 jid:=(result->>'job_id')::uuid;
 result:=public.mow_commerce_action(own,'owner-commerce@example.invalid',co,cu,'book',jsonb_build_object('id',qid,'service_date',today,'scheduled_time','12:00','assigned_to',own,'confirm_booking',true));
 if (result->>'job_id')::uuid<>jid or not (result->>'duplicate')::boolean then raise exception 'Booking must be idempotent';end if;
 if (select count(*) from public.mow_crew_jobs where company_id=co)<>1 then raise exception 'Duplicate job';end if;
 perform public.mow_commerce_action(actor,'customer-commerce@example.invalid',co,cu,'request',jsonb_build_object('id',gen_random_uuid(),'kind','reschedule','job_id',jid,'message','Please move to tomorrow','preferred_date',today+1));
 if (select service_date from public.mow_crew_jobs where id=jid)<>today then raise exception 'Request changed booking automatically';end if;
 perform public.mow_sms_preferences(actor,'customer-commerce@example.invalid',co,cu,'+13865551234',true);
 perform public.mow_sms_stop('+13865551234');
 if (select sms_offer_consent from public.mow_customer_channels where company_id=co and customer_id=cu) then raise exception 'STOP not enforced';end if;

 insert into public.mow_service_plans(id,company_id,customer_id,assigned_to,interval_days,first_date,price_cents,services) values(pid,co,cu,own,14,today,2500,array['Mow']);
 insert into public.mow_homeowner_subscriptions(plan_id,company_id,customer_id,monthly_cents,terms,snapshot,status,stripe_customer,subscription_id,accepted_by,accepted_at) values(pid,co,cu,5435,'Monthly lawn service',jsonb_build_object('per_visit_cents',2500,'interval_days',14),'active','cus_rollback','sub_rollback',actor,now());
 update public.mow_crew_jobs set plan_id=pid,status='in_progress' where id=jid;
 begin
  update public.mow_service_plans set price_cents=9999 where id=pid;
  raise exception 'Authorized recurring price change should fail';
 exception when others then if sqlerrm='Authorized recurring price change should fail' then raise;end if;end;
 qid:=gen_random_uuid();
 perform public.mow_commerce_action(own,'owner-commerce@example.invalid',co,cu,'quote',jsonb_build_object('id',qid,'title','Visit add-on','scope','Approved one-time hedge trim','services',jsonb_build_array('Hedge trim'),'amount_cents',1500,'planned_minutes',30,'expires_at',now()+interval '1 day','terms','One-time total includes applicable tax','confirm_review',true));
 perform public.mow_commerce_action(actor,'customer-commerce@example.invalid',co,cu,'respond',jsonb_build_object('id',qid,'choice','accepted','confirm_quote',true,'expected_amount_cents',1500,'notice_version','2026-10-11'));
 result:=public.mow_commerce_action(own,'owner-commerce@example.invalid',co,cu,'apply-addon',jsonb_build_object('id',qid,'job_id',jid,'confirm_addon',true));
 extra:=(result->>'job_id')::uuid;
 if extra=jid or (select plan_id from public.mow_crew_jobs where id=extra) is not null or (select price_cents from public.mow_crew_jobs where id=extra)<>1500 then raise exception 'Recurring add-on must have a separate one-time job';end if;
 result:=public.mow_commerce_action(own,'owner-commerce@example.invalid',co,cu,'apply-addon',jsonb_build_object('id',qid,'job_id',jid,'confirm_addon',true));
 if (result->>'job_id')::uuid<>extra or not (result->>'duplicate')::boolean then raise exception 'Add-on retry duplicated work';end if;
 if (select price_cents from public.mow_service_plans where id=pid)<>2500 or (select monthly_cents from public.mow_homeowner_subscriptions where plan_id=pid)<>5435 then raise exception 'Add-on modified recurring charge';end if;
end $$;
select 'customer authorization, forged amount, idempotent booking, request review SMS STOP, separate recurring add-ons and billing guards passed' as result;
rollback;
