create function public.mow_guard_recurring_service_changes() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if exists(select 1 from public.mow_homeowner_subscriptions s where s.plan_id=new.id and s.status not in ('proposed','canceled','incomplete_expired')) then
  if new.active is distinct from old.active or new.price_cents is distinct from old.price_cents or new.interval_days is distinct from old.interval_days or new.services is distinct from old.services then raise exception 'Manage recurring billing before changing this authorized service plan';end if;
 end if;
 return new;
end $$;
create trigger mow_guard_recurring_service_changes before update on public.mow_service_plans for each row execute function public.mow_guard_recurring_service_changes();
revoke all on function public.mow_guard_recurring_service_changes() from public,anon,authenticated;
