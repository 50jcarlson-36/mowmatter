# Klaviyo replacement — October 27, 2026

## Account and configuration evidence

The owner approved replacing Bird with Klaviyo. End-customer messages identify the lawn company plus “powered by Mowmatter”. The account is Mowmatter, site ID QTtf7q. The private key “Mowmatter production integration” is saved as KLAVIYO_PRIVATE_API_KEY directly on the Render API service mowmatter-property (srv-db1ruvmgekts73f6sud0) in MowMatter. It has read/write Events, List, Profiles and Subscriptions; read Accounts and Metrics. Never record its value. It was saved without deployment; runtime availability is not verified.

October 27 update: owner completed registration. Klaviyo Sender information shows +1 (833) 807-0561, toll-free, Under review for US and Canada. The editor estimates 2–5 business days; this is a provider estimate, not an approval guarantee. Carrier approval and delivery remain unverified. Bird readiness flags do not authorize Klaviyo sending. The saved private key was verified against accounts, metrics and lists APIs with HTTP 200, account QTtf7q / Mowmatter. No real contacts or messages were used for this check.

## Prepared transport

api/commerce/klaviyo.mjs replaces Bird in createSMS. It uses API revision 2026-10-15 and submits flow events; it does not directly send carrier messages. Existing authenticated company-scoped database claims, local consent, daily offer limits and no-retry protection remain. Every send reads current Klaviyo subscription eligibility. Missing, revoked or blocked consent fails closed. Sending never calls Subscribe Profiles or reverses STOP. Service-only consent cannot authorize marketing.

Immutable company/customer IDs and message content live on the event, never shared profile properties. A person can use several lawn companies. The approved carrier identity must cover this platform use case; message wording does not establish separate brand registration or sending numbers.

Accepted means the event was accepted by Klaviyo, not carrier delivery. A deterministic unique_id deduplicates the same profile/metric/event. Delivery reporting is unconnected. The retired Bird callback returns 410 and cannot mutate consent or delivery status. The legacy Bird adapter remains solely for regression coverage; it is not imported by the runtime SMS service.

## Flows still required

- MowMatter SMS Service Requested: metric-triggered flow with SMS content `{{ event.message }}`. Obtain transactional designation/approval and test transactional-only consent. Allow distinct event re-entry. Do not add promotional content.
- MowMatter SMS Offer Requested: metric-triggered marketing flow with `{{ event.message }}`. Keep native consent/suppression checks and applicable quiet hours. Local claims retain the daily cap.
- Configure and verify native welcome/STOP/HELP. Use the authenticated consent-sync path described below. Existing MowMatter preferences are NOT automatically enrolled in Klaviyo. Avoid duplicate native/application welcome messages. A saved local preference cannot override provider opt-out.

Saved and verified in Klaviyo, all Draft, with content `{{ event.message }}` and repeating metric triggers:
- Service flow SFePvq; trigger QWuWh4, message SZSASs, action 122515428.
- Upsell flow VDj3SF; trigger S7TMaU.
- Homeowner billing flow VBLMJx.
- Requested lead follow-up flow RRbZXT.

Only backfill=true setup events with an external-ID-only profile (no email/phone) were submitted to register these metrics; they cannot send SMS. The billing/lead drafts are not connected to production event producers. Service/billing require transactional designation. Current native Smart Sending and quiet hours remain on: service arrival/completion must not be enabled with settings that would silently skip a second update or delay an arrival until the next day. Set approved per-message transactional timing and expiry before activation; do not globally disable safeguards.

Fresh account consent synchronization is now implemented after authenticated local preference persistence. New selected service/marketing categories are submitted separately without historical import. Provider STOP is mirrored to local suppression and never silently reversed; provider ineligibility is not cleared. Async subscription processing is shown as pending; a subsequent explicit save can request the existing idempotent confirmation. Local category withdrawal prevents subsequent company-scoped claims; no broad campaigns should be built from shared profile consent.

KLAVIYO_FLOWS_VERIFIED remains false until controlled end-to-end tests pass.

## Remaining connections

1. Operator subscription billing: an existing native Stripe integration is Enabled (created October 27). Its Data tab confirms historical invoices/payments synced, last sync October 27 at 9:01 AM as displayed by Klaviyo. Existing metrics include Issued Invoice, Successfully Paid, Failed Payment and Refunded Payment. The signing-secret field is populated and test-data sync is off. Live webhook receipt and selected Stripe-account identity remain to verify; do not assume this covers Connect customer events. Owner SMS consent and billing flows still need wiring.
2. Homeowner billing: validated Stripe connected-account invoice/payment events → the matching company/customer under lawn-company identity. Requires separate billing consent, reminder frequency/caps, settled-invoice cancellation and durable deduplication. Arrival/completion consent cannot silently authorize billing.
3. Upsells: prepared transport connects the existing owner-reviewed quote-send path. Customer approval of scope and charges remains unchanged.
4. Landing leads: Supabase capture remains the source of truth. Add a durable sync queue, preserve suppressions and collect distinct optional SMS consent. Generic contact or email-marketing consent is not SMS consent. Do not export addresses, access notes or financial snapshots unnecessarily.
5. Synchronize actual opt-in forms, public SMS guide, privacy and terms before activating new categories.

No billing webhook, landing form, database migration, customer subscription or production flow is changed in this transport draft. It is not the completed integration.

## Activation

Keep MOW_SMS_ENABLED, KLAVIYO_REGISTRATION_APPROVED and KLAVIYO_FLOWS_VERIFIED false until sender approval, consent synchronization, both flows, company branding, STOP/HELP, duplicates/timeouts and controlled phone delivery tests pass. Route notices retain their separate gate. Do not queue historical preferences for automatic sending at activation.

References: https://developers.klaviyo.com/en/reference/create_event ; https://developers.klaviyo.com/en/reference/get_profiles ; https://developers.klaviyo.com/en/reference/bulk_subscribe_profiles ; https://help.klaviyo.com/hc/en-us/articles/26024442679835
