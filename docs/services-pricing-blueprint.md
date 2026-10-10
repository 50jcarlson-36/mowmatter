# Mow Matter — Services & Pricing

Implementation and production integration blueprint · October 10, 2026

## The owner experience

Office navigation: **Services & Pricing**, after Customers. Four sections: **My services**, **Packages**, **Quick quote**, and **Auto-quote rules**. The owner should be able to create a useful first quote without opening advanced settings.

Use one catalog for manual estimates, property-assisted estimates and the homeowner portal. An AI model can explain a quote or highlight missing information; it cannot choose rates, invent work duration, or change the price.

The included `office/dist/services-preview.html` is a working responsive preview. It saves only a browser draft, exports a private JSON file, and makes no network requests. It is deliberately not wired into the active Office navigation. The shared calculator is `office/dist/pricing-engine.mjs`; tests are under `api/pricing`.

### My services

Start with editable, unapproved suggestions for mowing, string trimming, edging, bed weeding, shrub trimming and yard cleanup. New owners must approve their own rates; starter values are not market recommendations. Owner-created services need a name, scope, pricing method, minimum, active status and customer-visible description.

| Method | Owner inputs | Quote calculation | Best fit |
|---|---|---|---|
| Flat price | Dollars per service visit | One fixed amount | Edging; an established customer's mowing rate |
| Lawn-area rate | Dollars per 1,000 confirmed grass sq ft; service minimum | Round to cents after area × rate, then apply minimum | Repeat mowing with known lawn area |
| Lawn-size bands | Increasing upper area limits; fixed price for each band | Use the first inclusive band containing the confirmed lawn area | Simple small/medium/large lawn pricing |
| Worker-hour | Hourly rate, estimated on-site minutes, worker count | Rate × minutes / 60 × workers | Labor charged for each worker |
| Crew-hour | Hourly rate, estimated on-site minutes | Rate × minutes / 60; do not multiply by workers | A crew sold as one unit |
| Per unit | Unit name, unit rate, quantity | Rate × quantity | Shrubs, linear feet of edging, beds |
| Inspection required | Description and review instructions | No automatic price | Overgrown yards, hazardous work, unknown scope |

Do not estimate minutes from lot area alone. Show `crew-hour` / `worker-hour` explicitly next to the hourly field. For per-unit services, owner-defined quantity rules must say whether fractional units are allowed. Never silently select the cheapest band for an oversized yard.

### Packages

Two understandable options:

1. **Fixed visit price** — mowing + string trimming + edging for one approved price.
2. **Service rates minus a discount** — price the included services, then apply the package-only discount.

Show an Included badge instead of selectable add-on pricing for included services. Reject duplicate services in the API as well as the UI. Discounts do not affect separately selected add-ons. A package needs at least one active service. Removing a service referenced by a package requires editing that package first.

Fixed packages need an approved eligibility scope in production: lawn size range, accepted condition, service area and access assumptions. A fixed package is not a promise to mow every property at the same price. Inspection-required services must keep the resulting quote in owner review even inside a fixed package.

The preview supports a single scope and cadence per quote. Production should create separate recurring and one-time quote groups. For example, recurring mowing plus an initial overgrowth cleanup must not multiply the cleanup fee by the annual mowing visit count.

### Quick quote

Default flow: address → services/package → cadence → required measurements → live preview → owner approval → send.

Offer a manual entry path when an address lookup fails or Instant Quotes is not enabled. An owner can copy an existing customer's *rates* into a new draft; copying must not replace accepted agreements or copy another company's data.

The live preview shows service scope, included package services, add-ons, per-visit amount, applicable tax and frequency. Show **Every 2 weeks · 26 planned annual visits**, rather than implying two visits each month. A 26-visit, $50-per-visit plan has a $108.33 monthly planning average; that figure is not a billing agreement.

Customer view excludes costs, platform fee estimates, processor costs, contribution and internal notes. Owner view can show those numbers along with warnings for missing cost assumptions. Contribution after estimated job costs and fees is not guaranteed net profit. An 80% software margin target is not a lawn operator's default operating margin.

