# Customer commerce release — 2026-10-11

Customers is the owner entry point for requests, crew proposals, quotes, approved booking/add-ons and recurring payment proposals. The customer account link is business/customer scoped and requires a verified matching email; identifiers are not bearer credentials.

Recurring billing uses a fixed monthly total calculated from the saved per-visit amount and 7/14/28-day cadence. The customer sees the first service date, scope, monthly renewal, cancellation terms and separate-extra notice before an unchecked authorization. Checkout begins billing immediately. The plan cannot be repriced or paused while authorized billing remains active. Cancellation at paid-period end pauses the service plan and future scheduled work when Stripe confirms cancellation. The owner must account for applicable taxes within the presented total and terms; no automatic tax registrations are implied.

Recurring-visit extras are distinct one-time jobs and invoices. They never raise the recurring charge or bill the same recurring visit a second time. Crew submissions require owner price review and customer approval. AI observations remain proposals and never initiate charges.

## Provider gates

Use existing Stripe connected account readiness and homeowner payment enablement. The connected-account signed webhook must include checkout.session.completed, checkout.session.async_payment_succeeded, checkout.session.async_payment_failed, customer.subscription.created/updated/deleted, invoice.paid and invoice.payment_failed. Verify paid, failed, duplicate, cancellation, refund and dispute behavior in a sandbox before treating autopay as fully verified.

SMS is disabled unless MOW_SMS_ENABLED=true, TWILIO_REGISTRATION_APPROVED=true, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_MESSAGING_SERVICE_SID, TWILIO_WEBHOOK_URL and TWILIO_STATUS_WEBHOOK_URL are configured. Set the incoming webhook to /api/commerce/sms/webhook and status callback to /api/commerce/sms/status on the API host; the configured exact public URLs are used for signature verification. Finish Twilio US sender registration, Advanced Opt-Out and consent review before activation. STOP suppression is durable. START does not silently restore consent. Each quote is sent once; uncertain sends require review rather than automatic retry.

Invoice delivery uses the existing Supabase Resend configuration and a five-minute API worker. Company auto_send_invoice and invoice_reminders default off. The current free API host can sleep while idle, so the worker has no guaranteed delivery schedule. A durable scheduler or always-on host remains required for reliable timed delivery. Invoices are due 14 days after issue and reminders are eligible 7/14 days after due; paid, void, canceled and subscription visits are excluded. Provider acceptance is tracked; delivery/bounce reconciliation remains future work. Old manually sent invoices retain their snapshots.

## Validation

119 API tests and the Office suite passed. Rollback-only database checks passed for wrong-customer denial, changed amount rejection, idempotent booking, owner-reviewed reschedule requests, STOP suppression, unchanged authorized monthly pricing and separate/idempotent recurring add-ons. No real payments, SMS or customer emails were sent during verification. Native-phone field use and real provider lifecycle tests remain pending.

See FEATURE-STATUS.md for the wider competitive backlog and US-COMPLIANCE-REVIEW.md for remaining legal/operational review.
