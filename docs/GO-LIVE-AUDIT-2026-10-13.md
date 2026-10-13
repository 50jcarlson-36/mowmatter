# MowMatter go-live code audit — 2026-10-13

Scope: the whole repository at `3f5edbe` (API, Office, Crew, marketing, Supabase SQL and edge functions, CI/deploy config). I also ran read-only checks against the live Supabase project (`pzymmsfjgspvzbivzvkx`). I could not reach the public sites, Render, Stripe, Resend or Vonage from the audit environment, because its network policy blocked them. Those items are listed as **unverified**, not as passing.

## Verdict

**Not ready for a full commercial go-live yet. The code itself is in good shape.** The application and database security model is sound, and I found no critical vulnerabilities. The blockers are operational: no verified live payment, a database schema that can't be rebuilt from the repo, unverified deployed versions, and hosting that suspends background work. Fix the four blockers and the two medium code items below, then run the end-to-end checks in the last section.

## What passed

| Check | Result |
| --- | --- |
| `cd api && npm ci && npm run check` (drift, source, format, tests) | Pass: 131/131 tests |
| `npm audit --omit=dev` | 0 vulnerabilities |
| Secret scan (Stripe, Supabase secret/JWT, webhook, Resend, OpenAI and private keys) | No secrets committed. The only key in the code is the Supabase publishable key, which is meant to be public |
| SQL function grants | Every `create function` has a matching `revoke … from public,anon,authenticated` |
| **Live DB**: anon/authenticated privileges on `mow*` tables/functions | None. All access goes through `service_role` |
| **Live DB**: Supabase security advisors | Only INFO "RLS enabled, no policy" notices (44 tables). That is the intended deny-all design |
| **Live DB**: storage | `mow-crew-proof` is private. `mow-business-logos` is public, as intended |
| Stripe webhooks | Signatures verified, `livemode` enforced, connected-account mapping checked, amount/job/currency cross-checked against stored checkout |
| Payment amounts | Always taken from the server (invoice snapshot or job price), never from the browser. Claims and idempotency keys prevent duplicate sessions |
| Vonage webhooks | Signed JWT, `api_key` claim, 5-minute `iat` window, payload SHA-256 hash check. STOP keywords handled. Replies never authorize work |
| Tenant isolation in API/edge functions | Owner and crew checks against `mow_crew_members`. Customer access requires a verified email matching the company's customer record. UUIDs validated before going into PostgREST filters |
| Front-end XSS | Office, Crew and marketing templates consistently use `esc()`. No unescaped user fields found |
| AI usage | Fails closed: needs the enable flag, key, model and a daily spend limit (1–1000), uses an atomic reservation, and caps output tokens |
| SMS sending | Gated by provider credentials plus `MOW_SMS_ENABLED`, `VONAGE_REGISTRATION_APPROVED` and `VONAGE_WEBHOOKS_VERIFIED`. Uncertain sends are never retried automatically |

## Go-live blockers

**B1 — No verified end-to-end payment.** The production readiness flags are true, but no real Connect charge, payout, subscription lifecycle or webhook delivery has been observed (see contract, 2026-10-11 15:25). Before taking customer money, run one low-value live charge through a test operator: checkout → `checkout.session.completed` on the Connect webhook → invoice shows paid → refund → `charge.refunded` recorded → payout appears in Financials. Repeat once for a Growth subscription (subscribe, renew or simulate an invoice, cancel at period end).

**B2 — The database can't be rebuilt from the repo.** Live migration history has 17 versions (`20261004222330` … `20261011025922`). The repo has only 3 migration files, and `20261010144631_yard_weather_operations.sql` isn't in the live history at all. Most schema lives in loose `*.sql` files. Tables and functions used in production are never created in the repo: `mowmatter_leads`, `mowmatter_homeowner_requests`, `mowmatter_directory_listings`, `mowmatter_featured_placements`, `mowmatter_funnel_events`, `mowmatter_request_limits` and `mowmatter_rate_limit()`. Fix: run `supabase db pull` (or a schema dump) into `supabase/migrations/`, reconcile the history, and make sure a fresh project can be built from the repo. Also confirm point-in-time recovery or backups are enabled on the plan.

**B3 — Deployed versions aren't verified, and the deploy paths compete.** The `Deploy MowMatter` GitHub Action fails on every push to `main` because `CLOUDFLARE_API_TOKEN` is missing, so `main` always shows a red check. Meanwhile Cloudflare Workers Builds publishes the marketing site separately. Render API/Office/Crew are manual deploys, so production may not match `main`. Fix: either add the secret or delete `deploy.yml` and keep Workers Builds (pick one). Then deploy API, Office and Crew from the same commit and record those commit IDs in the contract.

**B4 — The API runs on a Render free instance.** The free instance sleeps when idle. That stops `startInvoiceWorker` (invoice delivery and reminders every 5 minutes) and the route-notice worker. Cold starts also delay Stripe/Vonage webhooks and Office requests. Fix: move to an always-on instance, or move the workers to a scheduler (Supabase cron or Render cron) before advertising automatic invoices or reminders.

## Code findings

