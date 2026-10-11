# MowMatter project operations contract

Last updated: 2026-10-11, America/New_York.
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
