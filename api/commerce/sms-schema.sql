create table public.mow_customer_channels (
 company_id uuid not null,customer_id uuid not null,phone text not null check(phone ~ '^\+1[2-9][0-9]{9}$'),
 sms_offer_consent boolean not null default false,consented_by uuid not null references auth.users(id),consented_at timestamptz not null default now(),notice_version text not null,
 primary key(company_id,customer_id),foreign key(company_id,customer_id) references public.mow_customers(company_id,id)
);
create table public.mow_sms_suppressions(phone text primary key,created_at timestamptz not null default now());
create table public.mow_quote_messages (
 quote_id uuid primary key references public.mow_customer_quotes(id),company_id uuid not null references public.mow_crew_companies(id),
 status text not null default 'sending' check(status in ('sending','accepted','sent','delivered','undelivered','failed')),provider_id text unique,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
do $$ declare t text;begin foreach t in array array['mow_customer_channels','mow_sms_suppressions','mow_quote_messages'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant select,insert,update on public.%I to service_role',t);
end loop;end $$;
create function public.mow_sms_preferences(actor uuid,actor_email text,cid uuid,customer uuid,p_phone text,consent boolean) returns boolean language plpgsql security invoker set search_path='' as $$
declare cu public.mow_customers;
begin
 select * into cu from public.mow_customers where company_id=cid and id=customer;
 if not found or actor_email is null or cu.email='' or lower(actor_email)<>lower(cu.email) then raise exception 'Customer access denied';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sms:'||p_phone,0));
 if consent and exists(select 1 from public.mow_sms_suppressions where phone=p_phone) then raise exception 'This number opted out by text. Contact support to verify re-enrollment';end if;
 insert into public.mow_customer_channels(company_id,customer_id,phone,sms_offer_consent,consented_by,notice_version) values(cid,customer,p_phone,consent,actor,'2026-10-11')
 on conflict(company_id,customer_id) do update set phone=excluded.phone,sms_offer_consent=excluded.sms_offer_consent,consented_by=actor,consented_at=now(),notice_version='2026-10-11';
 return true;
end $$;
create function public.mow_sms_stop(p_phone text) returns boolean language plpgsql security invoker set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sms:'||p_phone,0));
 insert into public.mow_sms_suppressions(phone) values(p_phone) on conflict do nothing;
 update public.mow_customer_channels set sms_offer_consent=false where phone=p_phone;
 return true;
end $$;
create function public.mow_quote_sms_claim(qid uuid,cid uuid,actor uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare q public.mow_customer_quotes;c public.mow_customer_channels;
begin
 if not exists(select 1 from public.mow_crew_members where company_id=cid and user_id=actor and role='owner') then raise exception 'Owner access required';end if;
 select * into q from public.mow_customer_quotes where id=qid and company_id=cid for update;
 if not found or q.state<>'sent' or q.expires_at<=now() then raise exception 'Quote unavailable';end if;
 select * into c from public.mow_customer_channels where company_id=cid and customer_id=q.customer_id;
 if not found or not c.sms_offer_consent then raise exception 'Customer SMS offer consent required';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sms:'||c.phone,0));
 if exists(select 1 from public.mow_sms_suppressions where phone=c.phone) then raise exception 'Customer opted out of SMS';end if;
 if (select count(*) from public.mow_quote_messages m join public.mow_customer_quotes x on x.id=m.quote_id where x.company_id=cid and x.customer_id=q.customer_id and m.created_at>now()-interval '1 day')>=3 then raise exception 'Daily offer message limit reached';end if;
 insert into public.mow_quote_messages(quote_id,company_id) values(qid,cid) on conflict do nothing;
 if not found then return jsonb_build_object('claimed',false);end if;
 return jsonb_build_object('claimed',true,'phone',c.phone,'customer_id',q.customer_id);
end $$;
revoke all on function public.mow_sms_preferences(uuid,text,uuid,uuid,text,boolean),public.mow_sms_stop(text),public.mow_quote_sms_claim(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.mow_sms_preferences(uuid,text,uuid,uuid,text,boolean),public.mow_sms_stop(text),public.mow_quote_sms_claim(uuid,uuid,uuid) to service_role;
