# Customer commerce release — 2026-10-11

Customers is the owner entry point for requests, crew proposals, quotes, approved booking/add-ons and recurring payment proposals. The customer account link is business/customer scoped and requires a verified matching email; identifiers are not bearer credentials.

Recurring billing uses a fixed monthly total calculated from the saved per-visit amount and 7/14/28-day cadence. The customer sees the first service date, scope, monthly renewal, cancellation terms and separate-extra notice before an unchecked authorization. Checkout begins billing immediately. The plan cannot be repriced or paused while authorized billing remains active. Cancellation at paid-period end pauses the service plan and future scheduled work when Stripe confirms cancellation. The owner must account for applicable taxes within the presented total and terms; no automatic tax registrations are implied.

Recurring-visit extras are distinct one-time jobs and invoices. They never raise the recurring charge or bill the same recurring visit a second time. Crew submissions require owner price review and customer approval. AI observations remain proposals and never initiate charges.

## Provider gates

Use existing Stripe connected account readiness and homeowner payment enablement. The connected-account signed webhook must include checkout.session.completed, checkout.session.async_payment_succeeded, checkout.session.async_payment_failed, customer.subscription.created/updated/deleted, invoice.paid and invoice.payment_failed. Verify paid, failed, duplicate, cancellation, refund and dispute behavior in a sandbox before treating autopay as fully verified.

SMS supports Vonage and the existing Twilio adapter. MOW_SMS_PROVIDER=vonage selects Vonage explicitly; presence of VONAGE_API_KEY or VONAGE_APPLICATION_ID also selects it. Vonage production sending requires VONAGE_API_KEY, VONAGE_APPLICATION_ID, VONAGE_PRIVATE_KEY (PEM, literal newlines or escaped \n), VONAGE_SIGNATURE_SECRET, and VONAGE_SMS_FROM (approved +1 sending number). Keep secrets in Render. VONAGE_API_SECRET alone is insufficient for the application-scoped JWT path.

Configure Vonage Messages application v1 POST webhooks:
- Inbound: https://mowmatter-property.onrender.com/api/commerce/sms/vonage/inbound
- Status: https://mowmatter-property.onrender.com/api/commerce/sms/vonage/status

Link the approved number to the application, enable signed webhooks and configure carrier/provider STOP and HELP responses. Set VONAGE_REGISTRATION_APPROVED=true only after US sender/campaign approval; VONAGE_WEBHOOKS_VERIFIED=true only after signed inbound/status and provider STOP/HELP tests; MOW_SMS_ENABLED=true after those checks. The health response reports provider/readiness/missing configuration names without exposing values. SMS quote sending preserves optional consent, durable STOP, at-most-one send per quote and customer account approval. Replies YES or START neither authorize work nor restore consent. No real test text was sent during deployment. MMS transport and media UI remain outside this adapter release.

Twilio remains available through MOW_SMS_PROVIDER=twilio with its existing registration, messaging service, credential and exact-webhook-URL requirements. Neither provider's uncertain sends are automatically retried.

Invoice delivery uses the existing Supabase Resend configuration and a five-minute API worker. Company auto_send_invoice and invoice_reminders default off. The current free API host can sleep while idle, so the worker has no guaranteed delivery schedule. A durable scheduler or always-on host remains required for reliable timed delivery. Invoices are due 14 days after issue and reminders are eligible 7/14 days after due; paid, void, canceled and subscription visits are excluded. Provider acceptance is tracked; delivery/bounce reconciliation remains future work. Old manually sent invoices retain their snapshots.

## Validation

119 API tests and the Office suite passed. Rollback-only database checks passed for wrong-customer denial, changed amount rejection, idempotent booking, owner-reviewed reschedule requests, STOP suppression, unchanged authorized monthly pricing and separate/idempotent recurring add-ons. No real payments, SMS or customer emails were sent during verification. Native-phone field use and real provider lifecycle tests remain pending.

See FEATURE-STATUS.md for the wider competitive backlog and US-COMPLIANCE-REVIEW.md for remaining legal/operational review.
