# Deferred SMS and Stripe integrations

SMS delivery and Stripe billing are intentionally disabled for this release. No provider credentials, send calls, checkout sessions, payment retries, or automatic charges are activated.

## SMS hook

Job start/completion already creates a durable homeowner update record alongside the job event. `pending_provider` means integration disabled, not sent. Records without consent or contact stay held. Office and Crew label these records explicitly.

When an API is supplied, connect a server-side delivery adapter to this outbox. Authenticate requests, enforce company ownership and consent, use the notification ID for idempotency, store provider message IDs and delivery results, and handle retries. Do not bulk-send historical records on activation; require an explicit cutoff or selection.

## Stripe hook

Pricing and trial allowance remain planning/eligibility data, not payment authorization. Future Stripe integration must use server-side checkout, signed idempotent webhooks, company-scoped entitlements, and verified payment results. Job completion does not charge a card in this release.

Internal Office/Crew messages, job states, proof photos, and offline sync continue working independently of these integrations.
