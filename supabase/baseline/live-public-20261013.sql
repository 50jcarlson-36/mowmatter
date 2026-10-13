-- Read-only catalog snapshot from pzymmsfjgspvzbivzvkx, 2026-10-13.
-- Restore ONLY into an empty Supabase public application schema. No customer rows.
-- Historical migrations are evidence; do not replay them after this snapshot.
begin;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists postgis with schema extensions;
set local search_path=public,extensions;
create table public.mowmatter_directory_listings (
id uuid NOT NULL DEFAULT gen_random_uuid(),
created_at timestamp with time zone NOT NULL DEFAULT now(),
owner_user_id uuid,
company_name text NOT NULL,
public_slug text NOT NULL,
description text NOT NULL DEFAULT ''::text,
service_zips text[] NOT NULL DEFAULT '{}'::text[],
services text[] NOT NULL DEFAULT '{}'::text[],
latitude double precision,
longitude double precision,
status text NOT NULL DEFAULT 'pending'::text
);
create table public.mowmatter_featured_placements (
id uuid NOT NULL DEFAULT gen_random_uuid(),
listing_id uuid NOT NULL,
zip text NOT NULL,
starts_at timestamp with time zone NOT NULL,
ends_at timestamp with time zone NOT NULL,
payment_confirmed boolean NOT NULL DEFAULT false,
payment_reference text
);
create table public.mow_crew_companies (
id uuid NOT NULL DEFAULT gen_random_uuid(),
owner_id uuid NOT NULL,
name text NOT NULL,
created_at timestamp with time zone NOT NULL DEFAULT now(),
business_zip text,
branding jsonb NOT NULL DEFAULT '{}'::jsonb
);
create table public.mow_crew_members (
company_id uuid NOT NULL,
user_id uuid NOT NULL,
display_name text NOT NULL DEFAULT 'Crew member'::text,
role text NOT NULL
);
create table public.mow_crew_jobs (
id uuid NOT NULL DEFAULT gen_random_uuid(),
company_id uuid NOT NULL,
assigned_to uuid,
customer_name text NOT NULL,
address text NOT NULL,
city text NOT NULL DEFAULT 'Palm Coast, FL'::text,
service_date date NOT NULL,
scheduled_time time without time zone NOT NULL DEFAULT '09:00:00'::time without time zone,
status text NOT NULL DEFAULT 'scheduled'::text,
services text[] NOT NULL DEFAULT ARRAY['Mow'::text, 'Edge'::text, 'Blow'::text],
notes text NOT NULL DEFAULT ''::text,
latitude double precision,
longitude double precision,
requires_photo boolean NOT NULL DEFAULT true,
customer_email text,
customer_phone text,
notification_consent boolean NOT NULL DEFAULT false,
arrived_at timestamp with time zone,
started_at timestamp with time zone,
completed_at timestamp with time zone,
created_at timestamp with time zone NOT NULL DEFAULT now(),
updated_at timestamp with time zone NOT NULL DEFAULT now(),
customer_id uuid,
plan_id uuid,
recurrence_date date,
price_cents integer NOT NULL DEFAULT 0,
cancelled_at timestamp with time zone,
cancellation_reason text,
cancellation_source text,
planned_minutes integer NOT NULL DEFAULT 60
);
create table public.mow_crew_events (
id uuid NOT NULL,
company_id uuid NOT NULL,
job_id uuid NOT NULL,
actor_id uuid NOT NULL,
action text NOT NULL,
payload jsonb NOT NULL DEFAULT '{}'::jsonb,
created_at timestamp with time zone NOT NULL DEFAULT now()
);
create table public.mow_crew_photos (
id uuid NOT NULL,
company_id uuid NOT NULL,
job_id uuid NOT NULL,
actor_id uuid NOT NULL,
storage_path text NOT NULL,
created_at timestamp with time zone NOT NULL DEFAULT now()
);
create table public.mow_crew_notifications (
id uuid NOT NULL DEFAULT gen_random_uuid(),
company_id uuid NOT NULL,
job_id uuid NOT NULL,
event_id uuid NOT NULL,
channel text NOT NULL,
body text NOT NULL,
status text NOT NULL,
created_at timestamp with time zone NOT NULL DEFAULT now()
);
create table public.mow_crew_messages (
id uuid NOT NULL DEFAULT gen_random_uuid(),
company_id uuid NOT NULL,
actor_id uuid NOT NULL,
body text NOT NULL,
created_at timestamp with time zone NOT NULL DEFAULT now()
);
create table public.mowmatter_leads (
id uuid NOT NULL DEFAULT gen_random_uuid(),
created_at timestamp with time zone NOT NULL DEFAULT now(),
email text NOT NULL,
first_name text NOT NULL DEFAULT ''::text,
company text NOT NULL DEFAULT ''::text,
phone text NOT NULL DEFAULT ''::text,
marketing_consent boolean NOT NULL DEFAULT false,
consent_version text NOT NULL DEFAULT '2026-10-04'::text,
source jsonb NOT NULL DEFAULT '{}'::jsonb,
snapshot jsonb,
status text NOT NULL DEFAULT 'early_access'::text,
interest text NOT NULL DEFAULT 'platform'::text,
featured_zip text,
launch_updates boolean NOT NULL DEFAULT true
);
create table public.mowmatter_funnel_events (
id uuid NOT NULL DEFAULT gen_random_uuid(),
created_at timestamp with time zone NOT NULL DEFAULT now(),
event text NOT NULL,
session_id uuid NOT NULL,
source jsonb NOT NULL DEFAULT '{}'::jsonb
);
create table public.mow_property_daily_limits (
day date NOT NULL,
attempts integer NOT NULL DEFAULT 0
);
create table public.mow_property_trials (
company_id uuid NOT NULL,
started_at timestamp with time zone NOT NULL DEFAULT now(),
attempts integer NOT NULL DEFAULT 0
);
create table public.mowmatter_request_limits (
key text NOT NULL,
window_start timestamp with time zone NOT NULL,
hits integer NOT NULL DEFAULT 1
);
create table public.mowmatter_homeowner_requests (
id uuid NOT NULL DEFAULT gen_random_uuid(),
created_at timestamp with time zone NOT NULL DEFAULT now(),
email text NOT NULL,
first_name text NOT NULL DEFAULT ''::text,
phone text NOT NULL DEFAULT ''::text,
address text NOT NULL,
city text NOT NULL,
state text NOT NULL,
zip text NOT NULL,
services jsonb NOT NULL,
frequency text NOT NULL,
lawn_height text NOT NULL DEFAULT 'unsure'::text,
access_notes text NOT NULL DEFAULT ''::text,
preferred_date date,
request_consent boolean NOT NULL DEFAULT true,
source jsonb NOT NULL DEFAULT '{}'::jsonb,
status text NOT NULL DEFAULT 'awaiting_provider'::text,
submission_id uuid NOT NULL,
no_provider_found boolean NOT NULL DEFAULT false,
lead_sharing_consent boolean NOT NULL DEFAULT false,
lead_location geography(Point,4326)
);
create table public.mow_cash_entries (
id uuid NOT NULL,
company_id uuid NOT NULL,
kind text NOT NULL,
amount_cents integer NOT NULL,
entry_date date NOT NULL,
note text NOT NULL,
created_at timestamp with time zone NOT NULL DEFAULT now()
);
create table public.mow_customers (
id uuid NOT NULL DEFAULT gen_random_uuid(),
company_id uuid NOT NULL,
name text NOT NULL,
address text NOT NULL,
city text NOT NULL DEFAULT 'Palm Coast, FL'::text,
email text NOT NULL DEFAULT ''::text,
phone text NOT NULL DEFAULT ''::text,
notes text NOT NULL DEFAULT ''::text,
latitude double precision,
longitude double precision,
notification_consent boolean NOT NULL DEFAULT false,
created_at timestamp with time zone NOT NULL DEFAULT now(),
updated_at timestamp with time zone NOT NULL DEFAULT now()
);
create table public.mow_service_plans (
id uuid NOT NULL,
company_id uuid NOT NULL,
customer_id uuid NOT NULL,
assigned_to uuid NOT NULL,
interval_days integer NOT NULL,
first_date date NOT NULL,
scheduled_time time without time zone NOT NULL DEFAULT '09:00:00'::time without time zone,
price_cents integer NOT NULL,
services text[] NOT NULL,
requires_photo boolean NOT NULL DEFAULT true,
active boolean NOT NULL DEFAULT true,
created_at timestamp with time zone NOT NULL DEFAULT now()
);
create table public.mow_billing_events (
event_id text NOT NULL,
event_type text NOT NULL,
created_at timestamp with time zone NOT NULL DEFAULT now()
);
create table public.mow_billing_accounts (
company_id uuid NOT NULL,
customer_id text,
subscription_id text,
plan text NOT NULL DEFAULT 'starter'::text,
status text NOT NULL DEFAULT 'free'::text,
paid boolean NOT NULL DEFAULT false,
period_end bigint,
cancel_at_period_end boolean NOT NULL DEFAULT false,
event_created bigint NOT NULL DEFAULT 0,
updated_at timestamp with time zone NOT NULL DEFAULT now(),
checkout_nonce uuid,
checkout_until timestamp with time zone,
checkout_session text
);
create table public.mow_payment_checkouts (
job_id uuid NOT NULL,
company_id uuid NOT NULL,
session_id text,
nonce uuid NOT NULL,
lease_until timestamp with time zone,
amount_cents integer NOT NULL,
fee_bps integer NOT NULL,
fee_cents integer NOT NULL,
status text NOT NULL DEFAULT 'pending'::text,
event_created bigint NOT NULL DEFAULT 0,
created_at timestamp with time zone NOT NULL DEFAULT now()
);
create table public.mow_payment_activity (
event_id text NOT NULL,
company_id uuid NOT NULL,
account_id text NOT NULL,
event_type text NOT NULL,
object_id text NOT NULL,
amount_cents bigint NOT NULL,
currency text NOT NULL,
status text NOT NULL,
event_created bigint NOT NULL,
created_at timestamp with time zone NOT NULL DEFAULT now()
);
create table public.mowmatter_compliance_requests (
id uuid NOT NULL,
email text NOT NULL,
request_type text NOT NULL,
message text NOT NULL,
contact_consent boolean NOT NULL,
notice_version text NOT NULL,
status text NOT NULL DEFAULT 'pending'::text,
created_at timestamp with time zone NOT NULL DEFAULT now()
);
create table public.mowmatter_marketing_suppressions (
email text NOT NULL,
reason text NOT NULL DEFAULT 'user_opt_out'::text,
created_at timestamp with time zone NOT NULL DEFAULT now()
);
create table public.mow_zip_centers (
zip text NOT NULL,
location geography(Point,4326) NOT NULL,
source text NOT NULL DEFAULT 'zippopotam.us'::text,
updated_at timestamp with time zone NOT NULL DEFAULT now()
);
create table public.mow_growth_profiles (
company_id uuid NOT NULL,
contact_name text NOT NULL,
phone text NOT NULL,
services text[] NOT NULL,
terms_version text NOT NULL,
completed_at timestamp with time zone NOT NULL DEFAULT now(),
initial_zip text,
initial_radius integer,
initial_ids uuid[]
);
create table public.mow_lead_packages (
id uuid NOT NULL DEFAULT gen_random_uuid(),
company_id uuid NOT NULL,
zip text NOT NULL,
radius integer NOT NULL,
lead_ids uuid[] NOT NULL,
amount_cents integer NOT NULL,
currency text NOT NULL DEFAULT 'usd'::text,
status text NOT NULL DEFAULT 'pending'::text,
stripe_session text,
created_at timestamp with time zone NOT NULL DEFAULT now(),
paid_at timestamp with time zone
);
create table public.mow_growth_seen (
company_id uuid NOT NULL,
zip text NOT NULL,
radius integer NOT NULL,
seen_at timestamp with time zone NOT NULL
);
create table public.mow_yard_offers (
id uuid NOT NULL,
company_id uuid NOT NULL,
customer_id uuid NOT NULL,
assessment_id uuid NOT NULL,
title text NOT NULL,
description text NOT NULL,
quote jsonb NOT NULL,
catalog_revision integer NOT NULL,
state text NOT NULL DEFAULT 'offered'::text,
responded_by uuid,
responded_at timestamp with time zone,
created_at timestamp with time zone NOT NULL DEFAULT now()
);
create table public.mow_owner_settings (
company_id uuid NOT NULL,
revision integer NOT NULL DEFAULT 1,
catalog jsonb NOT NULL,
labor jsonb NOT NULL DEFAULT '{}'::jsonb,
updated_at timestamp with time zone NOT NULL DEFAULT now()
);
create table public.mow_customer_access (
company_id uuid NOT NULL,
customer_id uuid NOT NULL,
user_id uuid NOT NULL
);
create table public.mow_insight_allowances (
company_id uuid NOT NULL,
remaining integer NOT NULL DEFAULT 0,
enabled boolean NOT NULL DEFAULT false,
updated_at timestamp with time zone NOT NULL DEFAULT now()
);
create table public.mow_yard_assessments (
id uuid NOT NULL,
company_id uuid NOT NULL,
job_id uuid NOT NULL,
actor_id uuid NOT NULL,
photo_ids uuid[] NOT NULL,
state text NOT NULL,
result jsonb,
created_at timestamp with time zone NOT NULL DEFAULT now(),
updated_at timestamp with time zone NOT NULL DEFAULT now()
);
create table public.mowmatter_sale_suppressions (
email text NOT NULL,
created_at timestamp with time zone NOT NULL DEFAULT now()
);
create table public.mow_customer_invoices (
id uuid NOT NULL DEFAULT gen_random_uuid(),
company_id uuid NOT NULL,
customer_id uuid NOT NULL,
job_id uuid NOT NULL,
number bigint NOT NULL,
amount_cents integer NOT NULL,
snapshot jsonb NOT NULL,
email_status text NOT NULL DEFAULT 'draft'::text,
email_attempt_at timestamp with time zone,
created_at timestamp with time zone NOT NULL DEFAULT now(),
due_at timestamp with time zone NOT NULL DEFAULT (now() + '14 days'::interval),
settlement_status text NOT NULL DEFAULT 'open'::text,
settlement_note text NOT NULL DEFAULT ''::text,
settlement_by uuid,
settlement_at timestamp with time zone
);
create table public.mow_customer_quotes (
id uuid NOT NULL,
company_id uuid NOT NULL,
customer_id uuid NOT NULL,
title text NOT NULL,
scope text NOT NULL,
services text[] NOT NULL,
amount_cents integer NOT NULL,
planned_minutes integer NOT NULL,
expires_at timestamp with time zone NOT NULL,
terms text NOT NULL,
state text NOT NULL DEFAULT 'sent'::text,
source_offer_id uuid,
snapshot jsonb NOT NULL,
created_by uuid NOT NULL,
created_at timestamp with time zone NOT NULL DEFAULT now(),
responded_by uuid,
responded_at timestamp with time zone,
notice_version text,
job_id uuid,
source_proposal_id uuid,
applied_to_job_id uuid
);
create table public.mow_customer_requests (
id uuid NOT NULL,
company_id uuid NOT NULL,
customer_id uuid NOT NULL,
actor_id uuid NOT NULL,
kind text NOT NULL,
job_id uuid,
message text NOT NULL,
preferred_date date,
state text NOT NULL DEFAULT 'pending'::text,
owner_response text NOT NULL DEFAULT ''::text,
created_at timestamp with time zone NOT NULL DEFAULT now(),
resolved_at timestamp with time zone
);
create table public.mow_homeowner_subscriptions (
plan_id uuid NOT NULL,
company_id uuid NOT NULL,
customer_id uuid NOT NULL,
monthly_cents integer NOT NULL,
terms text NOT NULL,
snapshot jsonb NOT NULL,
status text NOT NULL DEFAULT 'proposed'::text,
stripe_customer text,
subscription_id text,
checkout_session text,
nonce uuid,
lease_until timestamp with time zone,
accepted_by uuid,
accepted_at timestamp with time zone,
notice_version text,
period_start bigint,
period_end bigint,
cancel_at_period_end boolean NOT NULL DEFAULT false,
last_invoice_status text,
created_at timestamp with time zone NOT NULL DEFAULT now(),
updated_at timestamp with time zone NOT NULL DEFAULT now(),
event_created bigint NOT NULL DEFAULT 0
);
create table public.mow_visit_proposals (
id uuid NOT NULL,
company_id uuid NOT NULL,
customer_id uuid NOT NULL,
job_id uuid NOT NULL,
actor_id uuid NOT NULL,
title text NOT NULL,
scope text NOT NULL,
state text NOT NULL DEFAULT 'pending'::text,
created_at timestamp with time zone NOT NULL DEFAULT now()
);
create table public.mow_customer_channels (
company_id uuid NOT NULL,
customer_id uuid NOT NULL,
phone text NOT NULL,
sms_offer_consent boolean NOT NULL DEFAULT false,
consented_by uuid NOT NULL,
consented_at timestamp with time zone NOT NULL DEFAULT now(),
notice_version text NOT NULL,
sms_service_consent boolean NOT NULL DEFAULT false
);
create table public.mow_sms_suppressions (
phone text NOT NULL,
created_at timestamp with time zone NOT NULL DEFAULT now()
);
create table public.mow_quote_messages (
quote_id uuid NOT NULL,
company_id uuid NOT NULL,
status text NOT NULL DEFAULT 'sending'::text,
provider_id text,
created_at timestamp with time zone NOT NULL DEFAULT now(),
updated_at timestamp with time zone NOT NULL DEFAULT now()
);
create table public.mow_visit_sms_messages (
id uuid NOT NULL DEFAULT gen_random_uuid(),
company_id uuid NOT NULL,
job_id uuid NOT NULL,
event_id uuid NOT NULL,
kind text NOT NULL,
status text NOT NULL DEFAULT 'sending'::text,
provider_id text,
created_at timestamp with time zone NOT NULL DEFAULT now(),
updated_at timestamp with time zone NOT NULL DEFAULT now()
);
create table public.mow_invoice_deliveries (
invoice_id uuid NOT NULL,
step integer NOT NULL,
company_id uuid NOT NULL,
status text NOT NULL DEFAULT 'sending'::text,
created_at timestamp with time zone NOT NULL DEFAULT now(),
provider_id text
);
alter table public.mowmatter_directory_listings add constraint "mowmatter_directory_listings_pkey" PRIMARY KEY (id);
alter table public.mowmatter_directory_listings add constraint "mowmatter_directory_listings_public_slug_key" UNIQUE (public_slug);
alter table public.mowmatter_directory_listings add constraint "mowmatter_directory_listings_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'suspended'::text])));
alter table public.mowmatter_featured_placements add constraint "mowmatter_featured_placements_check" CHECK ((ends_at > starts_at));
alter table public.mowmatter_featured_placements add constraint "mowmatter_featured_placements_payment_reference_key" UNIQUE (payment_reference);
alter table public.mowmatter_featured_placements add constraint "mowmatter_featured_placements_pkey" PRIMARY KEY (id);
alter table public.mowmatter_featured_placements add constraint "mowmatter_featured_placements_zip_check" CHECK ((zip ~ '^[0-9]{5}$'::text));
alter table public.mow_crew_companies add constraint "mow_crew_companies_business_zip_check" CHECK ((business_zip ~ '^[0-9]{5}$'::text));
alter table public.mow_crew_companies add constraint "mow_crew_companies_name_check" CHECK (((length(name) >= 1) AND (length(name) <= 120)));
alter table public.mow_crew_companies add constraint "mow_crew_companies_pkey" PRIMARY KEY (id);
alter table public.mow_crew_members add constraint "mow_crew_members_pkey" PRIMARY KEY (company_id, user_id);
alter table public.mow_crew_members add constraint "mow_crew_members_role_check" CHECK ((role = ANY (ARRAY['owner'::text, 'lead'::text, 'member'::text])));
alter table public.mow_crew_jobs add constraint "mow_crew_jobs_pkey" PRIMARY KEY (id);
alter table public.mow_crew_jobs add constraint "mow_crew_jobs_planned_minutes_check" CHECK (((planned_minutes >= 15) AND (planned_minutes <= 480)));
alter table public.mow_crew_jobs add constraint "mow_crew_jobs_status_check" CHECK ((status = ANY (ARRAY['scheduled'::text, 'arrived'::text, 'in_progress'::text, 'completed'::text, 'blocked'::text])));
alter table public.mow_crew_events add constraint "mow_crew_events_pkey" PRIMARY KEY (id);
alter table public.mow_crew_photos add constraint "mow_crew_photos_pkey" PRIMARY KEY (id);
alter table public.mow_crew_photos add constraint "mow_crew_photos_storage_path_key" UNIQUE (storage_path);
alter table public.mow_crew_notifications add constraint "mow_crew_notifications_event_id_key" UNIQUE (event_id);
alter table public.mow_crew_notifications add constraint "mow_crew_notifications_pkey" PRIMARY KEY (id);
alter table public.mow_crew_notifications add constraint "mow_crew_notifications_status_check" CHECK ((status = ANY (ARRAY['pending_provider'::text, 'held_no_consent'::text, 'held_no_contact'::text, 'sent'::text, 'failed'::text])));
alter table public.mow_crew_messages add constraint "mow_crew_messages_body_check" CHECK (((length(body) >= 1) AND (length(body) <= 2000)));
alter table public.mow_crew_messages add constraint "mow_crew_messages_pkey" PRIMARY KEY (id);
alter table public.mowmatter_leads add constraint "mowmatter_leads_company_check" CHECK ((length(company) <= 120));
alter table public.mowmatter_leads add constraint "mowmatter_leads_email_check" CHECK ((length(email) <= 254));
alter table public.mowmatter_leads add constraint "mowmatter_leads_email_key" UNIQUE (email);
alter table public.mowmatter_leads add constraint "mowmatter_leads_first_name_check" CHECK ((length(first_name) <= 80));
alter table public.mowmatter_leads add constraint "mowmatter_leads_phone_check" CHECK ((length(phone) <= 32));
alter table public.mowmatter_leads add constraint "mowmatter_leads_pkey" PRIMARY KEY (id);
alter table public.mowmatter_funnel_events add constraint "mowmatter_funnel_events_event_check" CHECK ((event = ANY (ARRAY['cta_click'::text, 'assessment_started'::text, 'assessment_completed'::text, 'signup_started'::text, 'lead_saved'::text, 'growth_lab_used'::text])));
alter table public.mowmatter_funnel_events add constraint "mowmatter_funnel_events_pkey" PRIMARY KEY (id);
alter table public.mow_property_daily_limits add constraint "mow_property_daily_limits_attempts_check" CHECK (((attempts >= 0) AND (attempts <= 100)));
alter table public.mow_property_daily_limits add constraint "mow_property_daily_limits_pkey" PRIMARY KEY (day);
alter table public.mow_property_trials add constraint "mow_property_trials_attempts_check" CHECK (((attempts >= 0) AND (attempts <= 10)));
alter table public.mow_property_trials add constraint "mow_property_trials_pkey" PRIMARY KEY (company_id);
alter table public.mowmatter_request_limits add constraint "mowmatter_request_limits_pkey" PRIMARY KEY (key);
alter table public.mowmatter_homeowner_requests add constraint "mowmatter_homeowner_requests_access_notes_check" CHECK ((length(access_notes) <= 1000));
alter table public.mowmatter_homeowner_requests add constraint "mowmatter_homeowner_requests_address_check" CHECK ((length(address) <= 200));
alter table public.mowmatter_homeowner_requests add constraint "mowmatter_homeowner_requests_city_check" CHECK ((length(city) <= 80));
alter table public.mowmatter_homeowner_requests add constraint "mowmatter_homeowner_requests_email_check" CHECK ((length(email) <= 254));
alter table public.mowmatter_homeowner_requests add constraint "mowmatter_homeowner_requests_first_name_check" CHECK ((length(first_name) <= 80));
alter table public.mowmatter_homeowner_requests add constraint "mowmatter_homeowner_requests_phone_check" CHECK ((length(phone) <= 32));
alter table public.mowmatter_homeowner_requests add constraint "mowmatter_homeowner_requests_pkey" PRIMARY KEY (id);
alter table public.mowmatter_homeowner_requests add constraint "mowmatter_homeowner_requests_state_check" CHECK ((length(state) = 2));
alter table public.mowmatter_homeowner_requests add constraint "mowmatter_homeowner_requests_submission_id_key" UNIQUE (submission_id);
alter table public.mowmatter_homeowner_requests add constraint "mowmatter_homeowner_requests_zip_check" CHECK ((zip ~ '^[0-9]{5}$'::text));
alter table public.mow_cash_entries add constraint "mow_cash_entries_amount_cents_check" CHECK (((amount_cents >= 1) AND (amount_cents <= 10000000)));
alter table public.mow_cash_entries add constraint "mow_cash_entries_kind_check" CHECK ((kind = ANY (ARRAY['income'::text, 'expense'::text])));
alter table public.mow_cash_entries add constraint "mow_cash_entries_note_check" CHECK (((length(note) >= 1) AND (length(note) <= 300)));
alter table public.mow_cash_entries add constraint "mow_cash_entries_pkey" PRIMARY KEY (id);
alter table public.mow_customers add constraint "mow_customers_address_check" CHECK (((length(address) >= 3) AND (length(address) <= 200)));
alter table public.mow_customers add constraint "mow_customers_company_id_id_key" UNIQUE (company_id, id);
alter table public.mow_customers add constraint "mow_customers_name_check" CHECK (((length(name) >= 1) AND (length(name) <= 100)));
alter table public.mow_customers add constraint "mow_customers_pkey" PRIMARY KEY (id);
alter table public.mow_service_plans add constraint "mow_service_plans_company_id_id_key" UNIQUE (company_id, id);
alter table public.mow_service_plans add constraint "mow_service_plans_interval_days_check" CHECK ((interval_days = ANY (ARRAY[7, 14, 28])));
alter table public.mow_service_plans add constraint "mow_service_plans_pkey" PRIMARY KEY (id);
alter table public.mow_service_plans add constraint "mow_service_plans_price_cents_check" CHECK (((price_cents >= 0) AND (price_cents <= 10000000)));
alter table public.mow_billing_events add constraint "mow_billing_events_pkey" PRIMARY KEY (event_id);
alter table public.mow_billing_accounts add constraint "mow_billing_accounts_customer_id_key" UNIQUE (customer_id);
alter table public.mow_billing_accounts add constraint "mow_billing_accounts_pkey" PRIMARY KEY (company_id);
alter table public.mow_payment_checkouts add constraint "mow_payment_checkouts_amount_cents_check" CHECK ((amount_cents > 0));
alter table public.mow_payment_checkouts add constraint "mow_payment_checkouts_fee_bps_check" CHECK ((fee_bps = ANY (ARRAY[150, 250, 350])));
alter table public.mow_payment_checkouts add constraint "mow_payment_checkouts_fee_cents_check" CHECK ((fee_cents >= 0));
alter table public.mow_payment_checkouts add constraint "mow_payment_checkouts_pkey" PRIMARY KEY (job_id);
alter table public.mow_payment_checkouts add constraint "mow_payment_checkouts_session_id_key" UNIQUE (session_id);
alter table public.mow_payment_activity add constraint "mow_payment_activity_amount_cents_check" CHECK ((amount_cents >= 0));
alter table public.mow_payment_activity add constraint "mow_payment_activity_event_type_check" CHECK ((event_type = ANY (ARRAY['charge.refunded'::text, 'charge.dispute.created'::text, 'charge.dispute.updated'::text, 'charge.dispute.closed'::text, 'payout.paid'::text, 'payout.failed'::text])));
alter table public.mow_payment_activity add constraint "mow_payment_activity_pkey" PRIMARY KEY (event_id);
alter table public.mowmatter_compliance_requests add constraint "mowmatter_compliance_requests_contact_consent_check" CHECK (contact_consent);
alter table public.mowmatter_compliance_requests add constraint "mowmatter_compliance_requests_email_check" CHECK ((length(email) <= 254));
alter table public.mowmatter_compliance_requests add constraint "mowmatter_compliance_requests_message_check" CHECK (((length(message) >= 3) AND (length(message) <= 1500)));
alter table public.mowmatter_compliance_requests add constraint "mowmatter_compliance_requests_pkey" PRIMARY KEY (id);
alter table public.mowmatter_compliance_requests add constraint "mowmatter_compliance_requests_request_type_check" CHECK ((request_type = ANY (ARRAY['support'::text, 'privacy_access'::text, 'privacy_correction'::text, 'privacy_delete'::text, 'privacy_export'::text, 'unsubscribe'::text, 'accessibility'::text, 'billing'::text])));
alter table public.mowmatter_compliance_requests add constraint "mowmatter_compliance_requests_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'verifying'::text, 'resolved'::text, 'rejected'::text])));
alter table public.mowmatter_marketing_suppressions add constraint "mowmatter_marketing_suppressions_pkey" PRIMARY KEY (email);
alter table public.mow_zip_centers add constraint "mow_zip_centers_pkey" PRIMARY KEY (zip);
alter table public.mow_zip_centers add constraint "mow_zip_centers_zip_check" CHECK ((zip ~ '^[0-9]{5}$'::text));
alter table public.mow_growth_profiles add constraint "mow_growth_profiles_pkey" PRIMARY KEY (company_id);
alter table public.mow_lead_packages add constraint "mow_lead_packages_amount_cents_check" CHECK ((amount_cents > 0));
alter table public.mow_lead_packages add constraint "mow_lead_packages_currency_check" CHECK ((currency = 'usd'::text));
alter table public.mow_lead_packages add constraint "mow_lead_packages_pkey" PRIMARY KEY (id);
alter table public.mow_lead_packages add constraint "mow_lead_packages_radius_check" CHECK ((radius = ANY (ARRAY[15, 25])));
alter table public.mow_lead_packages add constraint "mow_lead_packages_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'paid'::text, 'refunded'::text])));
alter table public.mow_lead_packages add constraint "mow_lead_packages_stripe_session_key" UNIQUE (stripe_session);
alter table public.mow_growth_seen add constraint "mow_growth_seen_pkey" PRIMARY KEY (company_id, zip, radius);
alter table public.mow_growth_seen add constraint "mow_growth_seen_radius_check" CHECK ((radius = ANY (ARRAY[15, 25])));
alter table public.mow_yard_offers add constraint "mow_yard_offers_description_check" CHECK (((length(description) >= 1) AND (length(description) <= 1000)));
alter table public.mow_yard_offers add constraint "mow_yard_offers_pkey" PRIMARY KEY (id);
alter table public.mow_yard_offers add constraint "mow_yard_offers_state_check" CHECK ((state = ANY (ARRAY['offered'::text, 'accepted'::text, 'declined'::text, 'withdrawn'::text])));
alter table public.mow_yard_offers add constraint "mow_yard_offers_title_check" CHECK (((length(title) >= 1) AND (length(title) <= 100)));
alter table public.mow_owner_settings add constraint "mow_owner_settings_pkey" PRIMARY KEY (company_id);
alter table public.mow_customer_access add constraint "mow_customer_access_pkey" PRIMARY KEY (company_id, customer_id, user_id);
alter table public.mow_insight_allowances add constraint "mow_insight_allowances_pkey" PRIMARY KEY (company_id);
alter table public.mow_insight_allowances add constraint "mow_insight_allowances_remaining_check" CHECK ((remaining >= 0));
alter table public.mow_yard_assessments add constraint "mow_yard_assessments_pkey" PRIMARY KEY (id);
alter table public.mow_yard_assessments add constraint "mow_yard_assessments_state_check" CHECK ((state = ANY (ARRAY['processing'::text, 'owner_review'::text, 'failed'::text])));
alter table public.mowmatter_sale_suppressions add constraint "mowmatter_sale_suppressions_email_check" CHECK (((email = lower(TRIM(BOTH FROM email))) AND (length(email) <= 254)));
alter table public.mowmatter_sale_suppressions add constraint "mowmatter_sale_suppressions_pkey" PRIMARY KEY (email);
alter table public.mow_customer_invoices add constraint "mow_customer_invoices_amount_cents_check" CHECK ((amount_cents > 0));
alter table public.mow_customer_invoices add constraint "mow_customer_invoices_email_status_check" CHECK ((email_status = ANY (ARRAY['draft'::text, 'sending'::text, 'sent'::text, 'failed'::text])));
alter table public.mow_customer_invoices add constraint "mow_customer_invoices_job_id_key" UNIQUE (job_id);
alter table public.mow_customer_invoices add constraint "mow_customer_invoices_number_key" UNIQUE (number);
alter table public.mow_customer_invoices add constraint "mow_customer_invoices_pkey" PRIMARY KEY (id);
alter table public.mow_customer_invoices add constraint "mow_customer_invoices_settlement_status_check" CHECK ((settlement_status = ANY (ARRAY['open'::text, 'paid_external'::text, 'void'::text])));
alter table public.mow_customer_quotes add constraint "mow_customer_quotes_amount_cents_check" CHECK (((amount_cents >= 1) AND (amount_cents <= 10000000)));
alter table public.mow_customer_quotes add constraint "mow_customer_quotes_pkey" PRIMARY KEY (id);
alter table public.mow_customer_quotes add constraint "mow_customer_quotes_planned_minutes_check" CHECK (((planned_minutes >= 15) AND (planned_minutes <= 480)));
alter table public.mow_customer_quotes add constraint "mow_customer_quotes_scope_check" CHECK (((length(scope) >= 3) AND (length(scope) <= 1500)));
alter table public.mow_customer_quotes add constraint "mow_customer_quotes_services_check" CHECK (((cardinality(services) >= 1) AND (cardinality(services) <= 10)));
alter table public.mow_customer_quotes add constraint "mow_customer_quotes_source_offer_id_key" UNIQUE (source_offer_id);
alter table public.mow_customer_quotes add constraint "mow_customer_quotes_source_proposal_id_key" UNIQUE (source_proposal_id);
alter table public.mow_customer_quotes add constraint "mow_customer_quotes_state_check" CHECK ((state = ANY (ARRAY['sent'::text, 'accepted'::text, 'declined'::text, 'withdrawn'::text, 'booked'::text])));
alter table public.mow_customer_quotes add constraint "mow_customer_quotes_terms_check" CHECK (((length(terms) >= 3) AND (length(terms) <= 1500)));
alter table public.mow_customer_quotes add constraint "mow_customer_quotes_title_check" CHECK (((length(title) >= 1) AND (length(title) <= 100)));
alter table public.mow_customer_requests add constraint "mow_customer_requests_kind_check" CHECK ((kind = ANY (ARRAY['service'::text, 'reschedule'::text, 'cancel'::text, 'account'::text])));
alter table public.mow_customer_requests add constraint "mow_customer_requests_message_check" CHECK (((length(message) >= 3) AND (length(message) <= 1500)));
alter table public.mow_customer_requests add constraint "mow_customer_requests_pkey" PRIMARY KEY (id);
alter table public.mow_customer_requests add constraint "mow_customer_requests_state_check" CHECK ((state = ANY (ARRAY['pending'::text, 'resolved'::text, 'declined'::text])));
alter table public.mow_homeowner_subscriptions add constraint "mow_homeowner_subscriptions_checkout_session_key" UNIQUE (checkout_session);
alter table public.mow_homeowner_subscriptions add constraint "mow_homeowner_subscriptions_monthly_cents_check" CHECK (((monthly_cents >= 1) AND (monthly_cents <= 10000000)));
alter table public.mow_homeowner_subscriptions add constraint "mow_homeowner_subscriptions_pkey" PRIMARY KEY (plan_id);
alter table public.mow_homeowner_subscriptions add constraint "mow_homeowner_subscriptions_subscription_id_key" UNIQUE (subscription_id);
alter table public.mow_homeowner_subscriptions add constraint "mow_homeowner_subscriptions_terms_check" CHECK (((length(terms) >= 3) AND (length(terms) <= 1500)));
alter table public.mow_visit_proposals add constraint "mow_visit_proposals_pkey" PRIMARY KEY (id);
alter table public.mow_visit_proposals add constraint "mow_visit_proposals_scope_check" CHECK (((length(scope) >= 3) AND (length(scope) <= 1500)));
alter table public.mow_visit_proposals add constraint "mow_visit_proposals_state_check" CHECK ((state = ANY (ARRAY['pending'::text, 'quoted'::text, 'declined'::text])));
alter table public.mow_visit_proposals add constraint "mow_visit_proposals_title_check" CHECK (((length(title) >= 3) AND (length(title) <= 100)));
alter table public.mow_customer_channels add constraint "mow_customer_channels_phone_check" CHECK ((phone ~ '^\+1[2-9][0-9]{9}$'::text));
alter table public.mow_customer_channels add constraint "mow_customer_channels_pkey" PRIMARY KEY (company_id, customer_id);
alter table public.mow_sms_suppressions add constraint "mow_sms_suppressions_pkey" PRIMARY KEY (phone);
alter table public.mow_quote_messages add constraint "mow_quote_messages_pkey" PRIMARY KEY (quote_id);
alter table public.mow_quote_messages add constraint "mow_quote_messages_provider_id_key" UNIQUE (provider_id);
alter table public.mow_quote_messages add constraint "mow_quote_messages_status_check" CHECK ((status = ANY (ARRAY['sending'::text, 'accepted'::text, 'sent'::text, 'delivered'::text, 'undelivered'::text, 'failed'::text])));
alter table public.mow_visit_sms_messages add constraint "mow_visit_sms_messages_job_id_kind_key" UNIQUE (job_id, kind);
alter table public.mow_visit_sms_messages add constraint "mow_visit_sms_messages_kind_check" CHECK ((kind = ANY (ARRAY['arrival'::text, 'completion'::text])));
alter table public.mow_visit_sms_messages add constraint "mow_visit_sms_messages_pkey" PRIMARY KEY (id);
alter table public.mow_visit_sms_messages add constraint "mow_visit_sms_messages_provider_id_key" UNIQUE (provider_id);
alter table public.mow_visit_sms_messages add constraint "mow_visit_sms_messages_status_check" CHECK ((status = ANY (ARRAY['sending'::text, 'accepted'::text, 'sent'::text, 'delivered'::text, 'undelivered'::text, 'failed'::text])));
alter table public.mow_invoice_deliveries add constraint "mow_invoice_deliveries_pkey" PRIMARY KEY (invoice_id, step);
alter table public.mow_invoice_deliveries add constraint "mow_invoice_deliveries_status_check" CHECK ((status = ANY (ARRAY['sending'::text, 'sent'::text, 'needs_review'::text])));
alter table public.mow_invoice_deliveries add constraint "mow_invoice_deliveries_step_check" CHECK (((step >= 0) AND (step <= 2)));
alter table public.mowmatter_directory_listings add constraint "mowmatter_directory_listings_owner_user_id_fkey" FOREIGN KEY (owner_user_id) REFERENCES auth.users(id);
alter table public.mowmatter_featured_placements add constraint "mowmatter_featured_placements_listing_id_fkey" FOREIGN KEY (listing_id) REFERENCES mowmatter_directory_listings(id);
alter table public.mow_crew_members add constraint "mow_crew_members_company_id_fkey" FOREIGN KEY (company_id) REFERENCES mow_crew_companies(id);
alter table public.mow_crew_jobs add constraint "mow_crew_jobs_company_id_fkey" FOREIGN KEY (company_id) REFERENCES mow_crew_companies(id);
alter table public.mow_crew_jobs add constraint "mow_job_customer_scope" FOREIGN KEY (company_id, customer_id) REFERENCES mow_customers(company_id, id);
alter table public.mow_crew_jobs add constraint "mow_job_plan_scope" FOREIGN KEY (company_id, plan_id) REFERENCES mow_service_plans(company_id, id);
alter table public.mow_crew_events add constraint "mow_crew_events_company_id_fkey" FOREIGN KEY (company_id) REFERENCES mow_crew_companies(id);
alter table public.mow_crew_events add constraint "mow_crew_events_job_id_fkey" FOREIGN KEY (job_id) REFERENCES mow_crew_jobs(id);
alter table public.mow_crew_photos add constraint "mow_crew_photos_company_id_fkey" FOREIGN KEY (company_id) REFERENCES mow_crew_companies(id);
alter table public.mow_crew_photos add constraint "mow_crew_photos_job_id_fkey" FOREIGN KEY (job_id) REFERENCES mow_crew_jobs(id);
alter table public.mow_crew_notifications add constraint "mow_crew_notifications_company_id_fkey" FOREIGN KEY (company_id) REFERENCES mow_crew_companies(id);
alter table public.mow_crew_notifications add constraint "mow_crew_notifications_event_id_fkey" FOREIGN KEY (event_id) REFERENCES mow_crew_events(id);
alter table public.mow_crew_notifications add constraint "mow_crew_notifications_job_id_fkey" FOREIGN KEY (job_id) REFERENCES mow_crew_jobs(id);
alter table public.mow_crew_messages add constraint "mow_crew_messages_company_id_fkey" FOREIGN KEY (company_id) REFERENCES mow_crew_companies(id);
alter table public.mow_property_trials add constraint "mow_property_trials_company_id_fkey" FOREIGN KEY (company_id) REFERENCES mow_crew_companies(id);
alter table public.mow_cash_entries add constraint "mow_cash_entries_company_id_fkey" FOREIGN KEY (company_id) REFERENCES mow_crew_companies(id);
alter table public.mow_customers add constraint "mow_customers_company_id_fkey" FOREIGN KEY (company_id) REFERENCES mow_crew_companies(id);
alter table public.mow_service_plans add constraint "mow_service_plans_company_id_assigned_to_fkey" FOREIGN KEY (company_id, assigned_to) REFERENCES mow_crew_members(company_id, user_id);
alter table public.mow_service_plans add constraint "mow_service_plans_company_id_customer_id_fkey" FOREIGN KEY (company_id, customer_id) REFERENCES mow_customers(company_id, id);
alter table public.mow_service_plans add constraint "mow_service_plans_company_id_fkey" FOREIGN KEY (company_id) REFERENCES mow_crew_companies(id);
alter table public.mow_billing_accounts add constraint "mow_billing_accounts_company_id_fkey" FOREIGN KEY (company_id) REFERENCES mow_crew_companies(id);
alter table public.mow_payment_checkouts add constraint "mow_payment_checkouts_company_id_fkey" FOREIGN KEY (company_id) REFERENCES mow_crew_companies(id);
alter table public.mow_payment_checkouts add constraint "mow_payment_checkouts_job_id_fkey" FOREIGN KEY (job_id) REFERENCES mow_crew_jobs(id);
alter table public.mow_payment_activity add constraint "mow_payment_activity_company_id_fkey" FOREIGN KEY (company_id) REFERENCES mow_crew_companies(id);
alter table public.mow_growth_profiles add constraint "mow_growth_profiles_company_id_fkey" FOREIGN KEY (company_id) REFERENCES mow_crew_companies(id);
alter table public.mow_lead_packages add constraint "mow_lead_packages_company_id_fkey" FOREIGN KEY (company_id) REFERENCES mow_crew_companies(id);
alter table public.mow_growth_seen add constraint "mow_growth_seen_company_id_fkey" FOREIGN KEY (company_id) REFERENCES mow_crew_companies(id);
alter table public.mow_yard_offers add constraint "mow_yard_offers_assessment_id_fkey" FOREIGN KEY (assessment_id) REFERENCES mow_yard_assessments(id);
alter table public.mow_yard_offers add constraint "mow_yard_offers_company_id_customer_id_fkey" FOREIGN KEY (company_id, customer_id) REFERENCES mow_customers(company_id, id);
alter table public.mow_yard_offers add constraint "mow_yard_offers_responded_by_fkey" FOREIGN KEY (responded_by) REFERENCES auth.users(id);
alter table public.mow_owner_settings add constraint "mow_owner_settings_company_id_fkey" FOREIGN KEY (company_id) REFERENCES mow_crew_companies(id);
alter table public.mow_customer_access add constraint "mow_customer_access_company_id_customer_id_fkey" FOREIGN KEY (company_id, customer_id) REFERENCES mow_customers(company_id, id);
alter table public.mow_customer_access add constraint "mow_customer_access_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id);
alter table public.mow_insight_allowances add constraint "mow_insight_allowances_company_id_fkey" FOREIGN KEY (company_id) REFERENCES mow_crew_companies(id);
alter table public.mow_yard_assessments add constraint "mow_yard_assessments_actor_id_fkey" FOREIGN KEY (actor_id) REFERENCES auth.users(id);
alter table public.mow_yard_assessments add constraint "mow_yard_assessments_company_id_fkey" FOREIGN KEY (company_id) REFERENCES mow_crew_companies(id);
alter table public.mow_yard_assessments add constraint "mow_yard_assessments_job_id_fkey" FOREIGN KEY (job_id) REFERENCES mow_crew_jobs(id);
alter table public.mow_customer_invoices add constraint "mow_customer_invoices_company_id_customer_id_fkey" FOREIGN KEY (company_id, customer_id) REFERENCES mow_customers(company_id, id);
alter table public.mow_customer_invoices add constraint "mow_customer_invoices_company_id_fkey" FOREIGN KEY (company_id) REFERENCES mow_crew_companies(id);
alter table public.mow_customer_invoices add constraint "mow_customer_invoices_job_id_fkey" FOREIGN KEY (job_id) REFERENCES mow_crew_jobs(id);
alter table public.mow_customer_invoices add constraint "mow_customer_invoices_settlement_by_fkey" FOREIGN KEY (settlement_by) REFERENCES auth.users(id);
alter table public.mow_customer_quotes add constraint "mow_customer_quotes_applied_to_job_id_fkey" FOREIGN KEY (applied_to_job_id) REFERENCES mow_crew_jobs(id);
alter table public.mow_customer_quotes add constraint "mow_customer_quotes_company_id_customer_id_fkey" FOREIGN KEY (company_id, customer_id) REFERENCES mow_customers(company_id, id);
alter table public.mow_customer_quotes add constraint "mow_customer_quotes_company_id_fkey" FOREIGN KEY (company_id) REFERENCES mow_crew_companies(id);
alter table public.mow_customer_quotes add constraint "mow_customer_quotes_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id);
alter table public.mow_customer_quotes add constraint "mow_customer_quotes_job_id_fkey" FOREIGN KEY (job_id) REFERENCES mow_crew_jobs(id);
alter table public.mow_customer_quotes add constraint "mow_customer_quotes_responded_by_fkey" FOREIGN KEY (responded_by) REFERENCES auth.users(id);
alter table public.mow_customer_quotes add constraint "mow_customer_quotes_source_offer_id_fkey" FOREIGN KEY (source_offer_id) REFERENCES mow_yard_offers(id);
alter table public.mow_customer_quotes add constraint "mow_customer_quotes_source_proposal_id_fkey" FOREIGN KEY (source_proposal_id) REFERENCES mow_visit_proposals(id);
alter table public.mow_customer_requests add constraint "mow_customer_requests_actor_id_fkey" FOREIGN KEY (actor_id) REFERENCES auth.users(id);
alter table public.mow_customer_requests add constraint "mow_customer_requests_company_id_customer_id_fkey" FOREIGN KEY (company_id, customer_id) REFERENCES mow_customers(company_id, id);
alter table public.mow_customer_requests add constraint "mow_customer_requests_company_id_fkey" FOREIGN KEY (company_id) REFERENCES mow_crew_companies(id);
alter table public.mow_customer_requests add constraint "mow_customer_requests_job_id_fkey" FOREIGN KEY (job_id) REFERENCES mow_crew_jobs(id);
alter table public.mow_homeowner_subscriptions add constraint "mow_homeowner_subscriptions_accepted_by_fkey" FOREIGN KEY (accepted_by) REFERENCES auth.users(id);
alter table public.mow_homeowner_subscriptions add constraint "mow_homeowner_subscriptions_company_id_customer_id_fkey" FOREIGN KEY (company_id, customer_id) REFERENCES mow_customers(company_id, id);
alter table public.mow_homeowner_subscriptions add constraint "mow_homeowner_subscriptions_company_id_fkey" FOREIGN KEY (company_id) REFERENCES mow_crew_companies(id);
alter table public.mow_homeowner_subscriptions add constraint "mow_homeowner_subscriptions_plan_id_fkey" FOREIGN KEY (plan_id) REFERENCES mow_service_plans(id);
alter table public.mow_visit_proposals add constraint "mow_visit_proposals_actor_id_fkey" FOREIGN KEY (actor_id) REFERENCES auth.users(id);
alter table public.mow_visit_proposals add constraint "mow_visit_proposals_company_id_customer_id_fkey" FOREIGN KEY (company_id, customer_id) REFERENCES mow_customers(company_id, id);
alter table public.mow_visit_proposals add constraint "mow_visit_proposals_company_id_fkey" FOREIGN KEY (company_id) REFERENCES mow_crew_companies(id);
alter table public.mow_visit_proposals add constraint "mow_visit_proposals_job_id_fkey" FOREIGN KEY (job_id) REFERENCES mow_crew_jobs(id);
alter table public.mow_customer_channels add constraint "mow_customer_channels_company_id_customer_id_fkey" FOREIGN KEY (company_id, customer_id) REFERENCES mow_customers(company_id, id);
alter table public.mow_customer_channels add constraint "mow_customer_channels_consented_by_fkey" FOREIGN KEY (consented_by) REFERENCES auth.users(id);
alter table public.mow_quote_messages add constraint "mow_quote_messages_company_id_fkey" FOREIGN KEY (company_id) REFERENCES mow_crew_companies(id);
alter table public.mow_quote_messages add constraint "mow_quote_messages_quote_id_fkey" FOREIGN KEY (quote_id) REFERENCES mow_customer_quotes(id);
alter table public.mow_visit_sms_messages add constraint "mow_visit_sms_messages_company_id_fkey" FOREIGN KEY (company_id) REFERENCES mow_crew_companies(id);
alter table public.mow_visit_sms_messages add constraint "mow_visit_sms_messages_event_id_fkey" FOREIGN KEY (event_id) REFERENCES mow_crew_events(id);
alter table public.mow_visit_sms_messages add constraint "mow_visit_sms_messages_job_id_fkey" FOREIGN KEY (job_id) REFERENCES mow_crew_jobs(id);
alter table public.mow_invoice_deliveries add constraint "mow_invoice_deliveries_company_id_fkey" FOREIGN KEY (company_id) REFERENCES mow_crew_companies(id);
alter table public.mow_invoice_deliveries add constraint "mow_invoice_deliveries_invoice_id_fkey" FOREIGN KEY (invoice_id) REFERENCES mow_customer_invoices(id);
CREATE INDEX mow_customer_quotes_scope ON public.mow_customer_quotes USING btree (company_id, customer_id, created_at DESC);
CREATE INDEX mow_plans_customer ON public.mow_service_plans USING btree (company_id, customer_id);
CREATE INDEX mow_yard_assessments_job ON public.mow_yard_assessments USING btree (job_id);
CREATE INDEX mow_plans_assignment ON public.mow_service_plans USING btree (company_id, assigned_to);
CREATE INDEX mow_crew_photos_job ON public.mow_crew_photos USING btree (job_id);
CREATE INDEX mow_directory_owner ON public.mowmatter_directory_listings USING btree (owner_user_id);
CREATE INDEX mow_customers_company ON public.mow_customers USING btree (company_id);
CREATE INDEX mow_notifications_job ON public.mow_crew_notifications USING btree (job_id);
CREATE INDEX mow_jobs_customer ON public.mow_crew_jobs USING btree (company_id, customer_id);
CREATE UNIQUE INDEX mow_job_recurrence ON public.mow_crew_jobs USING btree (plan_id, recurrence_date);
CREATE INDEX mow_yard_offers_responder ON public.mow_yard_offers USING btree (responded_by);
CREATE INDEX mow_photos_company ON public.mow_crew_photos USING btree (company_id);
CREATE INDEX mow_featured_listing ON public.mowmatter_featured_placements USING btree (listing_id);
CREATE INDEX mow_crew_messages_company ON public.mow_crew_messages USING btree (company_id, created_at);
CREATE INDEX mow_customer_requests_scope ON public.mow_customer_requests USING btree (company_id, customer_id, created_at DESC);
CREATE INDEX mow_crew_jobs_assignment ON public.mow_crew_jobs USING btree (company_id, assigned_to, service_date);
CREATE INDEX mow_homeowner_identity ON public.mowmatter_homeowner_requests USING btree (lower(email), created_at DESC, id DESC);
CREATE INDEX mow_waiting_homeowner_geo ON public.mowmatter_homeowner_requests USING gist (lead_location) WHERE (no_provider_found AND request_consent AND lead_sharing_consent);
CREATE INDEX mow_customer_access_user ON public.mow_customer_access USING btree (user_id);
CREATE INDEX mow_yard_assessments_actor ON public.mow_yard_assessments USING btree (actor_id);
CREATE INDEX mow_yard_offers_assessment ON public.mow_yard_offers USING btree (assessment_id);
CREATE INDEX mow_customer_invoice_scope ON public.mow_customer_invoices USING btree (company_id, customer_id);
CREATE INDEX mowmatter_compliance_pending ON public.mowmatter_compliance_requests USING btree (status, created_at);
CREATE INDEX mow_notifications_company ON public.mow_crew_notifications USING btree (company_id);
CREATE INDEX mow_visit_proposals_scope ON public.mow_visit_proposals USING btree (company_id, created_at DESC);
CREATE INDEX mow_yard_offers_customer ON public.mow_yard_offers USING btree (company_id, customer_id);
CREATE INDEX mow_events_company ON public.mow_crew_events USING btree (company_id);
CREATE INDEX mow_crew_events_job ON public.mow_crew_events USING btree (job_id, created_at);
CREATE INDEX mow_yard_assessments_company ON public.mow_yard_assessments USING btree (company_id, created_at);
CREATE INDEX mow_lead_package_scope ON public.mow_lead_packages USING btree (company_id, zip, radius, status);
CREATE INDEX mow_growth_company_zip ON public.mow_crew_companies USING btree (business_zip);
CREATE INDEX mow_jobs_plan ON public.mow_crew_jobs USING btree (company_id, plan_id);
CREATE INDEX mow_homeowner_subscriptions_customer ON public.mow_homeowner_subscriptions USING btree (company_id, customer_id);
CREATE INDEX mow_payment_activity_company_time ON public.mow_payment_activity USING btree (company_id, event_created DESC);
CREATE INDEX mow_cash_company ON public.mow_cash_entries USING btree (company_id, entry_date);
CREATE OR REPLACE FUNCTION public.mowmatter_rate_limit(p_key text, p_limit integer)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare n integer;
begin
 insert into public.mowmatter_request_limits(key,window_start,hits)
 values(p_key,date_trunc('hour',now()),1)
 on conflict(key) do update set
 hits=case when public.mowmatter_request_limits.window_start=date_trunc('hour',now()) then public.mowmatter_request_limits.hits+1 else 1 end,
 window_start=date_trunc('hour',now())
 returning hits into n;
 return n<=p_limit;
