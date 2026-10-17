-- Raise Solo Starter customer allowance; retain paid-tier, credit and crew rules.
create or replace function public.mow_plan_limits(cid uuid) returns jsonb language sql stable security invoker set search_path=public as $$
 select jsonb_build_object('customers',case p when 'growth' then 50 when 'scale' then null else 49 end,
 'credits',case p when 'growth' then 300 when 'scale' then 1000 else 70 end,
 'crews',1+case when p<>'starter' then addons else 0 end)
 from (select coalesce((select case when paid and status='active' and plan in ('growth','scale') then plan else 'starter' end from mow_billing_accounts where company_id=cid),'starter') p,
 coalesce((select crew_addons from mow_billing_accounts where company_id=cid),0) addons) t;
$$;