On mobile, keep the preview readily accessible without a narrow table or nested scrolling. This preview puts it above the editors. The production workspace should use a Preview button that opens an accessible full-height dialog, with a sticky per-visit summary while editing. Every control needs a visible label, at least a 44px touch target, keyboard access and a clear error state. Avoid announcing the entire changing quote on every keystroke.

## Calculation contract

All persisted money is integer USD cents. Percentages are integer basis points. Validate numbers on the server; reject negatives, infinities, invalid precision, unsupported methods and excessive quantities.

Order:

1. Resolve only active services from the authenticated company's approved catalog version.
2. Verify required measurements and package eligibility.
3. Price a fixed package, or sum its services and apply its package discount.
4. Add distinct, non-included add-ons.
5. Add an explicit, owner-approved access / extra work adjustment.
6. Raise the resulting service subtotal to the company visit minimum when necessary.
7. Compute applicable tax using the configured production tax rules.
8. Calculate owner-only estimated costs and fees separately from the homeowner price.
9. Save a versioned quote snapshot with its assumptions, scope, annual planned visits, cadence and expiration.

Free / Growth / Scale platform percentages are **3.5% / 2.5% / 1.5%**. The preview estimates that fee on the pre-tax service subtotal and processor fees on the full payment. Before release, reconcile that basis with the current Stripe Connect implementation. Do not silently change existing payment fee policy. Actual processor fees come from the account's payment terms and may vary by payment method; the preview has no assumed processor price.

Current engine rejects duplicate add-ons, confirms grass area for area/band pricing, bounds inputs, respects worker/crew basis and never returns an automatically accepted status. It does not authorize a user, validate package geographic eligibility, calculate jurisdictional tax, or persist an accepted contract; those are server responsibilities.

## Connect the existing property API

The current `api/server.mjs` endpoint `/api/property` authenticates an owner through the existing `property_access` action, calls RealEstateAPI, and returns sanitized property details and optional parcel geometry. Its result intentionally has `mowable_sqft: null` and `area_status: needs_confirmation`.

Retain that behavior. **Lot boundaries do not establish lawn coverage.** Buildings, pools, paving, beds, wooded land and shared parcels can change the service area materially. Keep provider lot area read-only, next to a separate confirmed lawn area input. Store measurement provenance, timestamp and owner confirmation. Missing geometry, denied provider entitlements and unsupported addresses need a manual fallback.

The automatic endpoint must accept an offer ID and address/measurement reference, not a client-supplied total or rate. Load the approved catalog server-side and recalculate with the same pure engine. If a browser alters the price, company ID, fees or entitlement, the server must ignore or reject the altered values.

### Auto-quote approval gates

| Condition | Outcome |
|---|---|
| Draft or unapproved catalog | Owner review |
| Unknown lawn coverage or unconfirmed measurements | Owner review / request information |
| Outside service radius or approved package lawn range | No automatic offer; manual review |
| Inspection-required work, overgrowth, unclear access or hazardous conditions | Owner review |
| Excessive estimated duration or inadequate crew capacity | Owner review; no automatic scheduled day |
| Paid add-on unavailable, trial expired or usage exhausted | Manual quotes remain available; no provider/AI spend |
| All owner-approved scope, pricing and scheduling gates pass | Eligible for sending under configured owner authorization |

Instant Quotes should remain a separately purchased add-on with a tightly bounded trial. A reasonable price hypothesis is **$49/month**, with an included quote allowance determined after measuring property-provider, model and messaging costs. Do not activate unlimited lookups or promise a profitable allowance before those costs are known. Existing provider trial limits must remain enforced server-side. An eligible automated quote still needs a separate homeowner acceptance and payment authorization.

## Production data and API blueprint

Integrate with the current company membership and owner permission model; do not create a parallel identity system.

