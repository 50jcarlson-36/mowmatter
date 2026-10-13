create table public.mowmatter_directory_listings (
 id uuid primary key default gen_random_uuid(),
 created_at timestamptz not null default now(),
 owner_user_id uuid references auth.users(id),
 company_name text not null,
 public_slug text not null unique,
 description text not null default '',
 service_zips text[] not null default '{}',
 services text[] not null default '{}',
 latitude double precision,
 longitude double precision,
 status text not null default 'pending' check(status in ('pending','approved','suspended'))
);
alter table public.mowmatter_directory_listings enable row level security;
revoke all on public.mowmatter_directory_listings from anon,authenticated;
grant all on public.mowmatter_directory_listings to service_role;
create table public.mowmatter_featured_placements (
 id uuid primary key default gen_random_uuid(),
 listing_id uuid not null references public.mowmatter_directory_listings(id),
 zip text not null check(zip ~ '^[0-9]{5}$'),
 starts_at timestamptz not null,
 ends_at timestamptz not null check(ends_at>starts_at),
 payment_confirmed boolean not null default false,
 payment_reference text unique
);
alter table public.mowmatter_featured_placements enable row level security;
revoke all on public.mowmatter_featured_placements from anon,authenticated;
grant all on public.mowmatter_featured_placements to service_role;
alter table public.mowmatter_leads add column featured_zip text;
