# Go-live audit fixes — 2026-10-13

Source review: `GO-LIVE-AUDIT-2026-10-13.md` on `claude/mowmatter-code-audit-yzacsy`, based on main `3f5edbe`. This change is prepared separately from the unfinished Bird SMS migration and the unmerged payment-recovery PR #4. It does not supersede that payment-recovery work.

## Changes

| Finding | Repository result | Production requirement |
| --- | --- | --- |
| C1 | Removed all hard-coded third-party preview origins from API, Crew, Business and Capture; Capture no longer grants a preview fallback origin. API temporary previews must be explicitly configured through ALLOWED_ORIGINS. | Deploy API and all changed edge functions. |
| C2 | New/edited customer and visit records require an explicit city. Removed Florida defaults from SQL, edge inserts and Office forms; migration replaces the live Office function and installs validation triggers. | Apply migration first. Existing addresses are preserved; audit their accuracy with each operator. |
| C3 | Cloudflare `_headers` plus an import-only Render response-header blueprint; restrictive CSP, anti-framing, nosniff, referrer and HSTS policies. Exact hashes permit existing inline scripts. Office framing allows only apex/www to preserve Business Login. | Apply headers to existing Render services; verify actual responses, OAuth redirects, uploads and login iframe. Render does not read `_headers` automatically. |
| C4 | Database errors are logged server-side; Crew, Business and Growth respond with generic text. Deliberate application validation messages remain readable. | Deploy three functions. |
| C5 | Added a server-owned hourly site-wide budget before the supplemental forwarded-IP limiter; header rotation cannot bypass the aggregate budget. Defaults: submissions 600, directory 6,000, events 12,000/hour; configurable via MOW_CAPTURE_{SUBMISSION,DIRECTORY,EVENT}_HOURLY_LIMIT (1–100,000). | Deploy Capture and tune aggregate budgets. Verified per-client IP provenance/CAPTCHA remains outstanding; a global budget can be exhausted by an attacker and is not individual-client identity. |
| C6 | Invoice-status reuses one connected-account lookup per request. | Deploy API. |
| C7 | Owner billing requires a valid explicit company UUID and filters membership by that company. | Deploy API; all current Office calls already send company_id. |
| C8 | Database triggers serialize checkout creation and settlement for a visit. Pending/paid attempts, including attempts lacking a saved session ID, prevent void/paid_external settlement. Edge settlement uses an owner-authorized RPC. This is a conservative guard rather than automatic Stripe expiration. | Apply migration before Business deployment. Reconcile or safely expire uncertain Stripe attempts before settling; never manually mark them failed merely because a lease elapsed. |
| C9 | Directory search uses a ZIP only when the complete input is exactly five digits. Coordinates remain valid when ZIP input is malformed. | Deploy Capture. |
| C10 | Route sending remains disabled by default; no activation flag changed. | Route migration, sender/callback/consent verification and an authorized test route are still required. |
| C11 | Existing root mirrors retained, with the drift gate. | Retire only after all serving/build references are verified. |

The Office build now preserves dispatch-board assets. Its DOM harness loads the real dispatch script. Crew's broken references to missing build/server-test files are replaced with asset verification and the existing actual suites. CI now also runs Office/Crew suites/builds and four edge-function checks.

## Operational blockers

| Blocker | Work completed | Still required |
| --- | --- | --- |
| B1: live payments | Billing regressions cover scope and connection lookup; no charge or live-payment activation. | Authorized live/sandbox provider checks, webhook delivery, invoice state, refund, payout and subscription lifecycle. PR #4 remains separate and should be reviewed before commercial payment activation. |
| B2: schema recovery | Read-only recovery of all 17 original migration records; captured 44 public application tables, 42 functions, indexes/constraints and four triggers into a data-free restore snapshot. | Full PostGIS/Supabase restore rehearsal, managed storage/auth setup, official baseline migration, history reconciliation and backup/PITR verification. See supabase/baseline/README.md. |
| B3: competing publishers/versions | Removed failing duplicate GitHub deploy.yml; retain existing Cloudflare Workers Builds. No publisher settings changed. | Deploy API/Office/Crew from one approved SHA; record dashboard commits and check served asset versions. |
| B4: sleeping workers | Documented the worker activation dependency. No billable plan or scheduler changed. | Select an always-on API/worker service or an independently scheduled durable worker; verify invoice and route ticks during HTTP inactivity. A repo edit cannot upgrade the existing Render instance. |

## Validation

- Production Node 22: full API check, 144 tests passed, including HTTP owner-billing checks, transpiled edge-function behavior and real PostgreSQL settlement/city/grant tests.
- Office: complete DOM/auth/billing/privacy/branding suites and eight-page build passed.
- Crew: field/offline DOM suite, four email tests and source-asset build verification passed.
- Deno: all four edited edge functions type-check.
- Header generation, asset drift, syntax, formatting and whitespace checks passed.
- No deployment command, remote migration, payment, customer email/SMS, route activation, DNS change or hosting upgrade was performed. GitHub-integrated preview builds can run automatically when the PR branch is pushed.

## Release order

1. Review this PR alongside payment-recovery PR #4 and the separately evolving Bird provider work; resolve overlaps and run checks on the combined release commit.
2. Complete B2 restore/history review, then apply only verified pending schema changes. Apply hardening before deploying the new Business settlement RPC caller.
3. Apply Render response headers, arrange always-on worker/scheduler capacity, and deploy API/Office/Crew plus edited edge functions from the same approved source.
4. Verify public responses, login iframe, OAuth, private photo upload and non-Florida signup flow; record deployed SHAs.
5. Complete provider payment verification and opted-in SMS tests. Leave route messages disabled until their schema and active provider are verified.

Launch-day browser verification found the embedded Business Login blocked by a live Office frame-ancestors none response. An always-visible direct login fallback is added to early-access; 144 API tests pass. The deployed header still needs correction. See the operations contract for Bird/carrier and live-database results.