end;
$function$;

CREATE OR REPLACE FUNCTION public.mow_crew_bootstrap(actor uuid, business_name text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$declare cid uuid;begin select id into cid from mow_crew_companies where owner_id=actor order by created_at limit 1;if cid is not null then return cid;end if;insert into mow_crew_companies(owner_id,name) values(actor,business_name) returning id into cid;insert into mow_crew_members values(cid,actor,'Owner','owner');return cid;end$function$;

CREATE OR REPLACE FUNCTION public.mow_crew_assign_member(actor uuid, cid uuid, member_email text, member_name text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare uid uuid;
begin
 if not exists(select 1 from public.mow_crew_members where company_id=cid and user_id=actor and role='owner') then raise exception 'Owner access required';end if;
 select id into uid from auth.users where lower(email)=lower(member_email) and email_confirmed_at is not null limit 1;
 if uid is null then raise exception 'Crew member must first create and verify their account';end if;
 insert into public.mow_crew_members values(cid,uid,member_name,'member') on conflict(company_id,user_id) do update set display_name=excluded.display_name;
 return uid;
end$function$;

CREATE OR REPLACE FUNCTION public.mow_payment_event(eid text, etype text, ec bigint, cid uuid, sid text, state text)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
 if state not in ('paid','pending','failed') then raise exception 'Invalid payment state'; end if;
 insert into mow_billing_events(event_id,event_type) values(eid,etype) on conflict do nothing;
 if not found then return false; end if;
 update mow_payment_checkouts set status=state,event_created=ec where company_id=cid and session_id=sid and event_created<=ec and status!='paid';
 return true;
end $function$;

CREATE OR REPLACE FUNCTION public.mow_payment_claim(jid uuid, cid uuid, token uuid, amount integer, bps integer, fee integer)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
 insert into mow_payment_checkouts(job_id,company_id,nonce,lease_until,amount_cents,fee_bps,fee_cents)
 values(jid,cid,token,now()+interval '31 minutes',amount,bps,fee)
 on conflict(job_id) do update set nonce=token,lease_until=now()+interval '31 minutes',amount_cents=amount,fee_bps=bps,fee_cents=fee,session_id=null
 where mow_payment_checkouts.company_id=cid and mow_payment_checkouts.status!='paid' and mow_payment_checkouts.lease_until<now();
 return found;
end $function$;

CREATE OR REPLACE FUNCTION public.mow_property_reserve(actor uuid, cid uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$declare trial mow_property_trials;used integer;begin
if not exists(select 1 from mow_crew_members where company_id=cid and user_id=actor and role='owner') then raise exception 'Owner access required';end if;
insert into mow_property_trials(company_id) values(cid) on conflict do nothing;
select * into trial from mow_property_trials where company_id=cid for update;
if now()>trial.started_at+interval '14 days' or trial.attempts>=10 then raise exception 'Property lookup trial exhausted or expired. Paid activation is not available yet.';end if;
insert into mow_property_daily_limits(day) values(current_date) on conflict do nothing;
update mow_property_daily_limits set attempts=attempts+1 where day=current_date and attempts<100 returning attempts into used;
if used is null then raise exception 'Daily property lookup capacity reached. Try tomorrow.';end if;
update mow_property_trials set attempts=attempts+1 where company_id=cid;
return jsonb_build_object('ok',true,'remaining',9-trial.attempts,'expires_at',trial.started_at+interval '14 days');end$function$;

CREATE OR REPLACE FUNCTION public.mow_office_action(actor uuid, cid uuid, command text, payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare c mow_customers; p mow_service_plans; j mow_crew_jobs; rid uuid; count_new integer:=0; d date; stop_date date; old_event mow_crew_events;
begin
 -- Serializes concurrent plan creation, generation and edits for one business.
 perform 1 from mow_crew_companies where id=cid for update;
 if not exists(select 1 from mow_crew_members where company_id=cid and user_id=actor and role='owner') then raise exception 'Owner access required'; end if;
 if command='save_customer' then
  rid:=(payload->>'id')::uuid;
  select * into c from mow_customers where id=rid;
  if found and c.company_id<>cid then raise exception 'Customer access denied'; end if;
  if length(trim(coalesce(payload->>'name',''))) not between 1 and 100 or length(trim(coalesce(payload->>'address',''))) not between 3 and 200 then raise exception 'Enter customer name and property address'; end if;
  if length(coalesce(payload->>'email',''))>254 or length(coalesce(payload->>'phone',''))>30 or length(coalesce(payload->>'notes',''))>1500 then raise exception 'Customer details are too long';end if;
  if (nullif(payload->>'latitude','') is null)<>(nullif(payload->>'longitude','') is null) then raise exception 'Enter both coordinates or neither';end if;
  if abs(nullif(payload->>'latitude','')::double precision)>90 or abs(nullif(payload->>'longitude','')::double precision)>180 then raise exception 'Invalid coordinates';end if;
  insert into mow_customers(id,company_id,name,address,city,email,phone,notes,latitude,longitude,notification_consent)
  values(rid,cid,trim(payload->>'name'),trim(payload->>'address'),left(coalesce(payload->>'city','Palm Coast, FL'),100),coalesce(payload->>'email',''),coalesce(payload->>'phone',''),coalesce(payload->>'notes',''),nullif(payload->>'latitude','')::double precision,nullif(payload->>'longitude','')::double precision,coalesce((payload->>'notification_consent')::boolean,false))
  on conflict(id) do update set name=excluded.name,address=excluded.address,city=excluded.city,email=excluded.email,phone=excluded.phone,notes=excluded.notes,latitude=excluded.latitude,longitude=excluded.longitude,notification_consent=excluded.notification_consent,updated_at=now() where mow_customers.company_id=cid;
  if not found then raise exception 'Customer access denied';end if;
  return jsonb_build_object('ok',true,'customer_id',rid);
 elsif command='create_plan' then
  rid:=(payload->>'id')::uuid;
  select * into p from mow_service_plans where id=rid;
  if found then if p.company_id<>cid then raise exception 'Plan access denied';end if;return jsonb_build_object('ok',true,'plan_id',rid,'duplicate',true);end if;
  if exists(select 1 from mow_service_plans where company_id=cid and customer_id=(payload->>'customer_id')::uuid and active) then raise exception 'This customer already has an active service plan. Pause it before replacing it';end if;
  if (payload->>'first_date')::date < (now() at time zone 'America/New_York')::date or (payload->>'first_date')::date > (now() at time zone 'America/New_York')::date+365 then raise exception 'First visit must be within the next year';end if;
  if jsonb_typeof(payload->'services')<>'array' or jsonb_array_length(payload->'services')=0 or exists(select 1 from jsonb_array_elements_text(payload->'services')s where s not in ('Mow','Edge','Trim','Blow','Cleanup')) then raise exception 'Select valid services';end if;
  insert into mow_service_plans(id,company_id,customer_id,assigned_to,interval_days,first_date,scheduled_time,price_cents,services,requires_photo)
  values(rid,cid,(payload->>'customer_id')::uuid,(payload->>'assigned_to')::uuid,(payload->>'interval_days')::integer,(payload->>'first_date')::date,(payload->>'scheduled_time')::time,(payload->>'price_cents')::integer,array(select jsonb_array_elements_text(payload->'services')),coalesce((payload->>'requires_photo')::boolean,true));
  return public.mow_office_action(actor,cid,'generate_plan',jsonb_build_object('id',rid,'through',(payload->>'first_date')::date+60));
 elsif command in ('generate_plan','pause_plan','resume_plan') then
  rid:=(payload->>'id')::uuid; select * into p from mow_service_plans where id=rid and company_id=cid for update;
  if not found then raise exception 'Plan unavailable';end if;
  if command='pause_plan' then
   update mow_service_plans set active=false where id=rid;
   update mow_crew_jobs set cancelled_at=now(),cancellation_reason='Plan paused',cancellation_source='plan_pause',updated_at=now() where plan_id=rid and service_date>=(now() at time zone 'America/New_York')::date and status='scheduled' and cancelled_at is null;
   return jsonb_build_object('ok',true);
  end if;
  if command='resume_plan' then
   update mow_service_plans set active=true where id=rid;p.active:=true;
   update mow_crew_jobs set cancelled_at=null,cancellation_reason=null,cancellation_source=null,updated_at=now() where plan_id=rid and service_date>=(now() at time zone 'America/New_York')::date and status='scheduled' and cancellation_source='plan_pause';
  end if;
  if not p.active then raise exception 'Resume the plan before generating visits';end if;
  stop_date:=coalesce((payload->>'through')::date,(now() at time zone 'America/New_York')::date+60);
  if stop_date>greatest((now() at time zone 'America/New_York')::date,p.first_date)+93 then raise exception 'Generate no more than 93 days at once';end if;
  select * into c from mow_customers where id=p.customer_id and company_id=cid;
  for d in select x::date from generate_series(p.first_date::timestamp,stop_date::timestamp,make_interval(days=>p.interval_days))x where x::date>=(now() at time zone 'America/New_York')::date loop
   insert into mow_crew_jobs(company_id,customer_id,plan_id,recurrence_date,assigned_to,customer_name,address,city,service_date,scheduled_time,services,notes,latitude,longitude,requires_photo,customer_email,customer_phone,notification_consent,price_cents)
   values(cid,c.id,p.id,d,p.assigned_to,c.name,c.address,c.city,d,p.scheduled_time,p.services,c.notes,c.latitude,c.longitude,p.requires_photo,c.email,c.phone,c.notification_consent,p.price_cents)
   on conflict(plan_id,recurrence_date) do nothing;
   if found then count_new:=count_new+1;end if;
  end loop;
  return jsonb_build_object('ok',true,'plan_id',rid,'generated',count_new);
 elsif command='edit_job' then
  rid:=(payload->>'id')::uuid;select * into j from mow_crew_jobs where id=rid and company_id=cid for update;
  if not found then raise exception 'Job unavailable';end if;
  if j.status not in ('scheduled','blocked') or j.cancelled_at is not null then raise exception 'Only scheduled or blocked active jobs can be changed';end if;
  if not exists(select 1 from mow_crew_members where company_id=cid and user_id=(payload->>'assigned_to')::uuid) then raise exception 'Choose a member of this business';end if;
  if (payload->>'service_date')::date < (now() at time zone 'America/New_York')::date then raise exception 'Choose today or a future date';end if;
  update mow_crew_jobs set assigned_to=(payload->>'assigned_to')::uuid,service_date=(payload->>'service_date')::date,scheduled_time=(payload->>'scheduled_time')::time,notes=left(coalesce(payload->>'notes',j.notes),1500),updated_at=now() where id=rid;
  return jsonb_build_object('ok',true);
 elsif command='cancel_job' then
  rid:=(payload->>'id')::uuid;select * into j from mow_crew_jobs where id=rid and company_id=cid for update;
  if not found or j.status not in ('scheduled','blocked') then raise exception 'Only scheduled or blocked jobs can be cancelled';end if;
  if length(trim(coalesce(payload->>'reason','')))<3 then raise exception 'Add a cancellation reason';end if;
  update mow_crew_jobs set cancelled_at=coalesce(cancelled_at,now()),cancellation_reason=left(payload->>'reason',300),cancellation_source='owner',updated_at=now() where id=rid;
  return jsonb_build_object('ok',true);
 elsif command='cash_entry' then
  rid:=(payload->>'id')::uuid;
  if exists(select 1 from mow_cash_entries where id=rid and company_id<>cid) then raise exception 'Entry access denied';end if;
  insert into mow_cash_entries(id,company_id,kind,amount_cents,entry_date,note) values(rid,cid,payload->>'kind',(payload->>'amount_cents')::integer,(payload->>'entry_date')::date,trim(payload->>'note')) on conflict(id) do nothing;
  return jsonb_build_object('ok',true);
 end if;
 raise exception 'Unknown Office action';
end $function$;

CREATE OR REPLACE FUNCTION public.mow_crew_transition(actor uuid, jid uuid, eid uuid, verb text, details jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$declare j mow_crew_jobs; r text;e mow_crew_events;n text;company_name text;begin select * into j from mow_crew_jobs where id=jid for update;if not found then raise exception 'Job unavailable';end if;select role into r from mow_crew_members where company_id=j.company_id and user_id=actor;if r is null or (r not in ('owner','lead') and j.assigned_to is distinct from actor) then raise exception 'Job access denied';end if;select * into e from mow_crew_events where id=eid;if found then if e.job_id<>jid or e.actor_id<>actor or e.action<>verb then raise exception 'Event conflict';end if;select status into n from mow_crew_notifications where event_id=eid;return jsonb_build_object('ok',true,'duplicate',true,'status',j.status,'notification_status',n);end if;
if j.cancelled_at is not null then raise exception 'This visit was cancelled. Refresh your route';end if; if verb='check_in' then if j.status not in ('scheduled','blocked') then raise exception 'Cannot check in from this job status';end if;j.status='arrived';j.arrived_at=coalesce(j.arrived_at,now());
elsif verb='start' then if j.status not in ('scheduled','arrived','blocked') then raise exception 'Job cannot be started';end if;j.status='in_progress';j.arrived_at=coalesce(j.arrived_at,now());j.started_at=coalesce(j.started_at,now());
elsif verb='complete' then if j.status<>'in_progress' then raise exception 'Start the job before completing it';end if;if not (to_jsonb(j.services) <@ coalesce(details->'completed_tasks','[]'::jsonb)) then raise exception 'Complete the service checklist';end if;if j.requires_photo and not exists(select 1 from mow_crew_photos where job_id=jid) then raise exception 'Add a completion photo';end if;j.status='completed';j.completed_at=now();
elsif verb='issue' then if j.status='completed' then raise exception 'Completed job cannot be blocked';end if;if length(coalesce(details->>'reason',''))<3 then raise exception 'Describe the issue';end if;j.status='blocked';else raise exception 'Unknown action';end if;
insert into mow_crew_events(id,company_id,job_id,actor_id,action,payload) values(eid,j.company_id,jid,actor,verb,details);update mow_crew_jobs set status=j.status,arrived_at=j.arrived_at,started_at=j.started_at,completed_at=j.completed_at,updated_at=now() where id=jid;
if verb in ('start','complete') then select name into company_name from mow_crew_companies where id=j.company_id;n=case when not j.notification_consent then 'held_no_consent' when coalesce(j.customer_email,'')='' and coalesce(j.customer_phone,'')='' then 'held_no_contact' else 'pending_provider' end;insert into mow_crew_notifications(company_id,job_id,event_id,channel,body,status) values(j.company_id,jid,eid,case when coalesce(j.customer_phone,'')<>'' then 'sms' else 'email' end,case when verb='start' then 'Good news—'||company_name||' is starting your lawn care at '||j.address||'. We’ll let you know when your yard is ready.' else 'Fresh cut. Clean edges. All handled. '||company_name||' has finished your lawn care at '||j.address||'. Your yard is ready to enjoy.' end,n);end if;return jsonb_build_object('ok',true,'status',j.status,'notification_status',n);end$function$;

CREATE OR REPLACE FUNCTION public.mow_billing_apply(eid text, etype text, ec bigint, customer text, subscription text, p text, s text, is_paid boolean, pend bigint, cancel_end boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
 insert into mow_billing_events(event_id,event_type) values(eid,etype) on conflict do nothing;
 if not found then return false; end if;
 update mow_billing_accounts set subscription_id=subscription,plan=p,status=s,paid=is_paid,
 period_end=pend,cancel_at_period_end=cancel_end,event_created=ec,updated_at=now()
 where customer_id=customer and event_created<=ec;
 return true;
end $function$;

CREATE OR REPLACE FUNCTION public.mow_billing_checkout_claim(cid uuid, nonce uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
 update mow_billing_accounts set checkout_nonce=nonce,checkout_until=now()+interval '31 minutes',checkout_session=null
 where company_id=cid and (checkout_until is null or checkout_until<now());
 return found;
end $function$;

CREATE OR REPLACE FUNCTION public.mow_growth_zip(p_zip text, p_lat double precision, p_lng double precision)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions'
AS $function$
begin
 if p_zip !~ '^[0-9]{5}$' or p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then raise exception 'Invalid ZIP coordinates'; end if;
 insert into mow_zip_centers(zip,location) values(p_zip,extensions.st_setsrid(extensions.st_makepoint(p_lng,p_lat),4326)::extensions.geography)
 on conflict(zip) do update set location=excluded.location,updated_at=now();
 update mowmatter_homeowner_requests set lead_location=(select location from mow_zip_centers where zip=p_zip) where zip=p_zip and lead_location is null;
end $function$;

CREATE OR REPLACE FUNCTION public.mow_growth_alerts(actor uuid, cid uuid, p_zip text, p_radius integer DEFAULT 15)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare seen timestamptz; total integer; new_count integer;
begin
 perform mow_growth_owner(actor,cid);
 if p_zip is null or p_zip !~ '^[0-9]{5}$' or p_radius is null or p_radius not in (15,25) then raise exception 'Choose a valid ZIP and radius'; end if;
 select seen_at into seen from mow_growth_seen where company_id=cid and zip=p_zip and radius=p_radius;
 select count(*),count(*) filter(where created_at>coalesce(seen,'epoch'::timestamptz)) into total,new_count from mow_growth_candidates(p_zip,p_radius);
 return jsonb_build_object('count',total,'new_count',new_count,'zip',p_zip,'radius',p_radius,'last_seen_at',seen);
end $function$;

CREATE OR REPLACE FUNCTION public.mow_growth_scan(actor uuid, cid uuid, p_zip text, p_radius integer, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions'
AS $function$
declare ids uuid[]; visible uuid[]; purchased uuid[]; profile mow_growth_profiles; reason text:='locked'; total integer; items jsonb;
begin
 perform mow_growth_owner(actor,cid);
 if p_zip is null or p_radius is null or p_offset is null or p_zip !~ '^[0-9]{5}$' or p_radius not in (15,25) or p_offset<0 then raise exception 'Choose a valid ZIP and radius'; end if;
 if not exists(select 1 from mow_zip_centers where zip=p_zip) then raise exception 'ZIP center unavailable'; end if;
 select coalesce(array_agg(id order by created_at desc,id),'{}'::uuid[]) into ids from mow_growth_candidates(p_zip,p_radius);
 total:=cardinality(ids);
 -- Serialize first incentive grant: repeated scans cannot expand it.
 select * into profile from mow_growth_profiles where company_id=cid for update;
 if exists(select 1 from mow_billing_accounts where company_id=cid and paid and status='active' and plan in ('growth','grow','scale')) then
  visible:=ids; reason:='subscription';
 elsif profile.company_id is not null and profile.initial_ids is null and total>0 and p_zip=(select business_zip from mow_crew_companies where id=cid) then
  update mow_growth_profiles set initial_zip=p_zip,initial_radius=p_radius,initial_ids=ids where company_id=cid;
  visible:=ids; reason:='onboarding';
 elsif profile.initial_ids is not null then
  visible:=array(select unnest(ids) intersect select unnest(profile.initial_ids)); reason:='onboarding';
 else
  select coalesce(array_agg(distinct h.id),'{}'::uuid[]) into visible from mowmatter_homeowner_requests h
   where h.id=any(ids) and exists(select 1 from mow_lead_packages p cross join lateral unnest(p.lead_ids) lid
    join mowmatter_homeowner_requests owned on owned.id=lid where p.company_id=cid and p.status='paid' and lower(owned.email)=lower(h.email));
  if cardinality(visible)>0 then reason:='purchase'; end if;
 end if;
 -- A paid bundle augments, rather than being hidden by, the onboarding snapshot.
 select coalesce(array_agg(distinct h.id),'{}'::uuid[]) into purchased from mowmatter_homeowner_requests h
   where h.id=any(ids) and exists(select 1 from mow_lead_packages p cross join lateral unnest(p.lead_ids) lid
    join mowmatter_homeowner_requests owned on owned.id=lid where p.company_id=cid and p.status='paid' and lower(owned.email)=lower(h.email));
 if cardinality(purchased)>0 then
  if reason='locked' then reason:='purchase'; elsif reason='onboarding' then reason:='combined'; end if;
  visible:=array(select unnest(coalesce(visible,'{}'::uuid[])) union select unnest(purchased));
 end if;
 select coalesce(jsonb_agg(x),'[]'::jsonb) into items from (
  select h.id,h.first_name,h.email,h.phone,h.address,h.city,h.state,h.zip,h.services,h.frequency,h.created_at,
   round((extensions.st_distance(h.lead_location,z.location)/1609.344)::numeric,1) distance_miles
  from mowmatter_homeowner_requests h join mow_zip_centers z on z.zip=p_zip where h.id=any(visible)
  order by h.created_at desc,h.id limit 50 offset p_offset
 ) x;
 insert into mow_growth_seen(company_id,zip,radius,seen_at) values(cid,p_zip,p_radius,statement_timestamp())
 on conflict(company_id,zip,radius) do update set seen_at=excluded.seen_at;
 if p_radius=25 then
  insert into mow_growth_seen(company_id,zip,radius,seen_at) values(cid,p_zip,15,statement_timestamp())
  on conflict(company_id,zip,radius) do update set seen_at=excluded.seen_at;
 end if;
 return jsonb_build_object('count',total,'unlocked',reason<>'locked','access_reason',reason,'unlocked_count',coalesce(cardinality(visible),0),
 'package_count',total-coalesce(cardinality(visible),0),'package_amount_cents',least((total-coalesce(cardinality(visible),0))*500,3900),
 'leads',items,'offset',p_offset,'onboarding_complete',profile.company_id is not null,'initial_zip',profile.initial_zip,'initial_radius',profile.initial_radius);
end $function$;

CREATE OR REPLACE FUNCTION public.mow_insight_finish(rid uuid, cid uuid, success boolean, assessment jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare a mow_yard_assessments;
begin
 select * into a from mow_yard_assessments where id=rid and company_id=cid for update;
 if not found or a.state<>'processing' then return false;end if;
 if success and (jsonb_typeof(assessment)<>'object' or length(assessment::text)>30000) then raise exception 'Invalid result';end if;
 update mow_yard_assessments set state=case when success then 'owner_review' else 'failed' end,result=case when success then assessment else null end,updated_at=now() where id=rid;
 if not success then update mow_insight_allowances set remaining=remaining+1,updated_at=now() where company_id=cid;end if;
 return true;
end $function$;

CREATE OR REPLACE FUNCTION public.mow_customer_link(actor uuid, cid uuid, customer uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare customer_email text; uid uuid;
begin
 if not exists(select 1 from mow_crew_members where company_id=cid and user_id=actor and role='owner') then raise exception 'Owner access required';end if;
 select lower(trim(email)) into customer_email from mow_customers where id=customer and company_id=cid;
 if coalesce(customer_email,'')='' then raise exception 'Customer email required';end if;
 select id into uid from auth.users where lower(email)=customer_email and email_confirmed_at is not null;
 if uid is null then raise exception 'Customer must create and confirm their account first';end if;
 insert into mow_customer_access(company_id,customer_id,user_id) values(cid,customer,uid) on conflict do nothing;
 return true;
end $function$;

CREATE OR REPLACE FUNCTION public.mow_yard_respond(actor uuid, offer uuid, choice text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare o mow_yard_offers;
begin
 select * into o from mow_yard_offers where id=offer for update;
 if not found or not exists(select 1 from mow_customer_access where company_id=o.company_id and customer_id=o.customer_id and user_id=actor) then raise exception 'Offer unavailable';end if;
 if choice not in ('accepted','declined') then raise exception 'Invalid response';end if;
 if o.state=choice then return jsonb_build_object('state',o.state,'duplicate',true);end if;
 if o.state<>'offered' then raise exception 'Offer is no longer open';end if;
 update mow_yard_offers set state=choice,responded_by=actor,responded_at=now() where id=offer;
 return jsonb_build_object('state',choice,'scheduling_required',choice='accepted','charged',false);
end $function$;

CREATE OR REPLACE FUNCTION public.mow_growth_owner(actor uuid, cid uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
 if not exists(select 1 from mow_crew_members where user_id=actor and company_id=cid and role='owner') then raise exception 'Business owner access required' using errcode='42501'; end if;
end $function$;

CREATE OR REPLACE FUNCTION public.mow_growth_onboard(actor uuid, cid uuid, p_zip text, p_contact text, p_phone text, p_services text[], p_terms text)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
 perform mow_growth_owner(actor,cid);
 if not exists(select 1 from auth.users where id=actor and email_confirmed_at is not null) then raise exception 'Confirm your email first'; end if;
 if p_zip is null or p_contact is null or p_phone is null or p_terms is null or p_zip !~ '^[0-9]{5}$' or length(trim(p_contact)) not between 2 and 100 or length(regexp_replace(p_phone,'[^0-9]','','g')) not between 10 and 15
 or cardinality(p_services) is null or cardinality(p_services)=0 or not p_services <@ array['mowing','edging','hedges','leaves','cleanup','mulch'] or p_terms <> '2026-10-07' then raise exception 'Complete all registration fields'; end if;
 update mow_crew_companies set business_zip=p_zip where id=cid;
 insert into mow_growth_profiles(company_id,contact_name,phone,services,terms_version) values(cid,trim(p_contact),p_phone,p_services,p_terms)
 on conflict(company_id) do update set contact_name=excluded.contact_name,phone=excluded.phone,services=excluded.services;
end $function$;

CREATE OR REPLACE FUNCTION public.mow_growth_candidates(p_zip text, p_radius integer)
 RETURNS SETOF mowmatter_homeowner_requests
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'extensions'
AS $function$
 select distinct on (lower(h.email)) h.* from mowmatter_homeowner_requests h join mow_zip_centers z on z.zip=p_zip
 where h.no_provider_found and h.request_consent and h.lead_sharing_consent and h.status='awaiting_provider'
 and not exists(select 1 from mowmatter_homeowner_requests newer where lower(newer.email)=lower(h.email) and (newer.created_at,newer.id)>(h.created_at,h.id))
 and h.created_at >= now()-interval '30 days'
 and p_radius in (15,25) and extensions.st_dwithin(h.lead_location,z.location,p_radius*1609.344)
 order by lower(h.email),h.created_at desc,h.id
$function$;

CREATE OR REPLACE FUNCTION public.mow_growth_package(actor uuid, cid uuid, p_zip text, p_radius integer, p_amount integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare ids uuid[]; pid uuid; scan jsonb; existing mow_lead_packages; price integer;
begin
 perform mow_growth_owner(actor,cid);
 perform 1 from mow_crew_companies where id=cid for update;
 scan:=mow_growth_scan(actor,cid,p_zip,p_radius,0);
 if (scan->>'unlocked_count')::integer=(scan->>'count')::integer then raise exception 'These leads are already free or unlocked'; end if;
 select * into existing from mow_lead_packages where company_id=cid and zip=p_zip and radius=p_radius and status='pending' and created_at>now()-interval '61 minutes' order by created_at desc limit 1;
 if found then return jsonb_build_object('id',existing.id,'count',cardinality(existing.lead_ids),'amount_cents',existing.amount_cents,'stripe_session',existing.stripe_session,'expires_at',floor(extract(epoch from existing.created_at))+3600); end if;
 select array_agg(h.id) into ids from mow_growth_candidates(p_zip,p_radius) h
 where not exists(select 1 from mow_growth_profiles g where g.company_id=cid and h.id=any(g.initial_ids))
 and not exists(select 1 from mow_lead_packages p cross join lateral unnest(p.lead_ids) lid
  join mowmatter_homeowner_requests owned on owned.id=lid where p.company_id=cid and p.status='paid' and lower(owned.email)=lower(h.email));
 if coalesce(cardinality(ids),0)=0 then raise exception 'No leads to purchase'; end if;
 price:=least(cardinality(ids)*500,3900); -- Approved $5 per NEW lead, maximum $39.
 insert into mow_lead_packages(company_id,zip,radius,lead_ids,amount_cents) values(cid,p_zip,p_radius,ids,price) returning id into pid;
 return jsonb_build_object('id',pid,'count',cardinality(ids),'amount_cents',price,'expires_at',floor(extract(epoch from now()))+3600);
end $function$;

CREATE OR REPLACE FUNCTION public.mow_growth_fulfill(pid uuid, sid text, amount integer, cur text, refunded boolean DEFAULT false)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
 update mow_lead_packages set status=case when refunded then 'refunded' else 'paid' end,paid_at=case when refunded then paid_at else coalesce(paid_at,now()) end
 where id=pid and stripe_session=sid and amount_cents=amount and currency=cur and status<>'refunded';
 if not found then return exists(select 1 from mow_lead_packages where id=pid and stripe_session=sid and amount_cents=amount and currency=cur and status='refunded'); end if;
 return found;
end $function$;

CREATE OR REPLACE FUNCTION public.mm_launch_updates(p_enabled boolean)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select mowmatter_private.launch_updates(p_enabled) $function$;

CREATE OR REPLACE FUNCTION public.mowmatter_submit_compliance(p_id uuid, p_email text, p_type text, p_message text, p_notice text)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare existing public.mowmatter_compliance_requests%rowtype;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_id::text,0));
 if p_notice <> '2026-10-07' then raise exception 'Unknown request notice'; end if;
 select * into existing from public.mowmatter_compliance_requests where id=p_id;
 if found and (existing.email<>lower(trim(p_email)) or existing.request_type<>p_type or existing.message<>trim(p_message)) then raise exception 'Request identifier conflict'; end if;
 insert into public.mowmatter_compliance_requests(id,email,request_type,message,contact_consent,notice_version)
 values(p_id,lower(trim(p_email)),p_type,trim(p_message),true,p_notice) on conflict(id) do nothing;
 if p_type='unsubscribe' then
  insert into public.mowmatter_marketing_suppressions(email) values(lower(trim(p_email))) on conflict(email) do nothing;
  update public.mowmatter_leads set marketing_consent=false,launch_updates=false where email=lower(trim(p_email));
 end if;
 return true;
end; $function$;

CREATE OR REPLACE FUNCTION public.mow_insight_reserve(actor uuid, cid uuid, jid uuid, rid uuid, pids uuid[], daily_limit integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare a mow_yard_assessments; allowance mow_insight_allowances;
begin
 -- Company lock serializes both quota and idempotency. Global lock bounds daily provider spend.
 perform pg_advisory_xact_lock(20261010,1);
 perform 1 from mow_crew_companies where id=cid for update;
 if not exists(select 1 from mow_crew_members where company_id=cid and user_id=actor and role='owner') then raise exception 'Owner access required';end if;
 select * into a from mow_yard_assessments where id=rid;
 if found then
 if a.company_id<>cid or a.actor_id<>actor or a.job_id<>jid or a.photo_ids<>pids then raise exception 'Request conflict';end if;
 return jsonb_build_object('claimed',false,'state',a.state,'result',a.result);
 end if;
 if daily_limit not between 1 and 1000 or (select count(*) from mow_yard_assessments where created_at>=date_trunc('day',now()))>=daily_limit then raise exception 'Daily analysis limit reached';end if;
 if not exists(select 1 from mow_crew_jobs where id=jid and company_id=cid and cancelled_at is null) then raise exception 'Job unavailable';end if;
 if cardinality(pids) not between 1 and 3 or cardinality(pids)<>(select count(distinct x) from unnest(pids)x) or cardinality(pids)<>(select count(*) from mow_crew_photos where id=any(pids) and job_id=jid and company_id=cid) then raise exception 'Choose authorized job photos';end if;
 select * into allowance from mow_insight_allowances where company_id=cid for update;
 if not found or not allowance.enabled or allowance.remaining<1 then raise exception 'Photo Insights allowance is not activated';end if;
 update mow_insight_allowances set remaining=remaining-1,updated_at=now() where company_id=cid;
 insert into mow_yard_assessments(id,company_id,job_id,actor_id,photo_ids,state) values(rid,cid,jid,actor,pids,'processing');
 return jsonb_build_object('claimed',true);
end $function$;

CREATE OR REPLACE FUNCTION public.mow_settings_save(actor uuid, cid uuid, expected_revision integer, new_catalog jsonb, new_labor jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare s mow_owner_settings;
begin
 perform 1 from mow_crew_companies where id=cid for update;
 if not exists(select 1 from mow_crew_members where company_id=cid and user_id=actor and role='owner') then raise exception 'Owner access required';end if;
 select * into s from mow_owner_settings where company_id=cid;
 if coalesce(s.revision,0)<>expected_revision then raise exception 'Settings changed. Reload before saving';end if;
 if jsonb_typeof(new_catalog)<>'object' or jsonb_typeof(new_labor)<>'object' or length(new_catalog::text)>200000 or length(new_labor::text)>100000 then raise exception 'Invalid configuration';end if;
 insert into mow_owner_settings(company_id,revision,catalog,labor) values(cid,expected_revision+1,new_catalog,new_labor)
 on conflict(company_id) do update set revision=excluded.revision,catalog=excluded.catalog,labor=excluded.labor,updated_at=now();
 return jsonb_build_object('revision',expected_revision+1);
end $function$;

CREATE OR REPLACE FUNCTION public.mowmatter_guard_referral_consent()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sale:'||lower(trim(new.email)),0));
 if exists(select 1 from public.mowmatter_sale_suppressions where email=lower(trim(new.email))) then new.lead_sharing_consent:=false; end if;
 return new;
end; $function$;

CREATE OR REPLACE FUNCTION public.mow_yard_publish(actor uuid, cid uuid, aid uuid, oid uuid, revision integer, t text, d text, q jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare a mow_yard_assessments;j mow_crew_jobs;o mow_yard_offers;
begin
 perform 1 from mow_crew_companies where id=cid for update;
 if not exists(select 1 from mow_crew_members where company_id=cid and user_id=actor and role='owner') then raise exception 'Owner access required';end if;
 if not exists(select 1 from mow_owner_settings where company_id=cid and mow_owner_settings.revision=mow_yard_publish.revision) then raise exception 'Catalog changed. Rebuild quote';end if;
 select * into a from mow_yard_assessments where id=aid and company_id=cid and state='owner_review';if not found then raise exception 'Assessment unavailable';end if;
 select * into j from mow_crew_jobs where id=a.job_id and company_id=cid;
 if j.customer_id is null then raise exception 'Customer connection required';end if;
 select * into o from mow_yard_offers where id=oid;
 if found then
 if o.company_id<>cid or o.assessment_id<>aid or o.quote<>q or o.title<>t or o.description<>d then raise exception 'Offer conflict';end if;
 return jsonb_build_object('id',oid,'duplicate',true);
 end if;
 if jsonb_typeof(q)<>'object' or length(q::text)>30000 or (q->>'perVisitCents')::integer<=0 then raise exception 'Invalid optional quote';end if;
 insert into mow_yard_offers(id,company_id,customer_id,assessment_id,title,description,quote,catalog_revision) values(oid,cid,j.customer_id,aid,t,d,q,revision);
 return jsonb_build_object('id',oid,'charged',false,'state','offered');
end $function$;

CREATE OR REPLACE FUNCTION public.mowmatter_opt_out_sale(p_id uuid, p_email text, p_notice text)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare normalized text:=lower(trim(p_email));
begin
 if p_notice<>'2026-10-11' or length(normalized)>254 or normalized !~ '^[^[:space:]]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Invalid opt-out'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sale:'||normalized,0));
 insert into public.mowmatter_sale_suppressions(email) values(normalized) on conflict(email) do nothing;
 update public.mowmatter_homeowner_requests set lead_sharing_consent=false where lower(email)=normalized and lead_sharing_consent;
 insert into public.mowmatter_compliance_requests(id,email,request_type,message,contact_consent,notice_version,status)
 values(p_id,normalized,'privacy_correction','Stop sale/sharing of my homeowner referrals.',true,p_notice,'resolved') on conflict(id) do nothing;
 return true;
end; $function$;

CREATE OR REPLACE FUNCTION public.mow_make_customer_invoice()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
end $function$;

CREATE OR REPLACE FUNCTION public.mow_commerce_action(actor uuid, actor_email text, cid uuid, customer uuid, command text, payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare cu public.mow_customers;q public.mow_customer_quotes;r public.mow_customer_requests;is_owner boolean;rid uuid;email text;j public.mow_crew_jobs;day date;tm time;assigned uuid;new_job uuid;
begin
 perform 1 from public.mow_crew_companies where id=cid for update;
 select * into cu from public.mow_customers where company_id=cid and id=customer;
 if not found then raise exception 'Customer unavailable';end if;
 email:=actor_email;
 if email is null then raise exception 'Verified account required';end if;
 select exists(select 1 from public.mow_crew_members where company_id=cid and user_id=actor and role='owner') into is_owner;
 if command in ('request','respond') then
  if lower(email)<>lower(cu.email) or cu.email='' then raise exception 'Customer access denied';end if;
 else
  if not is_owner then raise exception 'Owner access required';end if;
 end if;
 rid:=(payload->>'id')::uuid;
 if command='request' then
  select * into r from public.mow_customer_requests where id=rid;
  if found then
   if r.company_id<>cid or r.customer_id<>customer or r.actor_id<>actor then raise exception 'Request conflict';end if;
   return jsonb_build_object('ok',true,'id',rid,'duplicate',true);
  end if;
  if (select count(*) from public.mow_customer_requests where company_id=cid and customer_id=customer and created_at>now()-interval '1 day')>=10 then raise exception 'Too many requests today';end if;
  if nullif(payload->>'job_id','') is not null then
   select * into j from public.mow_crew_jobs where id=(payload->>'job_id')::uuid and company_id=cid and customer_id=customer;
   if not found then raise exception 'Visit unavailable';end if;
  elsif payload->>'kind' in ('reschedule','cancel') then raise exception 'Select a visit';end if;
  if payload->>'kind' in ('reschedule','cancel') and (j.status not in ('scheduled','blocked') or j.cancelled_at is not null) then raise exception 'This visit cannot be changed';end if;
  if nullif(payload->>'preferred_date','') is not null and ((payload->>'preferred_date')::date<(now() at time zone 'America/New_York')::date or (payload->>'preferred_date')::date>(now() at time zone 'America/New_York')::date+365) then raise exception 'Choose a date within the next year';end if;
  insert into public.mow_customer_requests(id,company_id,customer_id,actor_id,kind,job_id,message,preferred_date) values(rid,cid,customer,actor,payload->>'kind',nullif(payload->>'job_id','')::uuid,trim(payload->>'message'),nullif(payload->>'preferred_date','')::date);
 elsif command='resolve' then
  if payload->>'state' not in ('resolved','declined') or length(trim(coalesce(payload->>'response','')))<3 then raise exception 'Add a response';end if;
  update public.mow_customer_requests set state=payload->>'state',owner_response=left(trim(payload->>'response'),1500),resolved_at=now() where id=rid and company_id=cid and customer_id=customer and state='pending';
  if not found then raise exception 'Request already handled or unavailable';end if;
 elsif command='quote' then
  if coalesce((payload->>'confirm_review')::boolean,false) is not true then raise exception 'Review quote first';end if;
  select * into q from public.mow_customer_quotes where id=rid;
  if found then
   if q.company_id<>cid or q.customer_id<>customer or q.created_by<>actor then raise exception 'Quote conflict';end if;
   return jsonb_build_object('ok',true,'id',rid,'duplicate',true);
  end if;
  if exists(select 1 from jsonb_array_elements_text(payload->'services') x where length(trim(x)) not between 1 and 80) then raise exception 'Use service labels under 80 characters';end if;
  if (payload->>'expires_at')::timestamptz<=now() or (payload->>'expires_at')::timestamptz>now()+interval '90 days' then raise exception 'Quote expiry must be within 90 days';end if;
  insert into public.mow_customer_quotes(id,company_id,customer_id,title,scope,services,amount_cents,planned_minutes,expires_at,terms,snapshot,created_by)
  select rid,cid,customer,trim(payload->>'title'),trim(payload->>'scope'),array(select jsonb_array_elements_text(payload->'services')),(payload->>'amount_cents')::integer,(payload->>'planned_minutes')::integer,(payload->>'expires_at')::timestamptz,trim(payload->>'terms'),jsonb_build_object('business',co.name,'branding',co.branding,'customer',cu.name,'address',cu.address,'city',cu.city),actor from public.mow_crew_companies co where co.id=cid;
  if nullif(payload->>'source_proposal_id','') is not null then
   if not exists(select 1 from public.mow_visit_proposals where id=(payload->>'source_proposal_id')::uuid and company_id=cid and customer_id=customer and state='pending') then raise exception 'Crew proposal unavailable';end if;
   update public.mow_customer_quotes set source_proposal_id=(payload->>'source_proposal_id')::uuid where id=rid;
   update public.mow_visit_proposals set state='quoted' where id=(payload->>'source_proposal_id')::uuid;
  end if;
 elsif command='respond' then
  select * into q from public.mow_customer_quotes where id=rid and company_id=cid and customer_id=customer for update;
  if not found then raise exception 'Quote unavailable';end if;
  if payload->>'choice' not in ('accepted','declined') then raise exception 'Choose accept or decline';end if;
  if q.state=payload->>'choice' and q.responded_by=actor then return jsonb_build_object('ok',true,'duplicate',true);end if;
  if q.state<>'sent' or q.expires_at<=now() then raise exception 'Quote expired or already handled';end if;
  if payload->>'choice'='accepted' and (coalesce((payload->>'confirm_quote')::boolean,false) is not true or payload->>'notice_version'<>'2026-10-11' or (payload->>'expected_amount_cents')::integer is distinct from q.amount_cents) then raise exception 'Review scope, terms and price first';end if;
  update public.mow_customer_quotes set state=payload->>'choice',responded_by=actor,responded_at=now(),notice_version='2026-10-11' where id=q.id;
  if q.source_offer_id is not null then update public.mow_yard_offers set state=payload->>'choice',responded_by=actor,responded_at=now() where id=q.source_offer_id and company_id=cid;end if;
 elsif command='withdraw' then
  update public.mow_customer_quotes set state='withdrawn' where id=rid and company_id=cid and customer_id=customer and state='sent';
  if not found then raise exception 'Only an unanswered quote can be withdrawn';end if;
 elsif command='apply-addon' then
  select * into q from public.mow_customer_quotes where id=rid and company_id=cid and customer_id=customer for update;
  if not found then raise exception 'Quote unavailable';end if;
  if q.state='booked' then
   if coalesce(q.applied_to_job_id,q.job_id)<>(payload->>'job_id')::uuid then raise exception 'Additional service already attached elsewhere';end if;
   return jsonb_build_object('ok',true,'duplicate',true,'job_id',q.job_id);
  end if;
  if q.state<>'accepted' or coalesce((payload->>'confirm_addon')::boolean,false) is not true then raise exception 'Customer approval and owner review required';end if;
  select * into j from public.mow_crew_jobs where id=(payload->>'job_id')::uuid and company_id=cid and customer_id=customer for update;
  if not found or j.cancelled_at is not null or j.status not in ('scheduled','arrived','in_progress','blocked') then raise exception 'Choose an active visit before completion';end if;
  if j.address<>q.snapshot->>'address' then raise exception 'Property changed; issue a new quote';end if;
  if j.plan_id is not null and exists(select 1 from public.mow_homeowner_subscriptions where plan_id=j.plan_id) then
   insert into public.mow_crew_jobs(company_id,customer_id,assigned_to,customer_name,address,city,service_date,scheduled_time,status,services,notes,latitude,longitude,requires_photo,customer_email,customer_phone,notification_consent,price_cents,planned_minutes,arrived_at,started_at)
   values(cid,customer,j.assigned_to,cu.name,j.address,j.city,j.service_date,j.scheduled_time,j.status,q.services,'Approved additional work during visit: '||q.scope,j.latitude,j.longitude,true,cu.email,cu.phone,cu.notification_consent,q.amount_cents,q.planned_minutes,j.arrived_at,j.started_at) returning id into new_job;
   update public.mow_customer_quotes set state='booked',job_id=new_job,applied_to_job_id=j.id where id=q.id;
   return jsonb_build_object('ok',true,'job_id',new_job,'separate_addon',true);
  end if;
  if j.price_cents+q.amount_cents>10000000 then raise exception 'Visit total exceeds allowed amount';end if;
  update public.mow_crew_jobs set price_cents=price_cents+q.amount_cents,services=services||q.services,notes=left(notes||E'\nApproved additional work: '||q.scope,1500),updated_at=now() where id=j.id;
  update public.mow_customer_quotes set state='booked',job_id=j.id,applied_to_job_id=j.id where id=q.id;
  return jsonb_build_object('ok',true,'job_id',j.id);
 elsif command='book' then
  select * into q from public.mow_customer_quotes where id=rid and company_id=cid and customer_id=customer for update;
  if not found then raise exception 'Quote unavailable';end if;
  if q.state='booked' then return jsonb_build_object('ok',true,'job_id',q.job_id,'duplicate',true);end if;
  if q.state<>'accepted' or coalesce((payload->>'confirm_booking')::boolean,false) is not true then raise exception 'Customer approval and owner booking review required';end if;
  if cu.address<>q.snapshot->>'address' then raise exception 'Property changed; issue a new quote';end if;
  day:=(payload->>'service_date')::date;tm:=(payload->>'scheduled_time')::time;assigned:=(payload->>'assigned_to')::uuid;
  if day<(now() at time zone 'America/New_York')::date or day>(now() at time zone 'America/New_York')::date+365 then raise exception 'Choose a date within the next year';end if;
  if day+tm+make_interval(mins=>q.planned_minutes)>day+interval '1 day' then raise exception 'Visit must finish before midnight';end if;
  if not exists(select 1 from public.mow_crew_members where company_id=cid and user_id=assigned) then raise exception 'Choose a member of your business';end if;
  if exists(select 1 from public.mow_crew_jobs where company_id=cid and assigned_to=assigned and service_date=day and cancelled_at is null and status<>'completed' and scheduled_time < tm+make_interval(mins=>q.planned_minutes) and scheduled_time+make_interval(mins=>planned_minutes)>tm) then raise exception 'This crew member has an overlapping visit';end if;
  insert into public.mow_crew_jobs(company_id,customer_id,assigned_to,customer_name,address,city,service_date,scheduled_time,services,notes,latitude,longitude,requires_photo,customer_email,customer_phone,notification_consent,price_cents,planned_minutes)
  values(cid,customer,assigned,cu.name,cu.address,cu.city,day,tm,q.services,q.scope,cu.latitude,cu.longitude,true,cu.email,cu.phone,cu.notification_consent,q.amount_cents,q.planned_minutes) returning id into new_job;
  update public.mow_customer_quotes set state='booked',job_id=new_job where id=q.id;
  return jsonb_build_object('ok',true,'job_id',new_job);
 else raise exception 'Unknown commerce action';end if;
 return jsonb_build_object('ok',true,'id',rid);
end $function$;

CREATE OR REPLACE FUNCTION public.mow_insight_quote()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare co public.mow_crew_companies;cu public.mow_customers;
begin
 select * into co from public.mow_crew_companies where id=new.company_id;
 select * into cu from public.mow_customers where id=new.customer_id and company_id=new.company_id;
 insert into public.mow_customer_quotes(id,company_id,customer_id,title,scope,services,amount_cents,planned_minutes,expires_at,terms,snapshot,created_by,source_offer_id)
 values(new.id,new.company_id,new.customer_id,new.title,new.description,array(select x->>'name' from jsonb_array_elements(new.quote->'lines') x),(new.quote->>'perVisitCents')::integer,60,now()+interval '7 days','Optional one-time additional service. Total includes the tax shown in this quote. Service date is confirmed by your provider. Additional work is not part of your recurring payment authorization.',jsonb_build_object('business',co.name,'branding',co.branding,'customer',cu.name,'address',cu.address,'city',cu.city,'assessment_id',new.assessment_id,'quote',new.quote),co.owner_id,new.id) on conflict(source_offer_id) do nothing;
 return new;
end $function$;

CREATE OR REPLACE FUNCTION public.mow_homeowner_checkout_claim(pid uuid, cid uuid, customer uuid, actor uuid, actor_email text, token uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare s public.mow_homeowner_subscriptions;p public.mow_service_plans;cu public.mow_customers;
begin
 select * into s from public.mow_homeowner_subscriptions where plan_id=pid and company_id=cid and customer_id=customer for update;
 if not found then raise exception 'Plan unavailable';end if;
 select * into p from public.mow_service_plans where id=pid and company_id=cid and customer_id=customer;
 select * into cu from public.mow_customers where id=customer and company_id=cid;
 if actor_email is null or cu.email='' or lower(actor_email)<>lower(cu.email) then raise exception 'Customer access denied';end if;
 if not p.active or p.price_cents is distinct from (s.snapshot->>'per_visit_cents')::integer or p.interval_days is distinct from (s.snapshot->>'interval_days')::integer then raise exception 'Service plan changed. Ask the provider for a new proposal';end if;
 if s.status not in ('proposed','incomplete_expired') or s.subscription_id is not null then raise exception 'Manage the existing subscription';end if;
 if s.lease_until>now() then return false;end if;
 update public.mow_homeowner_subscriptions set nonce=token,lease_until=now()+interval '31 minutes',accepted_by=actor,accepted_at=now(),notice_version='2026-10-11',checkout_session=null,updated_at=now() where plan_id=pid;
 return true;
end $function$;

CREATE OR REPLACE FUNCTION public.mow_visit_propose(actor uuid, jid uuid, rid uuid, t text, d text)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
end $function$;

CREATE OR REPLACE FUNCTION public.mow_sms_stop(p_phone text)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sms:'||p_phone,0));
 insert into public.mow_sms_suppressions(phone) values(p_phone) on conflict do nothing;
 update public.mow_customer_channels set sms_offer_consent=false,sms_service_consent=false where phone=p_phone;
 return true;
end $function$;

CREATE OR REPLACE FUNCTION public.mow_sms_preferences(actor uuid, actor_email text, cid uuid, customer uuid, p_phone text, consent boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare cu public.mow_customers;
begin
 select * into cu from public.mow_customers where company_id=cid and id=customer;
 if not found or actor_email is null or cu.email='' or lower(actor_email)<>lower(cu.email) then raise exception 'Customer access denied';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sms:'||p_phone,0));
 if consent and exists(select 1 from public.mow_sms_suppressions where phone=p_phone) then raise exception 'This number opted out by text. Contact support to verify re-enrollment';end if;
 insert into public.mow_customer_channels(company_id,customer_id,phone,sms_offer_consent,consented_by,notice_version) values(cid,customer,p_phone,consent,actor,'2026-10-11')
 on conflict(company_id,customer_id) do update set phone=excluded.phone,sms_offer_consent=excluded.sms_offer_consent,consented_by=actor,consented_at=now(),notice_version='2026-10-11';
 return true;
end $function$;

CREATE OR REPLACE FUNCTION public.mow_quote_sms_claim(qid uuid, cid uuid, actor uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
end $function$;

CREATE OR REPLACE FUNCTION public.mow_homeowner_sync(eid text, etype text, ec bigint, pid uuid, cid uuid, subid text, scustomer text, new_state text, pstart bigint, pend bigint, cancel_end boolean, invoice_state text)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare s public.mow_homeowner_subscriptions;
begin
 perform 1 from public.mow_crew_companies where id=cid for update;
 select * into s from public.mow_homeowner_subscriptions where plan_id=pid and company_id=cid for update;
 if not found or s.accepted_at is null or s.stripe_customer is distinct from scustomer or (s.subscription_id is not null and s.subscription_id<>subid) then raise exception 'Subscription record mismatch';end if;
 if s.event_created>ec or (s.status='canceled' and new_state<>'canceled') then return false;end if;
 insert into public.mow_billing_events(event_id,event_type) values(eid,etype) on conflict do nothing;
 if not found then return false;end if;
 update public.mow_homeowner_subscriptions set event_created=ec,subscription_id=subid,status=new_state,period_start=pstart,period_end=pend,cancel_at_period_end=cancel_end,last_invoice_status=invoice_state,updated_at=now() where plan_id=pid;
 if new_state='canceled' then
  update public.mow_service_plans set active=false where id=pid and company_id=cid;
  update public.mow_crew_jobs set cancelled_at=now(),cancellation_source='subscription_cancel',cancellation_reason='Recurring payment plan ended',updated_at=now() where plan_id=pid and company_id=cid and cancelled_at is null and status in ('scheduled','blocked') and service_date>=(now() at time zone 'America/New_York')::date;
 end if;
 return true;
end $function$;

CREATE OR REPLACE FUNCTION public.mow_invoice_delivery_claim(iid uuid, stage integer, cid uuid, manual boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare i public.mow_customer_invoices;j public.mow_crew_jobs;c public.mow_customers;co public.mow_crew_companies;
begin
 if stage not between 0 and 2 then raise exception 'Invalid delivery stage';end if;
 select * into i from public.mow_customer_invoices where id=iid and company_id=cid for update;
 if not found or i.settlement_status<>'open' then return false;end if;
 select * into j from public.mow_crew_jobs where id=i.job_id and company_id=cid;
 if j.status<>'completed' or j.cancelled_at is not null then return false;end if;
 if exists(select 1 from public.mow_payment_checkouts where job_id=j.id and status='paid') or exists(select 1 from public.mow_homeowner_subscriptions where plan_id=j.plan_id) then return false;end if;
 select * into c from public.mow_customers where id=i.customer_id and company_id=cid;
 if not c.notification_consent or c.email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then return false;end if;
 select * into co from public.mow_crew_companies where id=cid;
 if stage=0 then
  if i.email_status not in ('draft','failed') then return false;end if;
  if not manual and co.branding->>'auto_send_invoice' is distinct from 'true' then return false;end if;
 else
  if co.branding->>'invoice_reminders' is distinct from 'true' or i.email_status<>'sent' or now()<i.due_at+make_interval(days=>stage*7) then return false;end if;
 end if;
 insert into public.mow_invoice_deliveries(invoice_id,step,company_id) values(iid,stage,cid) on conflict do nothing;
 if not found then return false;end if;
 if stage=0 then update public.mow_customer_invoices set email_status='sending',email_attempt_at=now() where id=iid;end if;
 return true;
end $function$;

CREATE OR REPLACE FUNCTION public.mow_invoice_delivery_candidates()
 RETURNS SETOF mow_customer_invoices
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 select i.* from public.mow_customer_invoices i join public.mow_crew_companies co on co.id=i.company_id join public.mow_crew_jobs j on j.id=i.job_id join public.mow_customers c on c.id=i.customer_id and c.company_id=i.company_id
 where i.settlement_status='open' and j.status='completed' and j.cancelled_at is null and c.notification_consent and c.email<>''
 and not exists(select 1 from public.mow_payment_checkouts p where p.job_id=j.id and p.status='paid')
 and not exists(select 1 from public.mow_homeowner_subscriptions s where s.plan_id=j.plan_id)
 and ((co.branding->>'auto_send_invoice'='true' and i.email_status in ('draft','failed') and not exists(select 1 from public.mow_invoice_deliveries d where d.invoice_id=i.id and d.step=0))
 or (co.branding->>'invoice_reminders'='true' and i.email_status='sent' and i.due_at+interval '7 days'<=now() and not exists(select 1 from public.mow_invoice_deliveries d where d.invoice_id=i.id and d.step=case when i.due_at+interval '14 days'<=now() then 2 else 1 end)))
 order by i.created_at limit 10;
$function$;

CREATE OR REPLACE FUNCTION public.mow_guard_recurring_service_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
 if exists(select 1 from public.mow_homeowner_subscriptions s where s.plan_id=new.id and s.status not in ('proposed','canceled','incomplete_expired')) then
  if new.active is distinct from old.active or new.price_cents is distinct from old.price_cents or new.interval_days is distinct from old.interval_days or new.services is distinct from old.services then raise exception 'Manage recurring billing before changing this authorized service plan';end if;
 end if;
 return new;
end $function$;

CREATE OR REPLACE FUNCTION public.mow_sms_all_preferences(actor uuid, actor_email text, cid uuid, customer uuid, p_phone text, consent boolean, service_consent boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
 if (consent or service_consent) and exists(select 1 from public.mow_sms_suppressions where phone=p_phone) then raise exception 'Number opted out. Contact support to verify re-enrollment';end if;
 perform public.mow_sms_preferences(actor,actor_email,cid,customer,p_phone,consent);
 -- The existing preference function holds the phone advisory lock until this transaction ends.
 if service_consent and exists(select 1 from public.mow_sms_suppressions where phone=p_phone) then raise exception 'Number opted out';end if;
 update public.mow_customer_channels set sms_service_consent=service_consent,notice_version='2026-10-12' where company_id=cid and customer_id=customer;
 return true;
end $function$;

CREATE OR REPLACE FUNCTION public.mow_visit_sms_claim(actor uuid, eid uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare e public.mow_crew_events;j public.mow_crew_jobs;c public.mow_customer_channels;k text;mid uuid;company_name text;
begin
 select * into e from public.mow_crew_events where id=eid;
 if not found or e.action not in ('check_in','start','complete') then raise exception 'Visit event unavailable';end if;
 select * into j from public.mow_crew_jobs where id=e.job_id for update;
 if not exists(select 1 from public.mow_crew_members m where m.company_id=j.company_id and m.user_id=actor and (m.role in ('owner','lead') or j.assigned_to=actor)) then raise exception 'Assigned visit access required';end if;
 if j.cancelled_at is not null or j.customer_id is null or e.created_at<now()-interval '15 minutes' then return jsonb_build_object('claimed',false,'status','held_stale_or_unlinked');end if;
 k=case when e.action='complete' then 'completion' else 'arrival' end;
 if k='arrival' and j.status='completed' then return jsonb_build_object('claimed',false,'status','held_stale_or_unlinked');end if;
 select * into c from public.mow_customer_channels where company_id=j.company_id and customer_id=j.customer_id;
 if not found or not c.sms_service_consent then return jsonb_build_object('claimed',false,'status','held_no_consent');end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sms:'||c.phone,0));
 if exists(select 1 from public.mow_sms_suppressions where phone=c.phone) then return jsonb_build_object('claimed',false,'status','held_opt_out');end if;
 insert into public.mow_visit_sms_messages(company_id,job_id,event_id,kind) values(j.company_id,j.id,eid,k) on conflict(job_id,kind) do nothing returning id into mid;
 if mid is null then return jsonb_build_object('claimed',false,'status',(select status from public.mow_visit_sms_messages where job_id=j.id and kind=k));end if;
 select name into company_name from public.mow_crew_companies where id=j.company_id;
 return jsonb_build_object('claimed',true,'id',mid,'phone',c.phone,'kind',k,'company_name',company_name,'company_id',j.company_id,'customer_id',j.customer_id);
end $function$;

CREATE TRIGGER mow_customer_invoice_completion AFTER INSERT OR UPDATE OF status ON public.mow_crew_jobs FOR EACH ROW EXECUTE FUNCTION mow_make_customer_invoice();
CREATE TRIGGER mowmatter_guard_referral_consent BEFORE INSERT OR UPDATE OF email, lead_sharing_consent ON public.mowmatter_homeowner_requests FOR EACH ROW EXECUTE FUNCTION mowmatter_guard_referral_consent();
CREATE TRIGGER mow_insight_quote AFTER INSERT ON public.mow_yard_offers FOR EACH ROW EXECUTE FUNCTION mow_insight_quote();
CREATE TRIGGER mow_guard_recurring_service_changes BEFORE UPDATE ON public.mow_service_plans FOR EACH ROW EXECUTE FUNCTION mow_guard_recurring_service_changes();
alter table public.mowmatter_directory_listings enable row level security;
revoke all on public.mowmatter_directory_listings from public,anon,authenticated;
grant all on public.mowmatter_directory_listings to service_role;
alter table public.mowmatter_featured_placements enable row level security;
revoke all on public.mowmatter_featured_placements from public,anon,authenticated;
grant all on public.mowmatter_featured_placements to service_role;
alter table public.mow_crew_companies enable row level security;
revoke all on public.mow_crew_companies from public,anon,authenticated;
grant all on public.mow_crew_companies to service_role;
alter table public.mow_crew_members enable row level security;
revoke all on public.mow_crew_members from public,anon,authenticated;
grant all on public.mow_crew_members to service_role;
alter table public.mow_crew_jobs enable row level security;
revoke all on public.mow_crew_jobs from public,anon,authenticated;
grant all on public.mow_crew_jobs to service_role;
alter table public.mow_crew_events enable row level security;
revoke all on public.mow_crew_events from public,anon,authenticated;
grant all on public.mow_crew_events to service_role;
alter table public.mow_crew_photos enable row level security;
revoke all on public.mow_crew_photos from public,anon,authenticated;
grant all on public.mow_crew_photos to service_role;
alter table public.mow_crew_notifications enable row level security;
revoke all on public.mow_crew_notifications from public,anon,authenticated;
grant all on public.mow_crew_notifications to service_role;
alter table public.mow_crew_messages enable row level security;
revoke all on public.mow_crew_messages from public,anon,authenticated;
grant all on public.mow_crew_messages to service_role;
alter table public.mowmatter_leads enable row level security;
revoke all on public.mowmatter_leads from public,anon,authenticated;
grant all on public.mowmatter_leads to service_role;
alter table public.mowmatter_funnel_events enable row level security;
revoke all on public.mowmatter_funnel_events from public,anon,authenticated;
grant all on public.mowmatter_funnel_events to service_role;
alter table public.mow_property_daily_limits enable row level security;
revoke all on public.mow_property_daily_limits from public,anon,authenticated;
grant all on public.mow_property_daily_limits to service_role;
alter table public.mow_property_trials enable row level security;
revoke all on public.mow_property_trials from public,anon,authenticated;
grant all on public.mow_property_trials to service_role;
alter table public.mowmatter_request_limits enable row level security;
revoke all on public.mowmatter_request_limits from public,anon,authenticated;
grant all on public.mowmatter_request_limits to service_role;
alter table public.mowmatter_homeowner_requests enable row level security;
revoke all on public.mowmatter_homeowner_requests from public,anon,authenticated;
grant all on public.mowmatter_homeowner_requests to service_role;
alter table public.mow_cash_entries enable row level security;
revoke all on public.mow_cash_entries from public,anon,authenticated;
grant all on public.mow_cash_entries to service_role;
alter table public.mow_customers enable row level security;
revoke all on public.mow_customers from public,anon,authenticated;
grant all on public.mow_customers to service_role;
alter table public.mow_service_plans enable row level security;
revoke all on public.mow_service_plans from public,anon,authenticated;
grant all on public.mow_service_plans to service_role;
alter table public.mow_billing_events enable row level security;
revoke all on public.mow_billing_events from public,anon,authenticated;
grant all on public.mow_billing_events to service_role;
alter table public.mow_billing_accounts enable row level security;
revoke all on public.mow_billing_accounts from public,anon,authenticated;
grant all on public.mow_billing_accounts to service_role;
alter table public.mow_payment_checkouts enable row level security;
revoke all on public.mow_payment_checkouts from public,anon,authenticated;
grant all on public.mow_payment_checkouts to service_role;
alter table public.mow_payment_activity enable row level security;
revoke all on public.mow_payment_activity from public,anon,authenticated;
grant all on public.mow_payment_activity to service_role;
alter table public.mowmatter_compliance_requests enable row level security;
revoke all on public.mowmatter_compliance_requests from public,anon,authenticated;
grant all on public.mowmatter_compliance_requests to service_role;
alter table public.mowmatter_marketing_suppressions enable row level security;
revoke all on public.mowmatter_marketing_suppressions from public,anon,authenticated;
grant all on public.mowmatter_marketing_suppressions to service_role;
alter table public.mow_zip_centers enable row level security;
revoke all on public.mow_zip_centers from public,anon,authenticated;
grant all on public.mow_zip_centers to service_role;
alter table public.mow_growth_profiles enable row level security;
revoke all on public.mow_growth_profiles from public,anon,authenticated;
grant all on public.mow_growth_profiles to service_role;
alter table public.mow_lead_packages enable row level security;
revoke all on public.mow_lead_packages from public,anon,authenticated;
grant all on public.mow_lead_packages to service_role;
alter table public.mow_growth_seen enable row level security;
revoke all on public.mow_growth_seen from public,anon,authenticated;
grant all on public.mow_growth_seen to service_role;
alter table public.mow_yard_offers enable row level security;
revoke all on public.mow_yard_offers from public,anon,authenticated;
grant all on public.mow_yard_offers to service_role;
alter table public.mow_owner_settings enable row level security;
revoke all on public.mow_owner_settings from public,anon,authenticated;
grant all on public.mow_owner_settings to service_role;
alter table public.mow_customer_access enable row level security;
revoke all on public.mow_customer_access from public,anon,authenticated;
grant all on public.mow_customer_access to service_role;
alter table public.mow_insight_allowances enable row level security;
revoke all on public.mow_insight_allowances from public,anon,authenticated;
grant all on public.mow_insight_allowances to service_role;
alter table public.mow_yard_assessments enable row level security;
revoke all on public.mow_yard_assessments from public,anon,authenticated;
grant all on public.mow_yard_assessments to service_role;
alter table public.mowmatter_sale_suppressions enable row level security;
revoke all on public.mowmatter_sale_suppressions from public,anon,authenticated;
grant all on public.mowmatter_sale_suppressions to service_role;
alter table public.mow_customer_invoices enable row level security;
revoke all on public.mow_customer_invoices from public,anon,authenticated;
grant all on public.mow_customer_invoices to service_role;
alter table public.mow_customer_quotes enable row level security;
revoke all on public.mow_customer_quotes from public,anon,authenticated;
grant all on public.mow_customer_quotes to service_role;
alter table public.mow_customer_requests enable row level security;
revoke all on public.mow_customer_requests from public,anon,authenticated;
grant all on public.mow_customer_requests to service_role;
alter table public.mow_homeowner_subscriptions enable row level security;
revoke all on public.mow_homeowner_subscriptions from public,anon,authenticated;
grant all on public.mow_homeowner_subscriptions to service_role;
alter table public.mow_visit_proposals enable row level security;
revoke all on public.mow_visit_proposals from public,anon,authenticated;
grant all on public.mow_visit_proposals to service_role;
alter table public.mow_customer_channels enable row level security;
revoke all on public.mow_customer_channels from public,anon,authenticated;
grant all on public.mow_customer_channels to service_role;
alter table public.mow_sms_suppressions enable row level security;
revoke all on public.mow_sms_suppressions from public,anon,authenticated;
grant all on public.mow_sms_suppressions to service_role;
alter table public.mow_quote_messages enable row level security;
revoke all on public.mow_quote_messages from public,anon,authenticated;
grant all on public.mow_quote_messages to service_role;
alter table public.mow_visit_sms_messages enable row level security;
revoke all on public.mow_visit_sms_messages from public,anon,authenticated;
grant all on public.mow_visit_sms_messages to service_role;
alter table public.mow_invoice_deliveries enable row level security;
revoke all on public.mow_invoice_deliveries from public,anon,authenticated;
grant all on public.mow_invoice_deliveries to service_role;
revoke all on function mowmatter_rate_limit(text,integer) from public,anon,authenticated;
grant execute on function mowmatter_rate_limit(text,integer) to service_role;
revoke all on function mow_crew_bootstrap(uuid,text) from public,anon,authenticated;
grant execute on function mow_crew_bootstrap(uuid,text) to service_role;
revoke all on function mow_crew_assign_member(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function mow_crew_assign_member(uuid,uuid,text,text) to service_role;
revoke all on function mow_payment_event(text,text,bigint,uuid,text,text) from public,anon,authenticated;
grant execute on function mow_payment_event(text,text,bigint,uuid,text,text) to service_role;
revoke all on function mow_payment_claim(uuid,uuid,uuid,integer,integer,integer) from public,anon,authenticated;
grant execute on function mow_payment_claim(uuid,uuid,uuid,integer,integer,integer) to service_role;
revoke all on function mow_property_reserve(uuid,uuid) from public,anon,authenticated;
grant execute on function mow_property_reserve(uuid,uuid) to service_role;
revoke all on function mow_office_action(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function mow_office_action(uuid,uuid,text,jsonb) to service_role;
revoke all on function mow_crew_transition(uuid,uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function mow_crew_transition(uuid,uuid,uuid,text,jsonb) to service_role;
revoke all on function mow_billing_apply(text,text,bigint,text,text,text,text,boolean,bigint,boolean) from public,anon,authenticated;
grant execute on function mow_billing_apply(text,text,bigint,text,text,text,text,boolean,bigint,boolean) to service_role;
revoke all on function mow_billing_checkout_claim(uuid,uuid) from public,anon,authenticated;
grant execute on function mow_billing_checkout_claim(uuid,uuid) to service_role;
revoke all on function mow_growth_zip(text,double precision,double precision) from public,anon,authenticated;
grant execute on function mow_growth_zip(text,double precision,double precision) to service_role;
revoke all on function mow_growth_alerts(uuid,uuid,text,integer) from public,anon,authenticated;
grant execute on function mow_growth_alerts(uuid,uuid,text,integer) to service_role;
revoke all on function mow_growth_scan(uuid,uuid,text,integer,integer) from public,anon,authenticated;
grant execute on function mow_growth_scan(uuid,uuid,text,integer,integer) to service_role;
revoke all on function mow_insight_finish(uuid,uuid,boolean,jsonb) from public,anon,authenticated;
grant execute on function mow_insight_finish(uuid,uuid,boolean,jsonb) to service_role;
revoke all on function mow_customer_link(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function mow_customer_link(uuid,uuid,uuid) to service_role;
revoke all on function mow_yard_respond(uuid,uuid,text) from public,anon,authenticated;
grant execute on function mow_yard_respond(uuid,uuid,text) to service_role;
revoke all on function mow_growth_owner(uuid,uuid) from public,anon,authenticated;
grant execute on function mow_growth_owner(uuid,uuid) to service_role;
revoke all on function mow_growth_onboard(uuid,uuid,text,text,text,text[],text) from public,anon,authenticated;
grant execute on function mow_growth_onboard(uuid,uuid,text,text,text,text[],text) to service_role;
revoke all on function mow_growth_candidates(text,integer) from public,anon,authenticated;
grant execute on function mow_growth_candidates(text,integer) to service_role;
revoke all on function mow_growth_package(uuid,uuid,text,integer,integer) from public,anon,authenticated;
grant execute on function mow_growth_package(uuid,uuid,text,integer,integer) to service_role;
revoke all on function mow_growth_fulfill(uuid,text,integer,text,boolean) from public,anon,authenticated;
grant execute on function mow_growth_fulfill(uuid,text,integer,text,boolean) to service_role;
revoke all on function mm_launch_updates(boolean) from public,anon,authenticated;
grant execute on function mm_launch_updates(boolean) to service_role;
revoke all on function mowmatter_submit_compliance(uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function mowmatter_submit_compliance(uuid,text,text,text,text) to service_role;
revoke all on function mow_insight_reserve(uuid,uuid,uuid,uuid,uuid[],integer) from public,anon,authenticated;
grant execute on function mow_insight_reserve(uuid,uuid,uuid,uuid,uuid[],integer) to service_role;
revoke all on function mow_settings_save(uuid,uuid,integer,jsonb,jsonb) from public,anon,authenticated;
grant execute on function mow_settings_save(uuid,uuid,integer,jsonb,jsonb) to service_role;
revoke all on function mowmatter_guard_referral_consent() from public,anon,authenticated;
grant execute on function mowmatter_guard_referral_consent() to service_role;
revoke all on function mow_yard_publish(uuid,uuid,uuid,uuid,integer,text,text,jsonb) from public,anon,authenticated;
grant execute on function mow_yard_publish(uuid,uuid,uuid,uuid,integer,text,text,jsonb) to service_role;
revoke all on function mowmatter_opt_out_sale(uuid,text,text) from public,anon,authenticated;
grant execute on function mowmatter_opt_out_sale(uuid,text,text) to service_role;
revoke all on function mow_make_customer_invoice() from public,anon,authenticated;
grant execute on function mow_make_customer_invoice() to service_role;
revoke all on function mow_commerce_action(uuid,text,uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function mow_commerce_action(uuid,text,uuid,uuid,text,jsonb) to service_role;
revoke all on function mow_insight_quote() from public,anon,authenticated;
grant execute on function mow_insight_quote() to service_role;
revoke all on function mow_homeowner_checkout_claim(uuid,uuid,uuid,uuid,text,uuid) from public,anon,authenticated;
grant execute on function mow_homeowner_checkout_claim(uuid,uuid,uuid,uuid,text,uuid) to service_role;
revoke all on function mow_visit_propose(uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function mow_visit_propose(uuid,uuid,uuid,text,text) to service_role;
revoke all on function mow_sms_stop(text) from public,anon,authenticated;
grant execute on function mow_sms_stop(text) to service_role;
revoke all on function mow_sms_preferences(uuid,text,uuid,uuid,text,boolean) from public,anon,authenticated;
grant execute on function mow_sms_preferences(uuid,text,uuid,uuid,text,boolean) to service_role;
revoke all on function mow_quote_sms_claim(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function mow_quote_sms_claim(uuid,uuid,uuid) to service_role;
revoke all on function mow_homeowner_sync(text,text,bigint,uuid,uuid,text,text,text,bigint,bigint,boolean,text) from public,anon,authenticated;
grant execute on function mow_homeowner_sync(text,text,bigint,uuid,uuid,text,text,text,bigint,bigint,boolean,text) to service_role;
revoke all on function mow_invoice_delivery_claim(uuid,integer,uuid,boolean) from public,anon,authenticated;
grant execute on function mow_invoice_delivery_claim(uuid,integer,uuid,boolean) to service_role;
revoke all on function mow_invoice_delivery_candidates() from public,anon,authenticated;
grant execute on function mow_invoice_delivery_candidates() to service_role;
revoke all on function mow_guard_recurring_service_changes() from public,anon,authenticated;
grant execute on function mow_guard_recurring_service_changes() to service_role;
revoke all on function mow_sms_all_preferences(uuid,text,uuid,uuid,text,boolean,boolean) from public,anon,authenticated;
grant execute on function mow_sms_all_preferences(uuid,text,uuid,uuid,text,boolean,boolean) to service_role;
revoke all on function mow_visit_sms_claim(uuid,uuid) from public,anon,authenticated;
grant execute on function mow_visit_sms_claim(uuid,uuid) to service_role;
commit;