| Data record | Required fields / purpose |
|---|---|
| Service catalog version | Company ID, version, currency, draft/published state, company minimum, approved_by, approved_at |
| Service rate | Catalog version, stable service ID, name, scope, method, rate cents, minimum cents, hourly basis, unit definition, active flag |
| Area band | Service version, ordered inclusive upper area limit, price cents |
| Package | Catalog version, name, fixed/discount mode, price or discount basis points, eligibility scope |
| Package component | Package ID, service ID; unique pair; same company and version |
| Property measurement | Company/property reference, lot area, confirmed lawn area, source, confirmed_by, confirmed_at |
| Quote | Company/customer/lead reference, quote revision, immutable catalog version, server-computed totals, scope, cadence, expiration, status |
| Quote line | Immutable description, selected quantity, rate basis, component references, amount cents, recurring/one-time group |
| Acceptance | Quote revision, authenticated/verified homeowner, timestamp, agreed terms version; payment authorization reference kept separate |
| Audit event | Actor, company, operation, prior/new version references; no unnecessary sensitive payloads |

Recommended authenticated endpoints:

| Endpoint | Behavior |
|---|---|
| `GET /api/services/catalog` | Owner loads their company catalog; server derives company from verified membership |
| `PUT /api/services/catalog/draft` | Validate complete catalog; optimistic version check; save draft |
| `POST /api/services/catalog/publish` | Owner-only, transactional immutable approved version; audit event |
| `POST /api/quotes/preview` | Recompute using server catalog; no mutation, messaging or payment |
| `POST /api/quotes` | Create a versioned draft from selected services and confirmed inputs; idempotent |
| `POST /api/quotes/:id/approve` | Owner approval under current catalog and scope; preserve old revisions |
| `POST /api/quotes/:id/send` | Owner permission, verified recipient, expiry and consent-aware delivery |
| `GET /api/public/quotes/:token` | Expiring signed token; homeowner-safe payload only; no internal costs or customer list |
| `POST /api/public/quotes/:token/accept` | Verify exact quote revision, expiry, identity and terms; idempotent; do not accept altered totals |

Implement RLS on every company-owned record. Business owners may edit pricing; crews should only receive job instructions and necessary completion data. Homeowners may see only their authorized quote. Do not use an arbitrary client company ID or mutable auth user metadata as authorization. Public tokens must be unguessable, expire, and be revocable.

Publishing a catalog never reprices existing accepted jobs. New contracts reference a quote snapshot. Revising an already sent quote invalidates its prior acceptance token or requires an explicit superseding revision. Billing charges must use the accepted snapshot, not today's live service catalog.

## Quote lifecycle

`Draft → Owner review → Approved → Sent → Accepted`

Terminal or replacement states: `Expired`, `Declined`, `Superseded`, `Cancelled`.

Acceptance does not mean paid, scheduled or completed. Each is a distinct state. Scheduling must check current crew capacity and weather constraints. A card setup authorization is distinct from permission for a particular charge or recurring payment agreement. Use the existing Stripe Connect charge/refund/dispute model; adding a quote screen should not change who is the lawn-service merchant.

## Acceptance and rollout

### Completed in this implementation

- Editable six-service starter catalog and custom services.
- Flat, area, band, worker-hour, crew-hour, unit and inspection methods.
- Fixed / discount packages, add-ons and duplicate-charge prevention.
- Company minimum, owner-entered work adjustment and cadence inputs.
- Live homeowner and internal owner previews.
- Device draft saving and private JSON export.
- Pure calculation engine reusable by the server.
- Seventeen calculation tests passing with Node's test runner.

### Required before enabling for real accounts

- Company-scoped persistent storage, RLS and permission tests against the existing schema.
- Catalog validation, optimistic locking, publish/approval actions and audit records.
- Authenticated API recalculation using approved catalogs rather than browser state.
- Package eligibility, one-time / recurring separation and measurement provenance.
- Property lookup binding and paid add-on entitlement / usage accounting.
- Homeowner quote page, terms acceptance, expiration and revision handling.
- Capacity-aware scheduling and delivery integration with Resend.
- Exact Stripe fee basis, accepted-price snapshots and tax configuration.
- Mobile browser checks at 360px, 390px, 768px and desktop; keyboard, screen reader and large-text checks.
- Cross-tenant negative tests: another owner, crew member and homeowner cannot read or edit a pricing catalog.
- Operational retry tests: duplicate sends, acceptance retries and payment webhooks cannot duplicate a contract or charge.

