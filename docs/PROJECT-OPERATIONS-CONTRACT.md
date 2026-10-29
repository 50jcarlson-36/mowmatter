# MowMatter project operations contract

Last updated: 2026-10-13, America/New_York.
Purpose: durable technical handoff and source of truth for project identity, deployment, access, decisions and evidence. This is an engineering operating agreement, not a legal services contract.

## Start here
Read this document before asking Joshua Carlson for connection details or making deployment changes. Reuse recorded identifiers. Recheck changing state through available connectors; do not assume a prior browser login persists. Update this document when an observation changes. Facts below have explicit evidence or status, not implied completion.

## Owner and scope
- Owner: Joshua Carlson (Josh).
- Product: MowMatter, a lawn-care operating platform for owners, field crews and homeowners.
- Primary site: https://mowmatter.com
- Office: https://office.mowmatter.com
- Crew: https://crew.mowmatter.com
- Crew is a responsive mobile website, not a released native iOS/Android app.
- Brand: MOW MATTER; “The chemistry of curb appeal.”
- Goal: organized operations, recurring revenue, nearby growth, owner-controlled pricing, estimated business value, weather-assisted planning and reviewed photo insights.
- Business address supplied by owner: 30 N Gould St Ste R, Sheridan, WY 82801. Do not infer a verified legal entity name or jurisdiction from this address.

## Repository and source paths
- GitHub: https://github.com/50jcarlson-36/mowmatter
- Production branch: main.
- Use the GitHub connection belonging to 50jcarlson-36 / 50jcarlson@gmail.com, not the unrelated ghostUX connection.
- This session's connector link ID: link_6a70e13e107c81918e45eed2eef101db. Rediscover if the tool no longer lists it.
- Public marketing source: web/dist.
- Legacy marketing copies also exist at repository root. Keep corresponding edited files identical while this layout remains in use.
- Office static assets: office/dist.
- Crew static assets: crew/dist.
- Backend: api.
- Database changes: supabase.
- Do not put server code, private customer photos, environment files or credentials in the public assets directory.

