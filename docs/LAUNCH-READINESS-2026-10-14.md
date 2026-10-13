# October 14 launch readiness

Decision: conditional readiness for core web onboarding. Unrestricted launch advertising is not cleared until a real new-user signup is completed. This targeted release audit is not a penetration test, load test or certification of every workflow.

## Before advertising

- Complete personal-Gmail Google signup, verify return destination and correct company/customer access, sign out/in, and test password recovery for an email/password account. Google is enabled; all five handoffs pass and no hosted-domain restriction exists. Real consent completion and Google Console audience/publishing remain unverified. Company email is not required.
- SMS remains disabled: production reports missing enablement, carrier approval and webhook verification flags. Do not promise live texts until approved and delivery/STOP/HELP verified.
- Operators must finish Stripe identity/bank onboarding before receiving homeowner payments. No connected operator accounts exist. Billing configuration and prior sandbox payment/refund/subscription tests do not prove bank payout readiness.
- Keep current qualifications for unreleased instant quotes/native apps and unverified photo-AI results.

Facebook is disabled in Supabase, explaining its absence. Disabled buttons are hidden. Meta credentials, callbacks and public app eligibility were not observable; no provider settings changed.

## Verified

- All 51 application tables have RLS and deny direct anon/authenticated table access. The 51 informational no-policy advisories reflect intentional backend-mediated access. Only browser-executable mow/mm function found: authenticated-only invoker mm_launch_updates. No warning/error security advisors.
- Crew proof storage private, 5 MB image limit; business logos intentionally public, 2 MB image limit.
- 59 public HTML/assets returned 200, matched release bytes and included CSP/HSTS. No missing local HTML resources. Targeted public-source secret scan found no matching secret-key prefixes/private keys; not an exhaustive history scan.
- Anonymous API operations/settings and billing/status returned 401. Crew, Business, Growth and invoice-delivery Edge requests returned 401. Forged Stripe webhook returned 400; unsigned Bird webhook 403.
- API health/billing configuration returned 200; billing verification and checkout configured. Quoting add-on disabled. No pending webhook inbox entries.
- Deployed API runtime source matches main; 21 migration versions match production. All inspected Edge source matches except corrected Crew invoice dependency.

## Fixes

- Crew completion emails used a fragment and bundled an older invoice model. Switched to canonical mobile email wrapper; redeploy current dependency. Regression covers viewport, amount, account link and absence of old table layout.
- Synced root stylesheet with canonical web/dist and added it to drift checks.
- Moved unused office/dist/office-crew.js to office/legacy, removing obsolete signup code from public deployment. Larger auth consolidation deferred.

## Validation and limitations

Final API check suite, source/security-header/drift gates, formatting and all 164 tests passed; email suite passes 5/5. Office/Crew suites/builds and marketing activity-toast tests/build passed. GitHub quality and Cloudflare Workers Builds succeeded for release 1446613c2b1f569af825935522b4c5d7325533f0. Crew Edge v11 is ACTIVE; all six deployed files match source and anonymous access still returns 401. Office deployment verification is recorded in the operations contract.

API production dependency audit: zero vulnerabilities. Marketing development tooling: seven existing findings (two moderate, five high), requiring scheduled remediation. No risky forced dependency upgrades tonight.

Earlier same-day local layout audit: 47 pages plus invoice dialogs at 320/390/768/1440 widths, 192 checks with no final horizontal overflow. Five Google handoffs checked locally and live. Physical iPhone Safari, real email-client rendering and full third-party consent are not certified.

Performance advisors: 24 unindexed foreign keys, 16 unused indexes, one auth connection-setting information item. Review workload before changing indexes. Historical 24-hour Postgres logs included four undefined-column errors and two transaction warnings of unestablished origin; not certified error-free.

Earlier same-day backup evidence: daily database snapshot October 13 08:16 UTC; no PITR or Storage object-byte coverage. Schema restore regression exists; full production disaster recovery not rehearsed. Confirm recovery requirements and separate object backups.

No customer communications, real charges, customer-record changes or provider policy changes performed. SMS/Facebook remain disabled. No API runtime redeployment needed.

## Final release evidence

Office cleared-cache deployment dep-db7bqulg1s2s739tvt40 is live at release 1446613c2b1f569af825935522b4c5d7325533f0. Retired script returns 404 and public login HTML matches source. Crew Edge v11 matches all six release files. GitHub quality and marketing build succeeded. Remaining external launch conditions above are unchanged.