### Run the review implementation

From the repository root:

```sh
node --test api/pricing/pricing-engine.test.mjs
python3 -m http.server 8080 --directory office/dist
```

Open `http://localhost:8080/services-preview.html`. Serving HTTP locally is necessary for ES modules; opening the file directly is not the supported run path. The existing Office brand icon is reused. This feature is intended for a review branch first, not a claim that quoting has been activated in production.

## Research basis

Reusable service catalogs, optional quote services and customer previews align with Jobber's documented quoting patterns. Area-band pricing and estimate previews align with Yardbook's matrix pricing approach. These are design references; Mow Matter's fee, approval and data-authorization rules must follow its own contracts and implementation.

- https://help.getjobber.com/en/articles/products-services-list/
- https://getjobber.zendesk.com/hc/en-us/articles/360046575473-Optional-Line-Items-on-Quotes
- https://support.yardbook.com/matrix-pricing/

## Guided setup and labor configuration extension

The preview now has a five-step guided setup: **Your business → Personnel & crews → Costs & rates → Your package → Review quote**. It preserves unrelated existing services/packages and applies a reviewed configuration only after an explicit owner checkbox. Salary allocation, hourly wage cost and owner field-time cost are distinct inputs. Starter labor cost is zero until the owner enters an assumption; the wizard prevents applying a configuration without crew labor costs.

Labor inputs include planning label, job role, pay-cost basis, hourly cost or annual salary/paid hours, an owner-entered burden percentage, hourly benefits/insurance cost, weekly hours and crew membership. These are private cost assumptions, not employee onboarding or payroll. No tax rates or worker classification are guessed.

### From one person to several teams

Use stable personnel records, then compose dated crew memberships. Link an invited Crew account to a personnel record; do not use a mutable display name as identity. A person can change crews without losing their job history. Keep operational role (crew lead, technician, driver) separate from authorization role (owner, permitted office manager, crew).

For each scheduled visit, snapshot assigned personnel, expected person-specific minutes, the cost-rate version and planned travel. Validate every person's availability and overlapping assignments; do not simply multiply company headcount by job duration. More workers do not automatically cut elapsed job time proportionally. The preview's weekly capacity figure is a theoretical ceiling based on the least-available crew member, not a scheduling promise.

`labor-engine.mjs` distinguishes crew clock minutes from worker-minutes, prices the actual selected crew's different hourly costs, includes allocated travel, and separately accepts other job costs. Example: two people spending 45 minutes on site represent 45 crew minutes and 90 worker-minutes. If one person joins late, actual costing must use that person's own entry, not the whole crew's duration.

### Time and job accountability in the Crew mobile website

Production needs **Start day / Start job / Pause / Resume / Complete job / End day**, with clear confirmation and durable server timestamps. A job completion event and an individual's time entry are separate records. Crew leaders may confirm a roster only under configured permission; edits require a reason and an audit record.

Store time categories for job work, travel, loading/unloading, maintenance, office work and breaks. Keep job costing, customer billable time and paid work time distinct. Do not infer unpaid time, overtime eligibility or payroll deductions from a geofence. Geo-location can support a check-in confirmation but cannot be the only proof of working time: a mobile browser may suspend when locked or backgrounded. Provide manual recovery and owner correction when location or connectivity fails. Offline replay must be idempotent per person/event.

Track estimated versus actual labor, travel, materials and allocated overhead per visit and per recurring contract. Preserve approved historical labor rate snapshots when a worker's rate changes. Record timestamp ranges in UTC with the company timezone for display and weekly summaries. `actualLabor()` provides a tested cost aggregation primitive that rejects duplicate entry IDs and overlapping time for the same person; it is not yet connected to live crew timers.

### Data and permissions required for production labor

