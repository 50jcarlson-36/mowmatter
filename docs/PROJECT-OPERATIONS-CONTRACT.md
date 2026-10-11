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
- Therefore this Worker has no displayed binding to mowmatter.com. Do not repeatedly diagnose a missing GitHub token as the reason the existing Cloudflare builds cannot run.
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
