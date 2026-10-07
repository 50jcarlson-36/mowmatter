begin;
do $$
declare actor uuid:=gen_random_uuid(); cid uuid:=gen_random_uuid(); lead1 uuid:=gen_random_uuid(); lead2 uuid:=gen_random_uuid(); lead3 uuid:=gen_random_uuid(); center extensions.geography; r jsonb; p jsonb;
begin
 insert into auth.users(id,email,email_confirmed_at) values(actor,'growth-test-'||actor||'@example.invalid',now());
 insert into public.mow_crew_companies(id,owner_id,name,business_zip) values(cid,actor,'Transactional growth test','00001');
 insert into public.mow_crew_members(company_id,user_id,role) values(cid,actor,'owner');
 perform public.mow_growth_zip('00001',30,-81);
 select location into center from public.mow_zip_centers where zip='00001';
 insert into public.mowmatter_homeowner_requests(id,submission_id,email,first_name,address,city,state,zip,services,frequency,request_consent,lead_sharing_consent,no_provider_found,lead_location)
 values(lead1,gen_random_uuid(),'growth-test-a@example.invalid','Test','Test Street','Test','FL','00001','["mowing"]','weekly',true,true,true,extensions.st_project(center,10*1609.344,0)),
 (lead2,gen_random_uuid(),'growth-test-b@example.invalid','Test','Test Street','Test','FL','00001','["mowing"]','weekly',true,true,true,extensions.st_project(center,20*1609.344,0));
 insert into public.mowmatter_homeowner_requests(submission_id,email,address,city,state,zip,services,frequency,request_consent,lead_sharing_consent,no_provider_found,lead_location,created_at)
 values(gen_random_uuid(),'old-growth-test@example.invalid','Test Street','Test','FL','00001','["mowing"]','weekly',true,true,true,center,now()-interval '31 days'),
 (gen_random_uuid(),'no-consent-growth-test@example.invalid','Test Street','Test','FL','00001','["mowing"]','weekly',true,false,true,center,now()),
 (gen_random_uuid(),'already-serviced-growth-test@example.invalid','Test Street','Test','FL','00001','["mowing"]','weekly',true,true,false,center,now());
 r:=public.mow_growth_alerts(actor,cid,'00001',15);
 if (r->>'new_count')::int<>1 then raise exception 'Initial dashboard count failed'; end if;
 if exists(select 1 from public.mow_growth_profiles where company_id=cid and initial_ids is not null) then raise exception 'Alert consumed incentive'; end if;
 r:=public.mow_growth_scan(actor,cid,'00001',15,0);
 if (r->>'count')::int<>1 or r->>'access_reason'<>'locked' or jsonb_array_length(r->'leads')<>0 then raise exception 'Free paywall test failed: %',r; end if;
 r:=public.mow_growth_scan(actor,cid,'00001',25,0);
 if (r->>'count')::int<>2 then raise exception 'Radius expansion failed'; end if;
 r:=public.mow_growth_alerts(actor,cid,'00001',15);
 if (r->>'new_count')::int<>0 then raise exception 'Scan did not clear alerts'; end if;
 begin perform public.mow_growth_scan(gen_random_uuid(),cid,'00001',15,0);raise exception 'Owner isolation failed';exception when insufficient_privilege then null;end;
 perform public.mow_growth_onboard(actor,cid,'00001','Test Owner','3865550100',array['mowing'],'2026-10-07');
 r:=public.mow_growth_scan(actor,cid,'00001',15,0);
 if r->>'access_reason'<>'onboarding' or (r->>'unlocked_count')::int<>1 then raise exception 'Onboarding grant failed: %',r; end if;
 insert into public.mowmatter_homeowner_requests(id,submission_id,email,first_name,address,city,state,zip,services,frequency,request_consent,lead_sharing_consent,no_provider_found,lead_location)
 values(lead3,gen_random_uuid(),'growth-test-c@example.invalid','Test','Test Street','Test','FL','00001','["mowing"]','weekly',true,true,true,center);
 r:=public.mow_growth_scan(actor,cid,'00001',15,0);
 if (r->>'unlocked_count')::int<>1 then raise exception 'Onboarding grant expanded on repeat scan'; end if;
 insert into public.mow_billing_accounts(company_id,plan,status,paid) values(cid,'growth','active',true);
 r:=public.mow_growth_scan(actor,cid,'00001',25,0);
 if r->>'access_reason'<>'subscription' or (r->>'unlocked_count')::int<>3 then raise exception 'Paid entitlement failed'; end if;
 update public.mow_billing_accounts set plan='scale' where company_id=cid;
 r:=public.mow_growth_scan(actor,cid,'00001',25,0);
 if r->>'access_reason'<>'subscription' then raise exception 'Scale entitlement failed'; end if;
 update public.mow_billing_accounts set status='past_due',paid=false where company_id=cid;
 p:=public.mow_growth_package(actor,cid,'00001',25,1);
 if (p->>'count')::int<>2 or (p->>'amount_cents')::int<>1000 then raise exception 'Approved pricing or already-owned exclusion failed: %',p; end if;
 update public.mow_lead_packages set stripe_session='cs_transaction_test' where id=(p->>'id')::uuid;
 if public.mow_growth_fulfill((p->>'id')::uuid,'cs_transaction_test',1,'usd',false) then raise exception 'Forged amount accepted'; end if;
 perform public.mow_growth_fulfill((p->>'id')::uuid,'cs_transaction_test',1000,'usd',false);
 r:=public.mow_growth_scan(actor,cid,'00001',25,0);
 if (r->>'unlocked_count')::int<>3 then raise exception 'Paid bundle not unlocked'; end if;
 r:=public.mow_growth_scan(actor,cid,'00001',15,0);
 if (r->>'unlocked_count')::int<>2 then raise exception 'Paid bundle hidden by incentive'; end if;
 perform public.mow_growth_fulfill((p->>'id')::uuid,'cs_transaction_test',1000,'usd',true);
 perform public.mow_growth_fulfill((p->>'id')::uuid,'cs_transaction_test',1000,'usd',false);
 if (select status from public.mow_lead_packages where id=(p->>'id')::uuid)<>'refunded' then raise exception 'Delayed payment regranted refunded bundle'; end if;
 update public.mowmatter_homeowner_requests set lead_sharing_consent=false where id=lead2;
 r:=public.mow_growth_scan(actor,cid,'00001',25,0);
 if (r->>'count')::int<>2 then raise exception 'Consent withdrawal not honored'; end if;
 if has_function_privilege('anon','public.mow_growth_scan(uuid,uuid,text,integer,integer)','execute') or has_function_privilege('authenticated','public.mow_growth_scan(uuid,uuid,text,integer,integer)','execute') then raise exception 'RPC directly exposed'; end if;
 -- Latest consent withdrawal must suppress older eligible sign-ups for the same homeowner.
 insert into public.mowmatter_homeowner_requests(submission_id,email,address,city,state,zip,services,frequency,request_consent,lead_sharing_consent,no_provider_found,lead_location,created_at)
 values(gen_random_uuid(),'growth-test-a@example.invalid','Test Street','Test','FL','00001','["mowing"]','weekly',true,false,true,center,now()+interval '1 second');
 r:=public.mow_growth_scan(actor,cid,'00001',25,0);
 if (r->>'count')::int<>1 then raise exception 'Latest consent withdrawal exposed older contact'; end if;
 raise notice 'PASS: radius, paywall, owner isolation, incentive snapshot, paid tiers, purchase amount, refunds, consent and private RPCs';
end $$;
rollback;