| Record | Purpose |
|---|---|
| Personnel | Company-scoped worker ID, active status, operational role, optional linked auth user; minimal identity data |
| Labor cost version | Effective date, wage/allocation assumptions, burden/benefits; owner/authorized finance access only |
| Crew membership | Personnel IDs and effective dates; preserve historic assignments |
| Availability | Working windows, time off, restrictions and scheduling conflict checks |
| Visit labor assignment | Visit/person/crew references, estimated minutes and cost snapshot |
| Time entry | Person, visit or non-job category, start/end, source, idempotency key, approval state |
| Timesheet correction | Original entry, corrected revision, reason, actor and audit timestamp |
| Job cost snapshot | Approved labor totals, materials, travel, allocated overhead, quote revision and variance |

Crew users may see their assignments and permitted time entries, but not other people's wages, labor burden, salary or profitability. Homeowners never receive compensation data. Require company RLS plus separate finance permissions for cost records; membership alone must not expose compensation. Keep owner labor opportunity cost distinguishable from cash payroll cost. Production overtime and payroll export require explicit jurisdiction-specific configuration and review; this preview does not execute payroll.

### AI suggestion connection

`POST /api/setup/suggest` is wired into the existing API server on the review branch. It validates the Supabase user and caller-scoped owner membership, rejects oversized inputs, allowlists profile fields and service IDs, and returns structured suggestions. It never writes a catalog, sends a quote, changes a wage or creates a payment. Each suggested method must be separately selected in the wizard, and the final configuration still needs approval.

The model receives city, crew headcount, **aggregate** crew/job costs, target planning margin, sample lawn area and service names/methods. Personnel names, individual wages, customer lists and addresses are excluded. Tell the owner what is sent before requesting suggestions. The app escapes returned text rather than rendering AI HTML.

The installed implementation uses `ai@7.0.137`, `generateText`, `Output.object`, JSON Schema and an explicit Gateway client, verified against the package's bundled documentation. Runtime requires the server-only `AI_GATEWAY_API_KEY`, a live supported `AI_GATEWAY_MODEL` ID and `SETUP_AI_ENABLED=true`. Render uses an API key rather than Vercel OIDC. A configured direct provider key is not a Gateway key. No credentials have been added or moved, and no paid model request was made in this implementation.

The current local preview limit is five attempts per company per UTC day and fifty across the API process; failures consume an attempt. Before public enablement, replace process-local counters with shared, atomic daily and concurrency reservations, add a provider/key spend budget, and verify the model/retention configuration. Restarts and multiple replicas must not reset or bypass the production budget. Configure the existing Office origin/CSP to permit the API endpoint, and verify the owner membership RLS read under a real session. If any gate fails, the wizard remains usable without AI.

### Verification added

Calculation, labor and mock AI endpoint tests cover owner/crew access, private-field filtering, structured-result validation, rate snapshots, overlapping entries, approval, margin division, and spend-attempt caps. The existing billing, growth and property tests also run through the API `npm test` script. A DOM interaction test passed the wizard flow, personnel cost calculation, explicit approval, saving, reopening, and preservation of package/labor configuration. A Playwright smoke script is included for 390px and 1280px widths, but visual/browser execution could not run because the environment blocked the Chromium download. Live AI generation, live RLS authorization, browser visual verification and production deployment remain separate gates. The full API suite passes 62 tests.

Design research: Jobber's current Job Costing documentation tracks each employee's job time at the applicable labor rate and preserves past timesheets when labor costs change. Its time-tracking documentation separates timesheet review and payroll reporting from job operations. Mow Matter uses these principles with its mobile-web foreground/location constraints, rather than assuming native background geofencing.

- https://help.getjobber.com/en/articles/job-costing/
- https://www.getjobber.com/features/time-and-job-tracking-software/

To run the included optional browser smoke test, serve `office/dist` on port 8080, install Playwright in the API test environment (`npm install --no-save playwright`), install its Chromium browser (`npx playwright install chromium`), and run `node api/pricing/wizard.browser.cjs` from the repository root. The script is not included in the normal API test command and makes no live AI or payment requests.
