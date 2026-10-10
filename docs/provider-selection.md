# Providers and activation — October 10, 2026

## Recommended launch choices

| Function | Provider | Decision |
|---|---|---|
| U.S. hourly forecasts and active alerts | National Weather Service | Primary implementation. No API key or usage charge; use a identifying User-Agent, bounded cache and freshness checks. Live Palm Coast public-location smoke test returned hourly forecast and alert data. |
| Yard observations, possible grass/plant IDs and approved-catalog suggestions | OpenAI vision through configured AI Gateway | Implemented adapter; configure an evaluated vision-capable model with PHOTO_INSIGHTS_MODEL. Model quality needs representative real-yard testing before paid rollout. No universal accuracy claim. |
| Specialist botanical identification | Kindwise plant.id | Recommended optional second opinion. Official entry tier is 1,000 credits at €0.05 each (€50 order); identification plus health assessment consumes separate credits. Not integrated or purchased in this release. |
| Forecast fallback / international growth | Open-Meteo commercial API | Optional next provider. Paid commercial licence required for this business; do not silently fail over to the noncommercial free endpoint. Not integrated or subscribed. |

These are fit-for-purpose recommendations, not a benchmark proving botanical accuracy. Photo observations are tentative, never an automatic diagnosis or treatment prescription.

Sources: https://www.weather.gov/documentation/services-web-api ; https://open-meteo.com/en/pricing ; https://www.kindwise.com/pricing ; https://www.kindwise.com/faq ; https://developers.openai.com/api/docs/guides/images-vision

## Implemented

- Weekly weather board accounts for every scheduled visit, including missing coordinates and unavailable forecasts, without changing the schedule. Authorized private photo thumbnails support owner review.
- Owner-authenticated weather endpoint using stored job coordinates, provider URL allowlist, 5-minute bounded process cache, concurrent request coalescing, freshness checks, forecast guidance and alerts. NWS failures require manual review.
- Company pricing and labor persistence with explicit approval and optimistic revision checks; server quote calculations load saved catalog, not browser prices. API and browser quote engines have a parity test.
- Photo assessment adapter loads only company/job-scoped private crew photos, checks usage entitlement, normalizes images, removes metadata, validates structured findings and stores owner-review results.
- Database credit reservations serialize requests and daily global call caps. Completed duplicate requests reuse the result; failed processing returns the allowance once. Default is no enabled allowance. Provider cost on a failed call can still occur and is covered by the call cap, not charged to a homeowner.
- Owner screen reviews observations, creates a one-time catalog-priced optional offer and links an explicitly selected customer’s confirmed account.
- Homeowner portal shows approved optional offers, records explicit accept/decline without creating a payment or confirmed date. Acceptances appear in owner operations for follow-up.

## Required activation and remaining work

Render API needs the existing Supabase server secret (never a browser key) plus AI_GATEWAY_API_KEY, PHOTO_INSIGHTS_MODEL, PHOTO_INSIGHTS_ENABLED=true and PHOTO_INSIGHTS_DAILY_LIMIT=an integer between 1 and 1000. No provider calls were enabled or purchased by this change. A company’s mow_insight_allowances must be enabled and funded server-side; owners cannot grant themselves credits.

The paid add-on Stripe product, recurring allowance replenishment, trial expiry and purchase webhook are not implemented. Keep assessment activation restricted to an explicitly approved pilot until those are connected and pricing is approved. Suggested economics should be based on measured average/p95 image costs; do not advertise an unlimited assessment plan.

Weather risk display is implemented, but automatic weather rescheduling, travel-matrix routing, alert polling/notifications and grass-growth inference remain separate rollout work. The earlier weekly proposal heuristic remains available but is not live dispatch. Existing Office visit editing can handle owner decisions manually.

Accepted optional work still needs an owner-confirmed visit, capacity check and separate payment flow. No new automatic charges, contract changes, customer notifications or chemical recommendations were activated. First-quote homeowner photo uploads and live visit comparison are future capture flows; this release uses already authorized crew-uploaded photos.

A crashed processing assessment may require support reconciliation. There is intentionally no automatic timeout refund/retry that could race an active model call. Add a lease/reconciliation worker before high-volume rollout.

Production migration was applied using authenticated Supabase SQL, with privilege verification and rollback-only settings tests. The CLI-generated SQL file is an idempotent schema artifact, not evidence that Supabase migration history was registered. Reconcile migration history before a CLI db push.

Deploy Office, Marketing and API at the same reviewed commit; verify authenticated owner/customer sessions and actual model output before marking Photo Insights live. Cloudflare branch builds previously failed, and Render authentication/deployment remains a separate gate.
