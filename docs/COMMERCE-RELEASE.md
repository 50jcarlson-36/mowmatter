# Customer commerce release — 2026-10-11

Customers is the owner entry point for requests, crew proposals, quotes, approved booking/add-ons and recurring payment proposals. The customer account link is business/customer scoped and requires a verified matching email; identifiers are not bearer credentials.

Recurring billing uses a fixed monthly total calculated from the saved per-visit amount and 7/14/28-day cadence. The customer sees the first service date, scope, monthly renewal, cancellation terms and separate-extra notice before an unchecked authorization. Checkout begins billing immediately. The plan cannot be repriced or paused while authorized billing remains active. Cancellation at paid-period end pauses the service plan and future scheduled work when Stripe confirms cancellation. The owner must account for applicable taxes within the presented total and terms; no automatic tax registrations are implied.

Recurring-visit extras are distinct one-time jobs and invoices. They never raise the recurring charge or bill the same recurring visit a second time. Crew submissions require owner price review and customer approval. AI observations remain proposals and never initiate charges.

## Provider gates

Use existing Stripe connected account readiness and homeowner payment enablement. The connected-account signed webhook must include checkout.session.completed, checkout.session.async_payment_succeeded, checkout.session.async_payment_failed, customer.subscription.created/updated/deleted, invoice.paid and invoice.payment_failed. Verify paid, failed, duplicate, cancellation, refund and dispute behavior in a sandbox before treating autopay as fully verified.

SMS uses Bird only. Both quote offers and arrival/completion notifications require BIRD_API_KEY, BIRD_SMS_FROM (approved US number in E.164 form), BIRD_WORKSPACE_ID and BIRD_WEBHOOK_SECRET. Keep secrets in Render. Provider selection is automatic; MOW_SMS_PROVIDER is no longer used.

Register one signed JSON webhook at https://mowmatter-property.onrender.com/api/commerce/sms/bird/webhook for sms.accepted, sms.sent, sms.delivered, sms.undelivered, sms.failed, sms.rejected, sms.expired, sms.received and sms_suppression.created. Save its signing secret as BIRD_WEBHOOK_SECRET. The SDK checks the raw body signature and timestamp; the handler checks workspace and sender. STOP and status updates are idempotent; late accepted/sent events cannot regress later states.

Configure Bird keyword rules to provide STOP and HELP responses before activation. Set BIRD_REGISTRATION_APPROVED=true only after sender/campaign approval, BIRD_WEBHOOKS_VERIFIED=true only after signed delivery/inbound and STOP/HELP tests, and MOW_SMS_ENABLED=true after those checks. Health reports missing names without secret values. Optional consent and durable STOP remain required; YES/START never approve work or restore consent. Uncertain sends are not retried. Quote sends use the marketing category and visit notices the service category. No real text was sent during automated verification.

Invoice delivery uses the existing Supabase Resend configuration and a five-minute API worker. Company auto_send_invoice and invoice_reminders default off. The current free API host can sleep while idle, so the worker has no guaranteed delivery schedule. A durable scheduler or always-on host remains required for reliable timed delivery. Invoices are due 14 days after issue and reminders are eligible 7/14 days after due; paid, void, canceled and subscription visits are excluded. Provider acceptance is tracked; delivery/bounce reconciliation remains future work. Old manually sent invoices retain their snapshots.

## Validation

119 API tests and the Office suite passed. Rollback-only database checks passed for wrong-customer denial, changed amount rejection, idempotent booking, owner-reviewed reschedule requests, STOP suppression, unchanged authorized monthly pricing and separate/idempotent recurring add-ons. No real payments, SMS or customer emails were sent during verification. Native-phone field use and real provider lifecycle tests remain pending.

See FEATURE-STATUS.md for the wider competitive backlog and US-COMPLIANCE-REVIEW.md for remaining legal/operational review.

## Monday visit messaging and private photos

- Bird only for arrival/completion status delivery. Crew confirms location prompt or manual check-in/start; departing prompts completion review. GPS never sends automatically.
- Crew transition calls the authenticated API after the event is saved. Arrival is deduplicated across check-in/start; completion once per visit. Events older than 15 minutes are not replayed.
- Separate unchecked customer opt-ins: status texts and optional additional-service offers. STOP suppresses both across businesses for that phone. Signup/email notification consent is not reused as SMS consent.
- Customers sign in with their matching verified email to view visit photos. API checks business, customer, visit and private storage path for each image; storage stays private.
- Upgrade offer text links to explicit approval of scope/price/terms. SMS replies alone cannot approve or charge.
- API service must be always on for prompt notifications. A sleeping free Render service can exceed the transition's 20-second SMS call timeout. Visits remain saved; uncertain sends need owner review rather than automatic retransmission. Failed delivery/status SMS retry UI is not implemented.
- Activation requires the Bird credentials and gates described above. The shared Bird webhook handles both quote and visit delivery.
- No real SMS was sent during automated verification. Owner reviews a crew suggestion, sets price and sends the approval link; sending offers is not automatic.
