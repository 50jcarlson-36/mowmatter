-- Google Ads purchase measurement (off unless GOOGLE_ADS_PURCHASE_ENABLED=true on the API).
-- One Google click ID per Office company, saved only when the visitor allowed analytics on
-- mowmatter.com, plus the time and value of that company's first paid subscription.
-- Server-only: browser clients have no grants. Rows are purged after 90 days without a purchase,
-- or 120 days after the purchase (Google stops accepting the click after 90 days).
create table if not exists public.mow_ad_clicks (
 company_id uuid primary key references public.mow_crew_companies(id) on delete cascade,
 gclid text not null check (char_length(gclid) between 10 and 400 and gclid ~ '^[A-Za-z0-9_-]+$'),
 consented_at timestamptz not null,
 saved_at timestamptz not null default now(),
 purchase_at timestamptz,
 value_cents integer check (value_cents >= 0),
 currency text check (currency ~ '^[A-Z]{3}$')
);
create index if not exists mow_ad_clicks_purchase_at on public.mow_ad_clicks(purchase_at) where purchase_at is not null;
alter table public.mow_ad_clicks enable row level security;
revoke all on public.mow_ad_clicks from anon, authenticated;
grant all on public.mow_ad_clicks to service_role;

create or replace function public.mow_ad_clicks_purge()
returns void language sql security invoker set search_path=public as $$
 delete from mow_ad_clicks
 where (purchase_at is null and saved_at < now() - interval '90 days')
    or purchase_at < now() - interval '120 days';
$$;

-- The first consented click for a company wins; later clicks never replace it.
create or replace function public.mow_ad_click_save(cid uuid, click text, consented timestamptz)
returns boolean language plpgsql security invoker set search_path=public as $$
declare saved boolean;
begin
 perform mow_ad_clicks_purge();
 insert into mow_ad_clicks(company_id, gclid, consented_at) values (cid, click, consented)
 on conflict (company_id) do nothing;
 get diagnostics saved = row_count;
 return saved;
end $$;

-- Only the first paid subscription counts, and only within Google's 90-day click window.
-- consented_at comes from the visitor's clock, so allow a day of skew before it.
create or replace function public.mow_ad_purchase_record(cid uuid, cents integer, cur text, at timestamptz)
returns boolean language plpgsql security invoker set search_path=public as $$
declare recorded boolean;
begin
 update mow_ad_clicks set purchase_at = at, value_cents = cents, currency = cur
 where company_id = cid and purchase_at is null
   and at >= consented_at - interval '1 day' and at < consented_at + interval '90 days';
 get diagnostics recorded = row_count;
 perform mow_ad_clicks_purge();
 return recorded;
end $$;

revoke all on function public.mow_ad_clicks_purge(), public.mow_ad_click_save(uuid, text, timestamptz),
 public.mow_ad_purchase_record(uuid, integer, text, timestamptz) from public, anon, authenticated;
grant execute on function public.mow_ad_clicks_purge(), public.mow_ad_click_save(uuid, text, timestamptz),
 public.mow_ad_purchase_record(uuid, integer, text, timestamptz) to service_role;
