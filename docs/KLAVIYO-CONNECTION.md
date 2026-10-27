# Klaviyo replacement — October 27, 2026

## Account and configuration evidence

The owner approved replacing Bird with Klaviyo. End-customer messages identify the lawn company plus “powered by Mowmatter”. The account is Mowmatter, site ID QTtf7q. The private key “Mowmatter production integration” is saved as KLAVIYO_PRIVATE_API_KEY directly on the Render API service mowmatter-property (srv-db1ruvmgekts73f6sud0) in MowMatter. It has read/write Events, List, Profiles and Subscriptions; read Accounts and Metrics. Never record its value. It was saved without deployment; runtime availability is not verified.

October 27: Klaviyo SMS settings still showed “Set up texting for free”. Registration, sender approval and delivery are unverified. Bird readiness flags do not authorize Klaviyo sending.

## Prepared transport

api/commerce/klaviyo.mjs replaces Bird in createSMS. It uses API revision 2026-10-15 and submits flow events; it does not directly send carrier messages. Existing authenticated company-scoped database claims, local consent, daily offer limits and no-retry protection remain. Every send reads current Klaviyo subscription eligibility. Missing, revoked or blocked consent fails closed. Sending never calls Subscribe Profiles or reverses STOP. Service-only consent cannot authorize marketing.

Immutable company/customer IDs and message content live on the event, never shared profile properties. A person can use several lawn companies. The approved carrier identity must cover this platform use case; message wording does not establish separate brand registration or sending numbers.

Accepted means the event was accepted by Klaviyo, not carrier delivery. A deterministic unique_id deduplicates the same profile/metric/event. Delivery reporting is unconnected. The retired Bird callback returns 410 and cannot mutate consent or delivery status. The legacy Bird adapter remains solely for regression coverage; it is not imported by the runtime SMS service.

## Flows still required

- MowMatter SMS Service Requested: metric-triggered flow with SMS content `{{ event.message }}`. Obtain transactional designation/approval and test transactional-only consent. Allow distinct event re-entry. Do not add promotional content.
- MowMatter SMS Offer Requested: metric-triggered marketing flow with `{{ event.message }}`. Keep native consent/suppression checks and applicable quiet hours. Local claims retain the daily cap.
- Configure native welcome/STOP/HELP and a fresh authenticated consent-sync path. Existing MowMatter preferences are NOT automatically enrolled in Klaviyo. Avoid duplicate native/application welcome messages. A saved local preference cannot override provider opt-out.

These flows are requirements, not claims that they exist. KLAVIYO_FLOWS_VERIFIED must remain false until controlled end-to-end tests pass.

## Remaining connections

1. Operator subscription billing: validated Stripe platform lifecycle events → company-owner profile under MowMatter identity. Requires explicit owner SMS consent, durable event queue and environment/signature validation.
2. Homeowner billing: validated Stripe connected-account invoice/payment events → the matching company/customer under lawn-company identity. Requires separate billing consent, reminder frequency/caps, settled-invoice cancellation and durable deduplication. Arrival/completion consent cannot silently authorize billing.
3. Upsells: prepared transport connects the existing owner-reviewed quote-send path. Customer approval of scope and charges remains unchanged.
4. Landing leads: Supabase capture remains the source of truth. Add a durable sync queue, preserve suppressions and collect distinct optional SMS consent. Generic contact or email-marketing consent is not SMS consent. Do not export addresses, access notes or financial snapshots unnecessarily.
5. Synchronize actual opt-in forms, public SMS guide, privacy and terms before activating new categories.

No billing webhook, landing form, database migration, customer subscription or production flow is changed in this transport draft. It is not the completed integration.

## Activation

Keep MOW_SMS_ENABLED, KLAVIYO_REGISTRATION_APPROVED and KLAVIYO_FLOWS_VERIFIED false until sender approval, consent synchronization, both flows, company branding, STOP/HELP, duplicates/timeouts and controlled phone delivery tests pass. Route notices retain their separate gate. Do not queue historical preferences for automatic sending at activation.

References: https://developers.klaviyo.com/en/reference/create_event ; https://developers.klaviyo.com/en/reference/get_profiles ; https://developers.klaviyo.com/en/reference/bulk_subscribe_profiles ; https://help.klaviyo.com/hc/en-us/articles/26024442679835
