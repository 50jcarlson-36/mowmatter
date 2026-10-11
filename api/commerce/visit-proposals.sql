create table public.mow_visit_proposals (
 id uuid primary key,company_id uuid not null references public.mow_crew_companies(id),customer_id uuid not null,
 job_id uuid not null references public.mow_crew_jobs(id),actor_id uuid not null references auth.users(id),
 title text not null check(length(title) between 3 and 100),scope text not null check(length(scope) between 3 and 1500),
 state text not null default 'pending' check(state in ('pending','quoted','declined')),created_at timestamptz not null default now(),
 foreign key(company_id,customer_id) references public.mow_customers(company_id,id)
);
create index mow_visit_proposals_scope on public.mow_visit_proposals(company_id,created_at desc);
alter table public.mow_visit_proposals enable row level security;
revoke all on public.mow_visit_proposals from public,anon,authenticated;
grant select,insert,update on public.mow_visit_proposals to service_role;
alter table public.mow_customer_quotes add column source_proposal_id uuid unique references public.mow_visit_proposals(id);
create function public.mow_visit_propose(actor uuid,jid uuid,rid uuid,t text,d text) returns boolean language plpgsql security invoker set search_path='' as $$
declare j public.mow_crew_jobs;r text;existing public.mow_visit_proposals;
begin
 select * into j from public.mow_crew_jobs where id=jid for update;
 if not found or j.customer_id is null or j.cancelled_at is not null or j.status='completed' then raise exception 'Active visit with a customer required';end if;
 select role into r from public.mow_crew_members where company_id=j.company_id and user_id=actor;
 if r is null or (r not in ('owner','lead') and j.assigned_to is distinct from actor) then raise exception 'Visit access denied';end if;
 select * into existing from public.mow_visit_proposals where id=rid;
 if found then if existing.actor_id<>actor or existing.job_id<>jid then raise exception 'Proposal conflict';end if;return true;end if;
 if (select count(*) from public.mow_visit_proposals where job_id=jid and created_at>now()-interval '1 day')>=10 then raise exception 'Proposal limit reached';end if;
 insert into public.mow_visit_proposals(id,company_id,customer_id,job_id,actor_id,title,scope) values(rid,j.company_id,j.customer_id,jid,actor,trim(t),trim(d));
 return true;
end $$;
revoke all on function public.mow_visit_propose(uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.mow_visit_propose(uuid,uuid,uuid,text,text) to service_role;