## Cloudflare — confirmed identities and routing finding
- Account ID: 59ec48a67d3ebcbf997d47c9e520b0f9.
- Worker name: mowmatter.
- Worker URL, confirmed by owner screenshot: https://mowmatter.50jcarlson.workers.dev
- Owner describes prior manual deployment via Wrangler.
- Cloudflare's existing GitHub-integrated Workers Builds also runs successfully. This is separate from the GitHub Actions workflow added below.
- Critical evidence: owner screenshot received 2026-10-11 12:46 ET shows Production → Domains and routes: workers.dev = mowmatter.50jcarlson.workers.dev; Custom domains = —; Routes = —.
- Superseded by the 13:33 ET screenshot: the Worker now displays route mowmatter.com/*. The earlier missing-route diagnosis is no longer current. Do not repeatedly diagnose a missing GitHub token as the reason the existing Cloudflare builds cannot run.
- Public apex and www previously served old homepage; advantage.css returned 404 after a successful build. The actual apex origin has not yet been identified.
- Next deployment repair: inspect existing zone DNS/Worker routes and the current apex origin, then attach the intended public domain to the correct Worker with a deliberate migration. Preserve Office, Crew, email/MX and API records. Do not blindly replace unrelated DNS.
- Browser dashboard URL: https://dash.cloudflare.com/59ec48a67d3ebcbf997d47c9e520b0f9/workers/services/view/mowmatter/production
- Public-site readiness requires both a successful release AND public domain verification.

## Deployment paths — do not confuse them
1. Existing Cloudflare Workers Builds: observed successful. Uses its existing Cloudflare-side credentials.
2. GitHub Actions: .github/workflows/deploy.yml added on main at abb8a2e7a978a5c6f1c3fbcf5c32caf7a5ec4145. On push to main or manual workflow_dispatch; cloudflare/wrangler-action@v3; Wrangler 4; command deploy --config wrangler.toml.
3. wrangler.toml: name mowmatter; assets.directory ./web/dist; html_handling none; compatibility_date 2026-10-11. Exact apex Worker route added subsequently; see routing repair evidence below.
4. New Actions workflow expects repository secrets CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID. Account value must be the ID above.
5. Verified run https://github.com/50jcarlson-36/mowmatter/actions/runs/38150632301 failed at Check deployment secrets: Missing repository secret CLOUDFLARE_API_TOKEN. Account secret was not independently verified because the first check exited.
6. Missing Actions secrets do not invalidate the existing Cloudflare deployment connection. GitHub connector cannot read/create repository secrets; do not claim otherwise.
7. Choose one automatic production publisher once the intended path is verified; avoid competing builds. Do not disable the working publisher before its replacement succeeds.

## Render
Workspace: MowMatter, team tea-db1qtlks728c73dpaplg.
- API service mowmatter-property: srv-db1ruvmgekts73f6sud0; https://mowmatter-property.onrender.com
- Office static service mowmatter-office: srv-db1rsc7avr4c73da38jg
- Crew static service mowmatter-crew: srv-db1rtiad0e5s73944hpg
- These services were configured for manual deploys when inspected October 10. Reverify if changed; saving an environment setting is not proof that current source is deployed.
- API was observed on a free instance with cold-start delays; no upgrade was performed here.
- API release cc0e1f2bc809ed0ef1ca4e8c7755a7ae5949810e succeeded October 10; Office and Crew release 6d75be79880034954e3a2190aa4085601d607329 succeeded. These are last verified releases, not assertions of current versions.
- API health /health returned 200; unauthenticated POST /api/operations/settings returned 401.
- /operations.html and /services-preview.html on Office returned 200.

## Supabase and service credentials
- Project ref: pzymmsfjgspvzbivzvkx.
- Project URL: https://pzymmsfjgspvzbivzvkx.supabase.co.
- Backend service credentials stay server-side; preserve tenant isolation and RLS.
- Never request credentials in chat or store them in this document, code or public assets.
- Render environment group observed: mowmatter, evg-db1rg3nlk1mc739vnv20.
- OpenAI key name observed in Render: OpenAI_api_key. Backend supports both canonical OPENAI_API_KEY and this alias, canonical first.
- Other photo configuration names: PHOTO_INSIGHTS_ENABLED, PHOTO_INSIGHTS_MODEL, PHOTO_INSIGHTS_DAILY_LIMIT. Presence was verified; values and a successful live analysis were not.
- Stripe names observed: STRIPE_CONNECT_ENABLED, STRIPE_CONNECT_WEBHOOK_SECRET, STRIPE_WEBHOOK_SECRET. Environment group included stripe_live_key, stripe_live_secret_key, supabase_api_key, supabase_api_secret_key, realestate_api. Names alone are not payment-readiness evidence.
- User reports Resend configured. User reports Vonage keys added in Render in another workstream; current delivery and carrier registration need independent verification.
- Google/Facebook login have prior setup work; do not call them end-to-end verified based only on button presence.
- No need to repeat project URLs or ask for already-recorded account IDs.

## Commercial decisions
- Starter subscription $0, up to 10 customers; platform fee 3.5%.
- Growth $49/month, up to 50 customers; platform fee 2.5%.
- Scale $129/month, unlimited customers; platform fee 1.5%.
- Stripe processing is additional. Homeowners pay the lawn company; the operator handles service refunds/disputes.
- Instant Quotes is a separate add-on with a trial. Existing marketing describes proposed $39/month, 25 quotes; 14 days/up to 10 trial quotes; $1 overage only if enabled. Verify billing implementation before treating these as activated products.
- Photo insights optional and chargeable; owner reviews suggestions/prices, homeowner explicitly approves additional work.
- Business valuations are estimates, not verified appraisals, sale-price guarantees or loan approvals.
- Never fabricate customer activity, achieved savings, testimonials or business values as verified social proof.

## Feature limits and release checks
- Photo analysis: private crew job photos, company-scoped access, image normalization, owner review, explicit homeowner choices. Allowance/credit activation and a real provider test remained outstanding in this workstream.
- Weather adapter uses NWS; guidance does not automatically reschedule confirmed customer appointments.
- Earlier automatic job scheduling, native apps, paid add-on activation and loan qualification must not be inferred from mockups.
- Additive migration 20261010144631_yard_weather_operations.sql was applied in prior work; migration history reconciliation remained documented as outstanding before CLI push.
- 90 tests and formatting/drift checks passed for the October 10 release. Newer changes require their own CI result.
- Drift check: api/scripts/check-drift.mjs; canonical shared auth/pricing/insight assets are synchronized. Preserve this gate.
- Do not claim global production readiness from a 200 response or a passing build alone.

## Latest marketing change
- Commit cff256963d59051d5338732c9bc6d1259e38dbe4 adds the MowMatter Advantage and first-customer photo presentation.
- Files: web/dist/index.html, web/dist/advantage.css, web/dist/assets/customer-before.jpg, customer-after.jpg, customer-presentation.jpg; matching root copies.
- Six benefits: estimated business value, nearby growth, cost visibility, route/weather planning, reviewed AI upsells, visible crew work.
- Real photos provided by owner from a testing customer; do not describe them as a proven AI-generated business outcome.
- Original before/after photos remain primary; AI-cleaned presentation is separately labeled and expandable.
- Original files: 20261010_132752.JPG (before), 20261010_151503.JPG (after). Different camera angles.
- Quality check and Cloudflare build succeeded, but the public apex still returned the old page at last check.

## Working agreement for future agents
- Read this contract and current source before asking for repeated setup information.
- Continue authorized development, reversible fixes, repository changes and requested deployment work without repeatedly asking permission.
- Authorization does not grant unavailable tools or bypass mandatory credential/security confirmations.
- Discover installed connectors first. Distinguish GitHub access, Cloudflare's Git integration, API deployment credentials and a browser session.
- Do not promise access to the user's phone/local Chrome. Shared cloud browser is separate; logins may expire.
- If blocked, report the exact failing action, error and minimum missing capability. Do not say “everything is disconnected” when only one path fails.
- Scope changes to MowMatter. Do not alter Outvision or 36seas merely because they share an account.
- Check current main, preserve unrelated changes and use expected-SHA ref updates.
- Record deployed commit, test result, actual public URL and remaining blockers after each release.
- Keep this contract current; it is a durable reference, not a guarantee of perpetual authentication or automatic availability in every unrelated chat.

## Routing repair evidence — 2026-10-11
- Commit 0373657625eb46aeea6a01626c468cdfc78fb827 added only the exact route mowmatter.com/* with zone_name mowmatter.com to root wrangler.toml. No DNS records were changed.
- Cloudflare Workers Build 20df687a-bab1-4639-a502-63cf21c60c80 completed successfully; reported Worker version 748c47bc-9132-4ea4-a60c-d9a864b0d84a. Quality CI passed.
- After the successful build, a cache-busted apex request still returned the old 5,202-byte homepage; cache-busted advantage.css returned 404. Office and Crew returned 200.
- This is NOT a verified live routing repair. A successful build did not establish public route activation. The reason remains unverified: inspect Cloudflare build root/config selection, deploy command versus version upload, active deployment and zone routes.
- No direct Cloudflare MCP tool was available in this session. GitHub write access works. The parallel GitHub Actions deploy still fails at its deployment credential check.
- Next dashboard action: review Worker Settings → Domains and routes and Build configuration. If connecting a Custom Domain instead of the configured route, align wrangler.toml after inspecting any existing apex DNS conflict; preserve Office/Crew/mail. Never blindly remove a conflicting record.

## Updated routing evidence — 2026-10-11 13:38 ET
- Owner screenshot confirms route mowmatter.com/* exists on mowmatter.
- Build settings screenshot confirms main branch, root /, no build command and npx wrangler deploy. Root config is the only Wrangler config in main; no competing wrangler.jsonc was found.
- Current main eee4d08a036a1f9a81e3321c631a1c3d7f356e05 passed Cloudflare Workers Builds; version 4907bcd3-2535-4f28-9b39-e29110e790ea.
- Cache-busted public /index.html still serves old content. Response includes rndr-id and last-modified October 11 01:04:37 UTC, evidence traffic still reaches a Render origin. Exact reason for Worker bypass remains unverified.
- Next targeted check: Cloudflare zone DNS for apex record proxy status (Workers routes require proxied DNS), then route conflicts/active deployment if already proxied. Do not change Office/Crew/mail.
- Direct dashboard attempt reached Cloudflare sign-in. No authenticated Cloudflare API connector is exposed in this session. Existing Git-connected builds remain functional; that connection does not provide dashboard/DNS edit access to the agent.

## Apex activation and homepage repair — 2026-10-11 14:09 ET
- Owner screenshot confirms apex CNAME @ -> mowmatter.onrender.com is Proxied. Office/Crew remain DNS only.
- Public advantage.css and original before/after assets now return 200 with expected lengths (2771, 344497, 270802). /index.html serves updated 11165-byte homepage. DNS proxy activation resolved Worker bypass.
- Public / returns 404 because html_handling none disables directory index resolution. Changed root wrangler.toml to auto-trailing-slash to serve index.html at /. Existing .html links redirect to canonical extensionless paths; query strings remain handled by Cloudflare. Verify public root after successful build before calling it complete.

## Public AI Intelligence release — 2026-10-11
- Homepage root repair 451deaa6e1f7fbec58f4f16a5eb1c8bbe4e0bcde passed quality and Workers Builds, version c4a7c5b8-a2ea-444f-8346-68265e5e109e. Public root returned 200 with new advantage content; stylesheet and original yard photographs returned 200.
- Added homepage teaser, AI Intelligence navigation, dedicated ai-intelligence.html and responsive ai-intelligence.css; mirrored root and web/dist copies. Platform page links to the new page.
- Page explains local NWS weather, permission-based job location, original before/after photos, uncertain plant/grass/tree/shrub suggestions, owner-reviewed scheduling and treatment needs, and explicitly approved optional customer upgrades. Does not claim all capabilities are validated live or that mobile browsers track continuously in the background.
- Owner clarified patent filing is planned, not filed. Do not publish Patent pending until filing is confirmed.

## Visual AI Intelligence update — 2026-10-11
- Added native SVG weather/location/camera/plant/calendar/approval icons, illustrative route diagram, original photo montage, and existing Crew/Office previews to the homepage and dedicated AI Intelligence page.
- Added owner/homeowner proposal walkthrough: verify observation, configure scope/labor/pricing, present photo-backed explanation and get explicit approval. Revenue and satisfaction described as intended benefits, not measured outcomes. All diagrams and proposal/interface examples identified as illustrative.
- Responsive layouts stack on mobile. No new provider or operational automation was enabled by this marketing update.

## Annotated before/after presentation — 2026-10-11
- Owner supplied clearer after photo 630602BC-CD2E-49C0-8C6F-6580B600BD8A.jpeg; published unaltered as assets/customer-after-clear.jpg with root/web mirror. Original pixels preserved.
- Added code-native SVG leader lines and numbered hedge/lawn/bed-edge flags over the after image, with an explicit illustrative insights badge and explanatory legend. No live AI analysis or confirmed species/diagnosis claimed.
- Both homepage and intelligence page now show labeled before/after images; mobile stacks the comparison for readable flags. Updated the workflow to show approved care returning to routing, scheduling and management.

## Care profile and example upsells — 2026-10-11
- Added illustrative hedge-shrub profile with species awaiting verification, sample warm/rain weather, owner-configured 6-week review interval, labor/schedule context and +$50/visit hedge-trimming example.
- Added owner/homeowner guidance panels and sample extra bed edging +$20/visit and small-bed mulch refresh +$85/service. All rates/scopes/intervals labeled illustrative, not platform charges or universal care guidance; nothing booked or billed by these static examples.

## Consistent AI-enhanced true after — 2026-10-11
- Owner confirmed D097DE39-8A8B-4155-9C94-9816D012A2D9.jpeg is the true after photograph; byte-identical to prior 630602BC-CD2E-49C0-8C6F-6580B600BD8A.jpeg. Keep genuine before source, no simulated lawn-service result.
- Built-in imagegen produced a presentation enhancement from the confirmed after source. Prompt requested light/color/clarity only and unchanged viewpoint/yard/hedges/grass; generative details can differ, so enhanced images are labeled and unenhanced source remains available.
- Published assets/customer-after-enhanced.jpg and mirrored root copy; used consistently in homepage and AI page comparisons/profiles. SVG insight flags remain separate code overlays. Unenhanced after can be viewed from both pages.

## Connected intelligence graphic — 2026-10-11
- Replaced plain hero context list with branded hub graphic: Mow Matter mark, matching weather/location/photo/calendar SVGs, connecting lines, compact context tiles and route/schedule/customer-history output strip. Responsive two-column tiles retain readable text on mobile. No live telemetry or automation status implied.


## Photo-linked Mow Matter Care Tags — 2026-10-11
- Added branded care-label cards directly beneath the real before/after comparison, matching numbered hedge, lawn and bed-edge annotations.
- Tags include category, unconfirmed species status, code-native care/weather/calendar symbols, expandable instructions and optional service examples (+$50 hedge trimming, +$20 extra bed edging; mowing priced per approved plan).
- Sample intervals and prices clearly labeled; no confirmed botanical identification, live diagnosis, charge or booking implied. Owner verifies care and scope; homeowner approves additional work.
- Cards stack on narrow screens and use semantic headings/details without new JavaScript dependencies.


## AI messaging consolidation — 2026-10-11
- Homepage has one AI teaser/photo comparison; removed duplicate first-customer photo story. Three benefit bullets lead to inline account creation and the dedicated AI page.
- AI page consolidated into hero, three capabilities, one real-photo/Care Tag proof, owner/homeowner guidance, one connected work flow with Office/Crew previews, compact FAQ and final signup CTA.
- Removed repeated photo/profile/service-price sections and redundant capture/review/approve explanations. Retained sample pricing, original-photo access, species uncertainty, pending photo analysis validation and mobile-web location limits.
- Signup CTAs link to existing early-access inline Business Login/account creation; quote and homeowner links provide secondary exploration. No fabricated urgency, live results or new automated operations implied.


## Graphical homepage advantage cards — 2026-10-11
- Replaced six numbered text-only cards with graphic-led benefit cards: conceptual business-value trend, neighboring route, actual $0 Starter subscription details, illustrative weather/week plan, example +$50 care offer and crew photo-record preview.
- Shortened benefit copy, added high-contrast destination CTAs and an account-creation banner. Removed the redundant manual-workflow comparison beneath the cards.
- No illustrative trend/route/weather graphic represents actual customer performance or telemetry. Retained fee disclosures, estimate limits, AI validation status and labeled example/photo enhancement. No new scripts or external image dependencies.


## Marketing messaging audit — 2026-10-11
- Reviewed all 22 top-level marketing/support/legal HTML pages and primary CTA destinations. Internal referenced HTML files exist; no missing relative page destinations found.
- Corrected Platform's stale flat 1.5% fee to Starter 3.5%, Growth 2.5%, Scale 1.5%, plus Stripe processing.
- Aligned homepage business-value hook with the actual revenue-snapshot output; snapshot is not a sale valuation. Added a direct account CTA to the snapshot page.
- Business pages share AI Intelligence navigation and account CTA wording. Crew primary CTA opens the real Crew subdomain; native app roadmap remains separate.
- Removed trial/featured-list enrollment implication from generic account CTAs: current early-access/account page has no specialized interest-list capture. Interest parameters do not constitute signup for these lists. Dedicated enrollment remains future work.
- Clarified separate Yard Insights customer sign-in and provider record linking; no payment or scheduling functionality was tested in this messaging review.
- Pricing pages still contain provisional availability statements; reconcile these with a verified functional launch audit before claiming live billing/automation. Audit covered copy, CTA paths and source consistency, not end-to-end payment, provider or authentication outcomes.


## Production billing readiness verification — 2026-10-11 15:25 ET
- Production GET https://mowmatter-property.onrender.com/api/billing/config with Office Origin returned HTTP 200: checkout_enabled=true, stripe_account_verified=true, database_verified=true, stripe_key_configured=true, webhook_configured=true, database_key_configured=true, connect_onboarding_enabled=true, homeowner_payments_enabled=true, quoting_addon_enabled=false.
- Server plan response: Growth 4900 cents/month, fee 2.5%; Scale 12900 cents/month, fee 1.5%. Source maps Starter fee to 3.5%. Ready checks expected account acct_1UNcR11fvEozmSlD charges_enabled and billing-table access.
- Unauthenticated billing status POST returns HTTP 401 (Sign in to Office). No real charge or subscription was created.
- Updated stale marketing statements claiming checkout/payment collection was inactive. Individual connected operators still need active card-payment and bank-payout capabilities.
- Stripe connector account-list request was rejected in this session; account-specific product/portal/webhook registration and delivery-history reads were not performed. API readiness proves server configuration gates, not a successful charge, subscription change or bank payout; full transaction verification remains pending.
- README contains old statements about recurring payments; current homeowner.mjs implements authorized recurring checkout. Do not treat README as complete evidence of deployed recurring behavior without authenticated validation.


## Homeowner care-option access — 2026-10-11

- Invoice account links lead to the authenticated Office customer-account portal. Its top card and invoice rows now link to care options and the existing extra-service request form.
- Care quotes are prioritized above visit photos. “Add this service” requires explicit approval of scope, price and terms, with provider scheduling and payment confirmed separately.
- Hedge trimming, edging/bed cleanup and seasonal-care shortcuts draft a request; the homeowner must submit it. They do not create a charge, booking or approved quote.
- Published AI offers expose a customer consultation link in Office where a customer ID is available. Authentication and existing customer/company access checks remain required; URL identifiers are not access grants.
- Invoice email delivery template and Supabase deployment are unchanged: its existing Manage your account link reaches these options. No new consultation email or SMS is sent automatically.
- A live authenticated homeowner acceptance, provider response and payment remains an end-to-end verification requirement.


## Published dispatch and homeowner approach notices — 2026-10-11

- Implemented route publishing/order, crew/day and seven-day boards, confirmed single-visit moves with timestamp conflict and basic work-time overlap protection, published-order refresh in Crew, and authenticated customer service status/care navigation.
- Added Vonage approaching (two stops/next), reschedule and cancellation notice worker with atomic claims, restricted invoker functions, signed callback status, separate route SMS opt-in and 8 AM–8 PM business-time-zone window. No automatic retry of uncertain sends.
- Activation is gated by MOW_ROUTE_NOTICES_ENABLED=true on the API after migration/provider validation. Existing arrival/completion flow remains separate and unchanged.
- Supabase read access works. apply_migration twice and execute_sql write returned Invalid or expired requestState; read-back confirmed route tables/functions are absent. Migration is committed in api/commerce/route-notices.sql, but NOT applied to production.
- Existing Office visit list remains available when dispatch schema is unavailable. Marketing includes a graphical communication preview and states that approach/schedule-change SMS are being activated.
- Local Postgres and DOM checks passed for ownership, publication, progress, consent/opt-outs, duplicates, stale/overlap checks, reordering, secure service links and care navigation. No carrier delivery or real customer SMS was sent.
- See docs/customer-progress-dispatch.md for exact activation order and verification limits. Restore Supabase write access; deploy API/Office/Crew together on Render; then enable the flag and verify an opted-in test route.


## Go-live code audit — 2026-10-13

- Full report: docs/GO-LIVE-AUDIT-2026-10-13.md (audited commit 3f5edbe). Verdict: code security model sound; not ready for full commercial go-live until blockers B1–B4 are closed.
- Passed: `npm run check` 131/131 tests; `npm audit --omit=dev` 0 vulnerabilities; no committed secrets; every SQL function revoked from anon/authenticated.
- Live Supabase (read-only): no anon/authenticated privileges on mow* tables/functions; advisors show only INFO RLS-no-policy (intended deny-all); mow-crew-proof private, mow-business-logos public; mow_dispatch_routes/mow_route_notices absent.
- Migration drift confirmed: live history has 17 versions (20261004222330…20261011025922); repo has 3 files and 20261010144631 is not in live history. Several production tables/functions (mowmatter_leads, mowmatter_homeowner_requests, mowmatter_directory_listings, mowmatter_rate_limit, etc.) are not defined in the repo.
- Live edge functions: capture v10, crew v8, activity v1, growth v2, business v3, invoice-delivery v1; all verify_jwt=false with in-function auth.
- Public sites, Render, Stripe, Resend and Vonage were not reachable from the audit environment (network policy 403); their state is unverified by this audit.

## Audit remediation prepared — 2026-10-13

- The audited source lives on claude/mowmatter-code-audit-yzacsy; the earlier local payment-recovery checkout is older and has separate unfinished Bird edits. Remediation is prepared in an isolated workspace.
- See docs/GO-LIVE-AUDIT-FIXES-2026-10-13.md for C1–C11 status and release order. Removed duplicate deploy.yml; existing Cloudflare Workers Builds remains the intended automatic marketing publisher.
- Supabase read access succeeded: recovered all 17 original migration SQL records and captured a data-free public application schema (44 tables, 42 functions, four triggers). This does not reconcile migration history, validate a PostGIS restore, confirm backups or deploy any pending SQL.
- B1–B4 remain commercial launch gates. C5 needs verified gateway IP provenance/CAPTCHA. Route notices remain disabled. No production writes, deployment, live payment or customer communication occurred in this remediation.

## Launch verification — 2026-10-13

- Live API health reports Bird configured but disabled; missing activation flags are MOW_SMS_ENABLED, BIRD_REGISTRATION_APPROVED and BIRD_WEBHOOKS_VERIFIED. No credentials were exposed.
- Bird workspace ws_01m4p5vnn3ecjr6x465fw83r1d matches Mowmatter. Sender +12019088951 (snd_01m4rg70njfg6vxbdt2vz7bdez) is pending_registrations; US requirements report registration_required. Brand brd_01m4rfy4kzfmqvqxwtj623p8ga is approved, but has_campaigns=false and campaign list is empty. Account funding alone does not establish SMS readiness.
- Existing Bird webhook whk_01m4tjc56nfn5t9ppk0qfjh94a at /api/commerce/sms/bird/webhook accepted a signed synthetic sms.delivered test with HTTP 200 (138 ms). This confirms signed reachability, not carrier delivery, real payload persistence or STOP/HELP behavior.
- Marketing works in a real browser. A Python root request received 403, but browser navigation and curl /early-access succeeded; do not report the entire public site down.
- Browser verified embedded Business Login refusal. Live Office header responses differed across cache nodes: one allowed apex/www framing, another returned frame-ancestors none. Added an always-visible direct login fallback to early-access source; live header correction is still required.
- Office and Crew HTTP checks return 200 with CSP/HSTS. Render dashboard requires sign-in, so deployed commit IDs and instance plan remain unverified.
- Live payment config reports checkout/homeowner payments enabled, but no real charge/refund/payout was run. Payment attempts, dispatch routes, route notices and guarded settlement objects are absent in Supabase. PRs #4/#5/#6 remain open; do not equate a deployed Bird adapter with a complete go-live release.

## Campaign execution and live header outcome

- Bird campaign cmp_01m4tqyt9ffe49zsjgwwxjrxyd / TCR CYDJCUX was submitted October 13 at 9:41:44 AM Eastern. Sender +12019088951 is assigned; campaign and carrier linkage remain pending. Read-back reports numbers_linked=true. SMS is not activated and no test/customer text was sent.
- Office CSP correction is live and fresh HTTP responses allow only apex/www framing. Existing authenticated signup navigation reaches the Office dashboard.
- Verified service versions: API 32c10f09368f62346b280722715f8397a7b67b41, Office 7b3e125d78ad5d9757d203ef47b3399fb8b93629, Crew fdb6e70e9f972832f95c346ea51df2f6a76e5037. A combined release is not yet deployed.
- The owner approved the $7/month API upgrade. Render started a compute-change deployment of older main 3f5edbe09b7620c68961c1935147725551206a6e, which lacks Bird; it was canceled (dep-db73b2ss728c73da1d30) before becoming live. The existing Bird commit remains live.
- A specific-commit redeployment of the existing Bird API is prepared but automatic approval review rejected execution because the plan approval did not explicitly authorize production redeployment. Explicit approval has been requested. The always-on upgrade is not yet verified active.

## Approved Bird redeployment and source pin

- Explicit owner authorization received for deployment of 32c10f09368f62346b280722715f8397a7b67b41. Deployment dep-db73d14s728c73da7bh0 succeeded in 46.5 seconds, with Bird retained.
- The canceled compute-change deployment rolled the plan back to Free. Created release/bird-api-32c10f0 at exactly the approved live commit and configured the API source to that branch with auto-deploy still Off; this avoids future compute/environment changes selecting older main without Bird. This is a temporary source pin pending the combined release of PRs #4/#5/#6, not a change to the repository production branch.
- Reapplied the owner-approved $7/month compute selection against the pinned source. Final paid-plan/deployment verification remains in progress.

## Verified upgrade complete — October 13, 9:51 AM Eastern

- API is active on the owner-approved $7/month 0.5 CPU / 512 MB plan. Compute-change deployment dep-db73ece7bikc73a24da0 succeeded in 35.9 seconds at source 32c10f09368f62346b280722715f8397a7b67b41. Render's current compute page confirms the paid option checked. Source is pinned to release/bird-api-32c10f0; auto-deploy remains Off.
- Carrier campaign CYDJCUX remains pending with the sender attached. The human confirmed Bird's registration/payment page; no customer SMS was sent.
- Office CSP repair is live. Full commercial go-live is not claimed: carrier delivery/STOP/HELP checks, payment-recovery/schema release, combined service versions and restore validation remain outstanding.

## Commercial release verification — 2026-10-13 12:15 EDT

- User authorized combining PRs #4/#5/#6, applying validated migrations and deploying, with SMS disabled until Bird approval and real delivery tests. All three PRs are merged through release PR #7. Application release: `66b4fc177fe9c448b4a1c86f5443df55491df95d`.
- API: Render `dep-db75dg3l550s73ar0j6g`, live, 1m09s, $7/month 0.5 CPU/512 MB. Source is main; auto-deploy off. Office: `dep-db75dovf3r2c73d8trrg`, live, 18.6s. Crew: `dep-db75e3rl550s73ar26kg`, live, 12.9s. All three use the application release SHA. Cloudflare production version `4b2538cd`, build `02511d2f-7680-4735-8ac1-9263ce70ae25`, 100% traffic, same SHA. Workers Builds is the sole marketing publisher; competing Actions deployment removed. A missing `[previews]` block caused historical branch build failures and is corrected in this release.
- Public Office/Crew JavaScript and marketing contact/pricing HTML match release bytes. Authenticated Office overview, billing and dispatch load Lawnzai's actual empty workspace without console warnings/errors. Office and Crew response headers now match the generated release policies, including referrer/permissions policies; Crew denies framing, Office permits only apex/www framing.
- Validation: 162/162 API tests; Office/Crew/marketing tests and builds; four Deno checks; GitHub Actions quality run 38427187103 passed; production dependency audit zero vulnerabilities. Marketing development build tools retain 7 advisory findings (2 moderate/5 high); they are not shipped dependencies. Do not use an unreviewed forced Tailwind major upgrade as a release fix.
- Four migrations applied successfully: 20261013155735 payment recovery, 20261013155746 entitlements/crew scope, 20261013155755 hardening, 20261013155801 dispatch. Repository deployable migration versions now match all 21 remote history entries. Original historical SQL recovered verbatim; obsolete unrecorded yard/weather SQL moved outside migrations because replay would overwrite newer entitlement functions.
- Recovery: data-free catalog snapshot restored in official Supabase PostgreSQL 17.6 with PostGIS, then all four release migrations succeeded. All 69 restored application/private function definitions exactly match production (MD5 `ad3e7efd10922bc9650454df6f6e9ceb`). Independent PostgreSQL sessions passed both payment/settlement race orders and owner/city/browser-role boundaries. All 51 application tables retain RLS and deny anon/authenticated table access; backend functions deny browser-role execution. Authenticated launch-preference wrapper retains its intended grant. Security advisors only show intended INFO deny-all RLS/no-policy findings.
- Supabase authenticated dashboard confirms daily physical database backups October 6–13, latest October 13 08:16:46 UTC. PITR is not enabled. No production-data restore drill was run; database backups exclude Storage object bytes. Recover new environments from the reviewed snapshot plus pending migrations, not a blind replay of the historically incomplete original chain.
- Edge functions deployed: capture v11, crew v9, business v4, growth v3. Existing custom in-function authentication retained (`verify_jwt=false`); unauthenticated Crew/Business requests return 401.
- SMS: Bird campaign `cmp_01m4tqyt9ffe49zsjgwwxjrxyd` / TCR `CYDJCUX` remains pending, sender number linked. Production health confirms provider Bird, ready false, route notices false; `MOW_SMS_ENABLED`, `BIRD_REGISTRATION_APPROVED`, `BIRD_WEBHOOKS_VERIFIED` remain false. No actual customer SMS was sent. Unsigned callbacks return 403. Carrier approval, actual delivery callbacks, STOP suppression and HELP behavior must pass before activation; approaching/schedule notices additionally require the documented opted-in route verification.
- Commercial gates still open: a real operator payment -> paid invoice -> refund/dispute record -> payout visibility; a paid-plan subscription lifecycle; controlled real transactional email/invoice delivery; real provider photo-analysis validation if that paid feature is advertised. Quoting add-on/automated usage billing remains disabled. Core non-SMS onboarding can be used; full money-taking launch is not yet certified by this release verification.

## Payment rehearsal findings — 2026-10-13 13:15 EDT

- Stripe prohibits testing real payment details in live mode (https://docs.stripe.com/testing). All payment/refund/subscription exercises used MowMatter's separate sandbox `acct_1UNcRL1pWvl8HGEF`; no real funds moved. Released billing handlers ran locally against restored PostgreSQL/PostgREST with a controlled authentication fixture. This verifies provider behavior and application reconciliation, not new production Auth signup or bank settlement.
- $1 hosted Connect Checkout completed in the sandbox with a 4-cent Starter application fee. Signed Stripe CLI Connect events reached the real handler, returned 200, and persisted paid state. Full $1 refund including the application fee succeeded; signed refund event persisted company-scoped activity. Repeated refund calls returned the same refund ID. The first listener was started before sandbox Connect activation and missed events; restarting resolved forwarding. Authentic missed events were retrieved and locally signed/replayed twice, explicitly a replay test, not original webhook delivery.
- Hosted Growth subscription billed $49 simulated funds; genuine signed checkout/invoice/subscription events granted active paid Growth. Period-end cancellation preserved paid access. Refund succeeded, immediate cancellation persisted canceled/unpaid and feePlan falls back to Starter. This is sandbox lifecycle evidence, not a live customer purchase.
- Production Managed Payments default is enabled; Growth/Scale products lack tax codes. Sandbox reproduced rejected subscription Checkout with that default. New Checkout builders explicitly disable Managed Payments to match the approved standard Stripe model. A fresh patched API Growth checkout succeeded with sandbox default ON and returned managed_payments.enabled=false; it was expired without payment. Existing immutable pending attempts are intentionally not rewritten. Production API deployment of this correction is pending.
- Recovery snapshot omitted the invoice number identity. Restored `GENERATED ALWAYS AS IDENTITY` in the data-free baseline. Independent rollback-only PostgreSQL schema restored that table definition, inserted an invoice without a number, received number 1, and confirmed YES/ALWAYS identity metadata. Production already has the correct identity; no production DDL needed.
- Real production TEST ONLY invoice MM-3 ($1) generated for the owner's own email jcarlson30@gmail.com. Send failed safely with missing RESEND_API_KEY; no delivery row or email was created. Owner reported adding a key, but the next read still showed no custom secrets in this Supabase project. Exact secret field is prepared for human credential entry; email completion and final void remain pending.
- Production has no connected operator account; Lawnzai must finish genuine Stripe onboarding before homeowner payment acceptance. No bank payout or paid photo-provider validation was performed. SMS and route notices remain disabled pending Bird approval and real delivery/STOP/HELP tests.

## Payment and email verification completed — 2026-10-13 13:30 EDT

- Checkout correction PR #9 merged at `1fc8d7660f1a0097da3580002c812e5f7f1d3921`. GitHub quality run 38436729200 passed API (162/162), Office/Crew/marketing tests/builds and four Deno checks. Render API deployment `dep-db76dogn74is739sdqj0` is live at that SHA, completed 13:15:20 EDT. Production health/config remain ready with Bird/SMS and route notices disabled. Frontend assets did not change in this API correction.
- Live Connect endpoint `we_1UNtbd1fvEozmSlDOj45HS68` lacked homeowner recurring subscription/invoice events. Added customer.subscription.created/updated/deleted, invoice.paid and invoice.payment_failed while retaining existing payment/refund/dispute/payout events, URL and signing secret. Stripe API read-back confirms enabled 14-event list. No real payment was created by this configuration repair.
- Additional $1/month homeowner sandbox subscription `sub_1UQ9VG1pWvxCpLh5mf6lbwKc` passed signed Connect invoice/subscription reconciliation (active/paid), period-end cancellation retaining active state, full simulated $1 refund `re_3UQ9VG1pWvxCpLh50kouHKlm`, and final canceled state. This extra lifecycle used Stripe's direct sandbox token API after abandoning the optional wallet UI; the hosted session was expired. Do not label it a completed hosted homeowner subscription Checkout. API checkout preparation itself succeeded with explicit recurring consent and standard billing.
- Read-only sandbox cleanup verification: zero active platform subscriptions, zero active connected subscriptions. Dedicated extra test product archived; test payments refunded. The first missed event replay remains explicitly a locally signed replay, separate from verified genuine forwarding of the fresh payment and recurring lifecycle.
- Owner saved RESEND_API_KEY in Supabase Edge Function secrets after first adding it in Render. Real TEST ONLY invoice MM-3 reached jcarlson30@gmail.com's Gmail Inbox at 17:18:56 UTC (message 1a136464ed423a1b), subject “Invoice MM-3 — Lawnzai”, from noreply@mowmatter.com. Office showed Email accepted; database confirms email_status=sent, settlement_status=void after owner-authorized test cleanup. Manual send stores invoice send status, not a mow_invoice_deliveries provider ID; inbox receipt independently proves delivery. No test balance/reminder is due. Synthetic customer/visit remains explicitly labeled TEST ONLY for audit evidence; no real customer rows changed.
- Remaining launch boundaries: Lawnzai still has no verified connected operator account. The operator must complete real legal/identity/bank onboarding before taking homeowner payments; live payout/settlement is not certified by sandbox tests. Paid photo analysis needs a real provider validation if offered; quoting add-on remains disabled. Bird approval and actual SMS delivery/callback/STOP/HELP tests remain required before enabling SMS; no SMS was sent.


## Approved shared-link artwork — 2026-10-13

- Owner approved the generated “More lawns. Less busywork.” campaign image for the homepage shared-link preview. Added versioned `assets/mowmatter-social-more-lawns-v1.jpg` in canonical `web/dist` and mirrored root assets; JPEG 1200 × 628. Original artwork is conceptual, including the notification illustration, not evidence of SMS activation.
- Homepage now declares canonical URL, Open Graph title/description/image/dimensions/alt text and a Twitter large-image card in initial HTML. Previously the homepage declared neither image, allowing messaging clients to select a yard photo.
- Release uses the existing Cloudflare Workers Builds publisher via main. Verify apex HTML metadata and public JPEG bytes after publication; existing message threads may retain cached previews. No API, Office, Crew, DNS, messaging flags or billing changes.


## Mobile layout corrections — 2026-10-13

- Audited 47 HTML pages plus invoice dialogs at 320, 390, 768 and 1440 CSS pixels (192 local Chromium checks). Final tested states have no page-level horizontal overflow. Synthetic local data; external transactional flows and physical Safari/email clients are not certified. Detailed scope and limits: docs/MOBILE-LAYOUT-AUDIT-2026-10-13.md.
- Corrected invoice/dialog typography and reflow, legacy invoice labels, Accounting summary overflow, customer-account padding, wrapping Office actions and Crew safe-area/touch controls. Email invoices now use the same single-column model plus viewport wrapper. No payment, SMS, customer-record or auth-policy changes.
- Office/Crew tests and builds, branding/model/access tests, source and mirror checks passed. Render browser is signed out; frontend source publication alone is not an Office/Crew production release. Supabase Business and invoice-delivery require matching model deployments with existing custom auth preserved.
- Shared-link artwork from 9f33079 was independently verified live on the apex; both initial HTML and JPEG matched repository bytes, and Cloudflare build/quality checks succeeded.


## Mobile release verified — 2026-10-13 22:10 UTC

- Application release `b0fda19cec3fc03bea3e3ed71f3048b6a51a54cd` passed GitHub quality and Cloudflare Workers Builds.
- Render connection resolved the earlier signed-out-browser blocker. Office deployment `dep-db7ao92vcj2c73ctr1fg` and Crew deployment `dep-db7ao9l9fdbs73dgn6n0` are live at that application SHA; auto-deploy remains off. Public Office business-branding.css, business-branding.js and office-live.css, plus Crew crew.css, matched release bytes using a release query after deployment.
- Supabase `mowmatter-business` version 6 and `mowmatter-invoice-delivery` version 3 are ACTIVE. Read-back entrypoints and invoice models matched release source; existing custom authentication and verify_jwt=false were preserved.
- No API deployment, payment, SMS, auth-policy or customer-record change, and no customer communications sent during this layout release. The 192 local viewport checks remain layout evidence, not physical-device, email-client or complete authenticated transaction certification.


## Customer mobile authentication correction — 2026-10-13

- Customer-account entry now exposes Google sign-in; public Auth settings confirmed Google enabled and Facebook disabled. Facebook is omitted on this screen until configured. No provider configuration changed.
- Dedicated email-only recovery, separate signup consent, visible password recovery beside the password label, and resend-confirmation action. Social continuation retains explicit customer-audience terms acknowledgement.
- Customer OAuth callback now preserves business/customer query parameters, matching password recovery and signup return links. Provider authentication itself still requires a real user sign-in; no real messages sent in testing.
- Optional SMS explanation remains available in a disclosure; footer uses flowing, two-column mobile links and safe-area spacing.
- Office tests/build and shared-asset drift checks passed. Four authentication states tested at 320, 390, 768 and 1440 pixels with no horizontal overflow; intercepted Google handoff verified complete customer return URL.

- Production release: `15c8455f9307cdd704d4c70916706cbb0cc8b230`; Office Render deployment `dep-db7b5vtg1s2s739rk9d0` live at 22:39:13 UTC. Public customer-account.html/.js/.css and mm-client.js matched release bytes. No Crew or API deployment was required.


## Global sign-in audit — 2026-10-13

- Public Auth settings report Google enabled, email enabled, Facebook disabled. Five live Google authorization requests from Office home/login, Crew, customer account and Yard Insights returned 302 to accounts.google.com, without a hosted-domain parameter. No company-email restriction found in application authentication; personal Gmail is supported. Google Console audience/publishing status and an ordinary user's completed consent flow were not accessible/verified in this audit.
- Added missing Yard Insights Google entry, explicit customer consent, password recovery/reset UI, and correct email return destination for both extensionless and .html Yard Insights paths.
- Shared Office/marketing and Crew sign-in controls explain that personal email is accepted; Facebook buttons remain hidden unless provider settings report enabled. Customer-account Facebook remains omitted until configured.
- Facebook requires enabling its Supabase provider with valid Meta App ID/secret, the project auth callback configured in Meta, email permission, and public/live app eligibility. Only the disabled Supabase flag is confirmed; absence/validity of Meta credentials and publishing state was not observable. No provider secrets or configuration changed.
- Local browser checks passed Google handoff and exact return URL for all five entry paths. Office suites/build, Crew suites/build and shared-asset drift gate verified before release. No emails sent, accounts created, or tenant/role permissions changed. Full human Google consent still requires an end-user account.

- Office deployment `dep-db7bf4ad0e5s7380927g` and Crew deployment `dep-db7bf4qd0e5s73809490` are live at application release `3d4bcc39057b335bb10f6f5b77fc31143b7892a4`. Cloudflare Workers Build succeeded. Follow-up applies repository formatting to Yard Insights; Office/Crew behavior is unchanged.


## Final launch audit — October 14 launch

- See docs/LAUNCH-READINESS-2026-10-14.md for evidence and limits. Real personal-Gmail consent/onboarding remains a launch gate; SMS disabled; no connected operators yet.
- Corrected Crew completion email wrapper/stale invoice dependency with regression; synced root stylesheet and drift gate; archived unused public Office script.
- 59 public assets matched with security headers. No warning/error security advisors; direct browser table access denied. API production dependency audit zero vulnerabilities; marketing tooling seven existing findings. Auth/webhook negative checks passed. No real transactions or communications performed.

- Release `1446613c2b1f569af825935522b4c5d7325533f0`: all 164 API tests and GitHub quality passed; Cloudflare Workers Builds succeeded. Crew Edge version 11 ACTIVE with all six files matching read-back and anonymous request still 401.
- Office initial deployment `dep-db7bq02vcj2c73d1p310` was live but retired asset persisted. Cleared-build-cache deployment `dep-db7bqulg1s2s739tvt40` live at 23:23:58 UTC; public retired script now 404 and login HTML matches source. No API or Crew static deployment needed.

## SEO repair — October 14, 2026

- Live sitemap was 404; 21/22 public pages lacked canonicals and all lacked JSON-LD. Release da39ab114eb0f4090fb098d528a5d211b8629991 adds sitemap (11 indexable URLs), robots sitemap directive, metadata/schema across 22 pages and informational llms.txt. Existing noindex legal/utility pages preserved; login and brand reference excluded. Root marketing mirrors updated.
- GitHub quality and Workers Builds passed. Final live crawl confirms 22/22 HTTP 200 with canonical, description and JSON-LD; no broken relative HTML links. Three discovery files return 200. No search-ranking or rich-result guarantee.
- Search Console/Bing ownership/submission/coverage and field Core Web Vitals remain unverified. HTTPS www redirects to apex; HTTP returned 200 in this audit environment, requiring separate Cloudflare Always Use HTTPS review. No dashboard setting changed.
- DMARC independently checked earlier today after owner's DNS repair: Google and Cloudflare resolvers both return one policy preserving Cloudflare/Bird report recipients. Provider clearance not independently verified.

## Navigation, route comparison and sidebar release — October 14

- Application efd699ce369d17219b4fcf5b9cbd1b0f2dc5e749 adds Login in public main nav and Create Account labels, illustrative animated before/after route comparisons across homepage/product pages and Office sample maps, plus tablet/nav wrapping and Office sidebar overlap fixes. New route CSS/root mirrors checked by drift gate.
- 240 local viewport checks at five widths completed without page-level horizontal overflow; all Office suites and 12 targeted scheduling/dispatch/route-notice tests passed. Replay and reduced-motion verified. No actual route/customer/message changes.
- Live routing remains owner-reviewed dispatch; full AI drive-time optimization is in development. Sample ordering is a fictional-coordinate proximity heuristic. Do not sell the new illustration as activated live optimization or measured savings.
- Office Render dep-db7mmgeq1p3s73d1k93g live at 11:45:29 UTC. Public Office CSS/JS/route CSS and marketing homepage/style/route JS match release bytes. See docs/NAVIGATION-ROUTING-2026-10-14.md for scope and limitations.

## Operational routing build — October 14

- Added Google Routes road-matrix adapter, bounded constrained route planner, owner preview/approval and signed 15-minute proposals. Full scheduled route (2–12 stops), explicit per-visit flexibility, fixed appointments, service time, buffers and return-to-base deadline are checked. Typical travel only; no live traffic/weather/trailer constraints or multi-crew balancing.
- New service-role-only quota/atomic publishing migration `20261014115944_operational_route_planning.sql` is locally tested but NOT applied to production: connector rejected the production schema inspection. Do not infer production database verification.
- Activation requires server-side GOOGLE_ROUTES_API_KEY and MOW_ROUTING_ENABLED=true after migration and real provider validation; default off. Key presence/Google billing entitlement remains unverified. Google sign-in credentials are unrelated.
- Crew published order is independent of disabled SMS; owner-reviewed schedule changes still follow existing consent/transport gates. No customer visits or communications were modified during testing.
- See docs/OPERATIONAL-ROUTING-2026-10-14.md for test evidence, limits and activation checklist. Do not call routing launch-ready before live owner-to-crew rehearsal.

## Office quick actions — 2026-10-15

- Owner requested Quote, New customer and One-time visit at the top level for quick access. All five main owner views now share those actions in the page heading. Removed the nested dispatch/legacy-list visit button; the same existing creation handlers remain in use. Mobile uses two compact rows, with One-time visit full-width below Quote/New customer.
- Verified Office suite/build and all three action handlers across Overview, Customers, Visits, Accounting and Team using the existing synthetic DOM fixture. Desktop and 390px browser preview checked. No customer record was created and no SMS configuration changed. Deployment verification follows the reviewable release.

## Bird campaign rejection correction — October 16, 2026

- CYDJCUX rejected at 16:05:52 UTC (861, CALL_TO_ACTION / MANDATORY_MESSAGE_TERMINOLOGY). Brand remains approved; +1 201-908-8951 campaign linkage remains pending. No SMS sent; activation gates remain off.
- Corrected actual optional consent disclosures, added public `/sms` opt-in guide and SMS-specific privacy/terms, and implemented atomic, idempotent opt-in confirmation with no disabled-provider backlog. Bird HELP/STOP/START replies updated and read back. Details: docs/SMS-CAMPAIGN-CORRECTION-2026-10-16.md.
- 175 API checks and Office tests/build passed. Migration 20261016192355 applied through authenticated SQL editor, with migration history in the same transaction; connector itself denies queries. Production permission verification and release follow separately.
- Corrected retry reuses CYDJCUX with deployed-form evidence. Owner approved the additional $15 review fee; the completed resubmission is recorded below.

- SMS correction PR #13 merged at `7170410279ff425bc17e53015c3be05a3356d024`. PR quality run 38955031099 and merged release run 38955213968 passed. Render API `dep-db97lu7btjjs73bd26m0` and Office `dep-db97lulg1s2s73c9tin0` are live at that SHA. All five public SMS guide/privacy/terms/Office commerce/account assets exactly match repository bytes. Cloudflare published the marketing changes through the existing main publisher.
- Production read-back: confirmation table count 0, RLS true, anon SELECT false, authenticated INSERT false, authenticated function EXECUTE false, backend EXECUTE true; migration version recorded. No customer consent rows were edited in this correction. Health still reports SMS false, route notices false, and all three activation gates missing; routing also remains disabled/provider unconfigured.
- Authenticated operator-owned TEST ONLY account shows the deployed program name, separate unchecked boxes, frequency/rates/STOP/HELP, support and SMS policy links. Screenshot cropped to the actual form only (blank phone; placeholder is not a saved number). Uploaded as supporting evidence to the staged retry of the same CYDJCUX. Updated samples match actual arrival/completion/offer templates, using business/customer placeholders instead of exposing a real personal link.
- Owner approved the additional $15 fee. Bird confirmation opc_01m533hwxfffbvfwynydc9aq6e completed at 19:38:59 UTC; $15 paid from existing wallet balance. CYDJCUX attempt 2 is submitted/pending (cms_01m533k3r3ebsbz7fcmv2hcfpv), no new rejection reasons, existing number linked, proof attachment tca_01m533abb4fp8v88ena4hvyyw1 retained. API read-back confirms the corrected fields and carrier-review wait state. No second campaign, SMS sent, or carrier delivery tests. Activation still requires carrier approval plus delivery/callback/STOP/HELP tests.

## Optional Google Analytics — 2026-10-28
Owner requested tracking under 50jcarlson@gmail.com. Mowmatter’s separate GA4 web stream uses G-1T8EP3GRVX. The marketing integration reuses mmPrivacy, renews consent at version 2026-10-28, and keeps optional Google requests off until Allow analytics. Google receives normalized route categories only; advertising features stay disabled. Root and web/dist copies remain synchronized. Render was inspected in the owner-confirmed MowMatter workspace; its marketing copy is historical. Cloudflare remains the documented marketing publisher. Installation, build success, and actual public-domain measurement are distinct verification steps.
