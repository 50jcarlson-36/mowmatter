# Go-live audit — 2026-11-11

Scope: public sites, sign-in, API/Office/Crew hosting, database exposure, payments, email, codebase. Evidence was gathered live through Render, Stripe, Resend and Cloudflare connectors, the desktop browser pane, and local test runs on `main`. Facts below were observed on this date; recheck before relying on them later.

## Verdict

**Software is ready for a soft launch of business accounts and email/Google sign-in.** Infrastructure, security headers, database exposure and billing configuration check out. Not ready: SMS (carrier approval) and live route optimization. **Three owner checks stand between this and "locked down"** (see Owner actions 1–3); none can be done from the connected tools.

## Fixed and deployed today

| Issue | Fix | Release |
| --- | --- | --- |
| Direct Business Login rendered edge to edge with no branding | Standalone card layout; error message scrolls into view | PR #24, Office `dep-dbqggpp42hec73d2i3jg` |
| **Google sign-in from mowmatter.com/early-access never started.** The frame validated the terms box, then sent the user to a top-level login page whose fresh, unticked box made the auto-start refuse ("Agree to the Platform Terms…"). | Frame reports the acceptance it just validated; login honors it only with a mowmatter.com/www referrer, then strips the flag. Regression test `office/login-handoff.test.cjs`. | PR #26, Office `dep-dbqgvpei0phs73cl7olg`, marketing via Workers Builds |
| 2 high-severity advisories in API production deps (undici, zod) | `npm audit fix` → undici 7.30.2, zod 4.6.7; 185/185 API checks | PR #26, API `dep-dbqgvp8n74is73c5pqu0` (live 01:02:51 UTC Nov 12) |
| Crew test suite failed every evening in US time zones | Fixture uses local date like the app | PR #26 |

Live verification after release: served `access.js` and `login.js` contain the fix; a `terms=accepted` link without a mowmatter.com referrer leaves the box unticked and strips the flag; API `/health` ok; early-access frame loads and resizes.

## Passed

- **Public site** (Cloudflare Worker `mowmatter`, current with `main`): 12 sitemap pages + 35 linked pages/assets, zero 4xx/5xx. CSP, HSTS, nosniff, frame DENY, referrer and permissions policies present. Canonicals on indexable pages; legal/utility pages `noindex`.
- **Office**: all 54 deployed files 200; unknown paths 404; CSP self-only scripts; framing limited to apex/www.
- **Crew**: all 18 files 200; framing denied; service worker active.
- **API** (`mowmatter-property`, paid 0.5 CPU/512 MB, always on): health ok. Office and Crew deployed at current source.
- **Database exposure from the internet** (publishable key, read-only probes): schema listing denied (401); all 52 application tables deny anonymous reads (one table name absent live); edge functions Business/Crew return 401 without sign-in; `mm_launch_updates` denied to anon.
- **Auth settings**: Google + email enabled, Facebook off, email confirmation required (`mailer_autoconfirm=false`). Supabase → Google handoff reaches the account chooser with the correct callback.
- **Stripe (live)**: charges and payouts enabled, no requirements due, bank verified; billing config reports checkout, webhooks and Connect onboarding ready; two live webhooks enabled (platform + connected).
- **Email**: Resend domain mowmatter.com verified; recent sends delivered.
- **Codebase**: API 185/185, Office 8 suites + new handoff test, Crew, marketing toasts, drift check, Deno checks (CI) all pass; Office/Crew prod deps 0 vulnerabilities.

## Owner actions (cannot be done from connected tools)

1. **Complete one real Google sign-in** at office.mowmatter.com/login.html (tick terms → Continue with Google → pick account) and confirm you land in Office. This proves the return leg and the Supabase redirect allow-list, which can't be observed without signing in.
2. **Google Cloud Console → OAuth consent screen: confirm Publishing status is "In production"**, not "Testing". In Testing, only listed test users can sign in and everyone else gets blocked by Google. Add app name/logo/support email; users currently see "continue to pzymmsfjgspvzbivzvkx.supabase.co". A Supabase custom auth domain (paid add-on) would show mowmatter instead.
3. **Supabase access for audits**: the Supabase connector is signed into the Outvision org only, and the browser pane is signed out. Grant the connector the MowMatter org (or sign in) so security/performance advisors, backups/PITR and auth redirect URLs can be verified. Backups/restore (prior blocker B2) remain unverified.

## Open items (not blocking a business-account soft launch)

- **SMS**: API reports Bird not ready (`MOW_SMS_ENABLED`, `BIRD_REGISTRATION_APPROVED`, `BIRD_WEBHOOKS_VERIFIED` missing). Keep SMS claims as "being activated".
- **Route optimization provider** not configured; marketing already labels it in development.
- **Homeowner payments never exercised live**: 0 connected accounts. Run one real low-value end-to-end payment + refund with the first onboarded operator.
- **Stripe profile**: support email and support URL are blank (shown on receipts/statements). Two old disabled webhook endpoints can be deleted.
- **Redundant publisher**: Render static `mowmatter` auto-deploys `web/` and is stale (`f2e4f43`); the apex is served by the Cloudflare Worker. Canonicals limit SEO impact; consider disabling auto-deploy or suspending it once the apex origin is confirmed independent.
- **Render logs** returned 503 (log retrieval unavailable) during this audit; recheck API error logs.
- **Traffic signal**: the activity feed reports zero signups/leads in the last 7 days.