| # | Severity | Finding | Location | Fix |
| --- | --- | --- | --- | --- |
| C1 | Medium | Third-party preview origins (`*.steelfurymx.chatgpt.site`) are trusted for CORS on the production API and on 3 edge functions. `mowmatter-capture` even uses one as its fallback `Access-Control-Allow-Origin` | `api/server.mjs:15`, `crew/supabase/functions/mowmatter-crew/index.ts:3`, `crew/supabase/functions/mowmatter-business/index.ts:6`, `supabase/functions/mowmatter-capture/index.ts:1,5` | Remove these origins (use `ALLOWED_ORIGINS` for temporary previews), then redeploy the API and the 3 functions |
| C2 | Medium | Hard-coded default city `Palm Coast, FL` for every customer and job without a city: DB column defaults, the `mow_office_action` insert, the crew `create_job` fallback, and prefilled Office forms. Non-Florida operators will get wrong addresses on invoices and job records | `crew/supabase/office-schema.sql:5,72`, `crew/supabase/crew-schema.sql:3`, `crew/supabase/functions/mowmatter-crew/index.ts:13`, `office/dist/office-live.js:53`, `office/dist/office-crew.js:8` | Make city required with no default, or default to the company's business address |
| C3 | Medium | The marketing site sends no security headers: there's no `web/dist/_headers`, so no CSP, `X-Frame-Options`/`frame-ancestors`, `Referrer-Policy` or HSTS. I couldn't check headers on Office/Crew, which hold Supabase sessions | `web/dist/` and the Render static-site settings | Add `_headers` (Cloudflare) and Render response headers. At minimum add `frame-ancestors 'none'`, `X-Content-Type-Options`, `Referrer-Policy` and HSTS. Add a CSP on Office/Crew |
| C4 | Low | Edge functions return raw Postgres/PostgREST error text to clients (`throw Error(r.error.message)` → `400 {error}`), which exposes schema details | `mowmatter-crew`, `mowmatter-business`, `mowmatter-growth` catch blocks | Log details server-side and return generic messages, except for validation errors you raise deliberately |
| C5 | Low | The public form rate limit hashes the first `x-forwarded-for` value. If the gateway passes a client-supplied header, spammers can rotate it and get past the 10/hour lead limit | `supabase/functions/mowmatter-capture/index.ts` (rate-limit key) | Prefer the platform-verified client IP (check which header Supabase guarantees). Consider adding Turnstile to the lead and homeowner forms |
| C6 | Low | `/api/billing/invoice-status` calls `connected(a)` twice, which means two Stripe `accounts.retrieve` calls on every customer page load, uncached | `api/billing/billing.mjs` (invoice-status branch) | Call it once and reuse the result. A short cache would also help |
| C7 | Low | If an owner doesn't send `company_id`, billing `owner()` silently picks their first owner membership. Owners with several businesses could act on the wrong one | `api/billing/billing.mjs` `owner()` | Require a valid UUID `company_id` on owner billing routes |
| C8 | Low | An owner can mark an invoice `void`/`paid_external` while a 30-minute Stripe Checkout session for it is still open, so the customer could pay a voided invoice | `mowmatter-business` `settlement` action | Expire the open Checkout session (`checkout.sessions.expire`) when settling or voiding |
| C9 | Low | `mowmatter-capture` directory search: a non-numeric `zip` sent together with coordinates still goes into a PostgREST `cs.{…}` filter (at most 5 characters) | `supabase/functions/mowmatter-capture/index.ts` directory branch | Only use `zip` when it matches `^[0-9]{5}$` |
| C10 | Info | `mow_dispatch_routes`/`mow_route_notices` aren't in production (I confirmed live), so the route-notice code must stay disabled | `api/commerce/route-notices.sql` | Keep `MOW_ROUTE_NOTICES_ENABLED` unset until the migration is applied (see `docs/customer-progress-dispatch.md`) |
| C11 | Info | Marketing pages are duplicated at the repo root and in `web/dist`. They're protected by the drift check, but this doubles the edit surface | repo root | Retire the root copies once nothing serves them |

## Unverified (verify before announcing go-live)

- Public `https://mowmatter.com`, `www`, Office and Crew: status, served asset versions and headers.
- Render: deployed commit for API/Office/Crew, instance plan, and environment variables (`STRIPE_*`, `SUPABASE_SECRET_KEY`, `RESEND_API_KEY`, `MOW_*` flags).
- Stripe: webhook endpoints registered for both `/api/billing/webhook` and `/api/billing/connect/webhook` with the listed events, the portal configuration `bpc_1UNdtv1fvEozmSlD6FhdOwa1`, and the plan prices.
- Resend: `mowmatter.com` sending domain verified (SPF/DKIM/DMARC) for `noreply@mowmatter.com`, and Supabase Auth SMTP and email templates.
- Google/Facebook OAuth redirect URLs for the production domains.
- Supabase Auth settings: email confirmation required, and secure email change on. Customer access depends on a verified email matching the customer record.
- Whether the deployed edge function source matches the repo. The deployed versions are capture v10, crew v8, activity v1, growth v2, business v3 and invoice-delivery v1. All have `verify_jwt=false` and do their own auth checks.

## End-to-end go-live checklist

1. Owner signup → email confirm → create business → add customer (with a non-Florida address) → create job → assign crew.
2. Crew on a phone: check in, start, upload a photo, complete. Then retry offline on a weak signal.
3. Office: generate an invoice → send email → the customer receives it and the link opens the portal.
4. Customer: sign in with the matching verified email → see the invoice and photos → pay (B1) → status shows paid.
5. Owner: Financials shows the charge, platform fee, payout. Refund → activity recorded.
6. Growth plan checkout → subscription active → Manage billing portal → cancel at period end.
7. Cross-tenant check: a second owner account can't read the first company's customers, invoices, photos or offers, even when passing the first company's IDs.
8. Legal pages, privacy/cookie controls, unsubscribe and opt-out forms submit successfully.
