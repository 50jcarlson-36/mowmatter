# Mow Matter — Lead Generation & Expansion

Implementation base: production repository `50jcarlson-36/mowmatter`, commit `be04d04`.

## Approved pricing and dashboard alerts

- $5 per new homeowner, capped at $39 per bundle, for either radius. Already unlocked contacts are excluded from charges; zero eligible new contacts cannot be purchased.
- Dashboard shows total demand and new sign-ups within 15 miles of the business ZIP, refreshing every minute while visible. Counts contain no contact details. Scanning marks the area seen; opening the dashboard does not consume the initial incentive.
- Only consenting, unserviced requests from the last 30 days qualify. The latest request per email controls consent and availability; duplicate submissions cannot inflate counts. Paid ownership follows the homeowner email across refreshed requests.
- Signup completion remains available when local demand is zero.

## Delivered

- An authenticated Office Growth route and navigation link, titled Lead Generation & Expansion, with Unlock Nearby Demand.
- ZIP field defaults to the stored business ZIP; radius options are 15 and 25 miles. Scan Area returns real server counts, empty/error states and 50-lead pagination.
- Exact required disclaimer directly below the count/unlock action; responsive controls and cards.
- Private PostGIS geography points and a partial GiST index. ST_DWithin converts miles to meters (1609.344). Distances are ZIP-center estimates, disclosed in the UI.
- Confirmed paid active Growth/Grow or Scale subscriptions unlock current leads without purchase.
- Verified-email owners who complete business registration unlock one initial snapshot at their business ZIP. Later sign-ups are not added to that free snapshot. A scan with zero leads does not consume the incentive.
- Paid packages contain a persisted snapshot. Client-supplied amounts/plans cannot grant access. Purchase entitlement uses a verified Stripe webhook and the saved company, session, amount and currency. Refunds revoke entitlement; delayed payment events cannot undo a refund.
- Existing homeowners are not silently enrolled in sharing. New requests require a separate sharing opt-in and a server availability check. Withdrawn consent or a resolved request removes the lead from results. Ungeocoded requests are excluded until a ZIP center is cached.

## Deployed now

- Supabase project `pzymmsfjgspvzbivzvkx`: idempotent schema in `supabase/growth/schema.sql` applied.
- `mowmatter-growth` Edge Function version 2 active. It verifies the bearer session with Supabase Auth and checks owner membership before any read or write. Gateway JWT verification is disabled because authentication is implemented inside the handler.
- `mowmatter-capture` Edge Function version 8 active, adding server availability checks and consent/location capture.

The production Office UI, marketing consent checkbox and API checkout/webhook changes have not yet been published. GitHub write credentials are unavailable in this session and the GitHub connector is returning tool errors. No Render deployment was performed.

## Validation

- API: 33 tests passed, including existing billing regression checks and new package price/payment checks.
- Office: all four test scripts passed (Office flows, billing UI, Google/Facebook authentication and Growth interactions).
- Supabase: `supabase/growth/verify.sql` passed inside a transaction and rolled back all test users, companies and requests. Checks radius expansion, locked contacts, owner isolation, incentive snapshot, both paid tiers, purchased/incentive access union, amount mismatch, refund revocation, consent withdrawal and private RPC grants.
- Deployed Growth endpoint: missing session returns 401; disallowed origin returns 403.
- Security advisor: no new error or warning findings; INFO notices identify intentional private service-only tables with RLS and no browser policies.
- `git diff --check` passed.

Authenticated browser/mobile visual QA and a real Stripe sandbox purchase/refund have not been performed.

## Finish publication

1. Publish this commit to GitHub and manually deploy the Office, marketing and property API services on Render. Existing deployment guidance is in `RENDER_DEPLOYMENT.md`.
2. Package prices are calculated in the database: $5 per newly unlocked homeowner, capped at $39 per bundle. There is no pricing environment variable. The API independently validates the saved price before creating Checkout.
3. Ensure the platform Stripe webhook endpoint `/api/billing/webhook` includes `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed` and `charge.refunded`, preserving all existing subscription events.
4. Run the full authenticated Growth flow for a Free, completed-onboarding, Growth and Scale owner, plus a crew account (denied). Check 375px/mobile layouts and 200% text size.
5. Complete a sandbox one-off purchase and refund through the signed webhook before enabling live package sales. Confirm that a return URL alone never unlocks contacts.

## Operations

New ZIP centers are obtained server-side from Zippopotam.us and cached. If geocoding is unavailable during homeowner capture, the inquiry is saved but omitted from radius counts. Re-running `mow_growth_zip` for that ZIP backfills missing request locations. The cache contains no contact data. The rate limit is 120 Growth requests per owner per hour.

Full onboarding means a confirmed email, an existing business workspace, contact name, phone, business ZIP, at least one offered service and acceptance of the current terms. The initial incentive is permanently scoped to its original saved homeowner IDs, ZIP and selected radius. Paid packages and that incentive are combined in the current scan. Initial snapshot IDs remain available when changing radius; purchased ownership follows deduplicated homeowner email.
