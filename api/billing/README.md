# Mow Matter payments

Software subscriptions: Starter $0, Growth $49/month, Scale $129/month. Customer application fees: Starter 350 basis points, Growth 250, Scale 150. Stripe processing fees are separate and billed to the connected merchant. Rates come from server-confirmed paid subscription state; unpaid/inactive subscriptions fall back to Starter. Existing checkout links retain their recorded rate.

Accounts v2: full Stripe Dashboard, merchant + customer configurations, Stripe fee collection and negative balance liability. Each operator supplies identity, business, bank information and Stripe agreement acceptance in Stripe onboarding. Customer funds settle in that merchant's Stripe balance; Stripe schedules bank payouts. The platform does not manually transfer proceeds or store card/bank numbers.

## Render configuration

Existing aliases `stripe_live_secret_key` and `supabase_api_secret_key` are supported. The database key must be a server secret/service role key. Never expose these keys to Office or marketing builds.

Required: `STRIPE_WEBHOOK_SECRET` for `/api/billing/webhook`; `STRIPE_CONNECT_WEBHOOK_SECRET` for `/api/billing/connect/webhook`; `STRIPE_CONNECT_ENABLED=true` only after platform Connect activation and Accounts v2 availability are confirmed. Account-specific setup must be completed in the MowMatter Stripe account. Secrets belong in Render, never git or chat.

Build `npm ci && npm test`; start `node server.mjs`. Apply `schema.sql` and `connect-schema.sql` to the selected Supabase project. Billing tables and RPCs are server-only, RLS enabled, public execution revoked.

Connect webhook destination receives Checkout completion/asynchronous payment events from connected accounts. Server retrieves current Checkout state on the event's account and only changes matching company's saved payment records. Other refund/dispute/payout events are acknowledged; accounting retrieves their live Stripe state. Processing requires both active Accounts v2 card payment capability and active bank payout capability. Return pages do not fulfill payments.

Billing: paid plans use Checkout with `customer_account` and signed lifecycle webhooks. Portal permits invoice history, payment methods, period-end cancellation and plan changes. Existing v1 billing customers are blocked for manual migration rather than silently creating duplicate subscriptions.

Accounting: last 50 transactions, last 20 payouts, available/pending Stripe balances, actual subscription and applicable fee. Manual cash records remain separate. Completed, uncanceled jobs with positive server-stored prices support secure, idempotent one-time customer checkout links. Operator shares the link directly; no automatic email or SMS is sent.

## Remaining launch validation

Confirm platform activation, signing secrets and sandbox end-to-end flow (onboard operator, subscription purchase/upgrade/cancel, completed-job payment, async failure, refund, dispute, bank payout). No real money should be charged as a test. Configure applicable tax registrations and collection before representing tax as included.

Recurring homeowner billing and off-session charge-on-completion mandates are not enabled by this release. Do not market them as live. Recurring service schedules remain operational projections. Refund/dispute management and bank settings are available through the operator's Stripe Dashboard; embedded notification banner/account management and full paginated accounting exports are follow-up work.


## Payment activity and mobile website release checks

Connect refunds, disputes and payouts are persisted in mow_payment_activity, keyed by Stripe event ID. The handler derives company ownership from the connected account, stores only payment metadata, and returns a retryable error if persistence fails. Office Accounting displays the latest 25 records, including action-needed dispute and payout-failure alerts. Current transactions and balances continue to come from Stripe. This does not send email alerts or alter refunds.

Crew is a responsive mobile website/PWA, not a native iOS or Android app. Test it in Safari and Chrome mobile browsers. Location prompts work in the foreground; browser suspension cannot guarantee background GPS. Real-phone checks are still required for screen locking, camera capture, cellular uploads, and session recovery.

Business postal address confirmed October 7, 2026: 30 N Gould St Ste R, Sheridan, WY 82801.

Render static-site headers on Marketing, Office and Crew: Strict-Transport-Security max-age=31536000 and Content-Security-Policy with self-hosted scripts, approved first-party/Supabase/API origins, no objects, no framing, and HTTPS upgrades. API responses also send HSTS and a default-src none CSP.

Outstanding launch gates: enable Supabase leaked-password protection if the organization plan supports it; finish authenticated owner/crew integration tests and real-phone browser tests; validate subscriptions, homeowner payment, refund and payout end to end in a separate Stripe sandbox before paid launch. Public inquiry and directory flows do not guarantee provider availability; instant quoting remains disabled until the quoting product is implemented and approved.
