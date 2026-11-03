# Google Ads lead generation — plan and setup (2026-11-03)

Two Search campaigns for mowmatter.com: lawn care **business owners** (Mow Matter Office accounts) and **homeowners** looking for lawn service (requests and Locate Lawn Care). Nothing here creates an account, enters billing, accepts terms or spends money. Those are owner steps (see the end).

## 0. Launch test market: one compact suburban cluster

Launch in one metro and a few neighboring ZIP codes, not the whole state. Owner-operated mowing companies make money on route density: nearby recurring yards mean less drive time between jobs. Every ad, recruit and homeowner request in the test should land in the same few ZIPs.

| | Cluster | ZIPs | Why |
| --- | --- | --- | --- |
| **Primary (recommended)** | **Brandon – Valrico – Riverview** (east Hillsborough, Tampa metro) | 33510, 33511 (Brandon) · 33594, 33596 (Valrico) · 33569, 33578, 33579 (Riverview) | Contiguous suburban single-family neighborhoods along the SR-60 / I-75 corridors. Seven adjoining ZIPs keep provider drive times short and are big enough to recruit 10–20 owner-operators. |
| Alternate | **Winter Garden – Ocoee – Windermere** (West Orange, Orlando metro) | 34787, 34761, 34786 | A similar compact suburban cluster if Brandon recruiting stalls. Run it *instead of* Brandon, not alongside, so the test stays one cluster. |

**Coverage on 2026-11-03:** the public Locate Lawn Care search returned 0 approved providers in all ten ZIPs above (and in the Palm Coast area). The test therefore runs in this order: **recruit providers → approve listings → turn on homeowner ads.**

**Site copy decision needed before homeowner ads:** `/lawn-care` and `/locate-lawn-care` say "Starting in Palm Coast, Florida". If the test market is Brandon, those lines, and the homeowner ads in §4, need to name the chosen cluster instead. An ad that says Brandon must not land on a page that says Palm Coast.

### Recruiting target: 10–20 owner-operated mowing companies in the cluster

Ads alone won't recruit 20 local operators in seven ZIPs, because search volume for software in a small area is low. Run Campaign A (§3) alongside direct outreach:

- **Build the list:** Google Maps / Business Profiles for "lawn care", "lawn mowing" and "lawn service" in each cluster ZIP. Keep owner-operated, 1–3 crew businesses. Skip franchises and commercial-only landscapers.
- **Reach them where they are:** a phone call or visit first. Also flyers at local equipment dealers and outdoor power or small-engine shops (with the shop's permission), and local lawn-business Facebook groups and Nextdoor business pages. Don't text or auto-dial without prior consent (TCPA), and follow CAN-SPAM for cold email.
- **Tag every recruit link** so outreach and ads can be compared: `https://mowmatter.com/early-access?utm_source=outreach&utm_medium=direct&utm_campaign=mm-biz-brandon` (`mm-biz` also hides the homeowner bar).
- **Count a recruit only when they're approved:** Office account created, organic directory listing approved, and `service_zips` covering at least one cluster ZIP.

### What the test must validate (weekly scorecard)

Set the go/no-go numbers yourself. The starting gates below are suggestions, not benchmarks.

| Metric | How to measure | Suggested gate (adjust) |
| --- | --- | --- |
| Approved providers in cluster | `mowmatter_directory_listings` with `status='approved'` and a cluster ZIP in `service_zips` | ≥3 before homeowner ads; 10–20 by end of test |
| Homeowner requests | `mowmatter_homeowner_requests` rows with a cluster ZIP; paid ones have `source.utm_campaign` like `mm-home%` | Enough volume to judge (e.g. ≥30 in 4–6 weeks) |
| Provider availability | Share of cluster requests where a provider accepted within 3 business days (track in Office) | ≥70% matched |
| Recurring booking rate | Share of matched requests that become weekly or every-two-weeks service | ≥40% recurring |
| Customer acquisition cost | Ad spend ÷ approved providers (business). Ad spend ÷ recurring homeowner bookings (homeowner) | Business CAC below ~3 months of expected subscription + fee revenue |
| Profit after travel | For participating providers: revenue per route hour and average drive minutes between stops, cluster jobs vs. their other jobs (Office routes / Growth Lab) | Cluster stops have measurably shorter drives and higher revenue per hour |

**Unit-economics note (illustrative, with assumed numbers):** at a $50 mow every two weeks (about $108/month), the platform fee is about $3.79/month at 3.5%, or about $1.63/month at 1.5%. So a homeowner click is only worth paying for because it **keeps providers active and recurring**, not for its fee revenue on its own. Judge homeowner spend by recurring bookings per provider, and business spend by approved, active providers.

## 1. What the site now measures

| Conversion action (create in Google Ads) | Fires when | Where | Category | Goal role | Count |
| --- | --- | --- | --- | --- | --- |
| `MM – Business signup` | (a) Email sign-up submitted in the embedded Office login on `/early-access`; (b) a **new** business account's first Google/Facebook sign-in or email confirmation on Office, which passes once through `mowmatter.com/welcome`; (c) a legacy early-access form saved | `access.js` ← `office/dist/login.js`; `welcome.js` ← `office/dist/mm-client.js`; `capture.js` | Sign-up | **Primary** (business campaign) | **One** (dedupes (a)+(b) from the same click) |
| `MM – Homeowner request` | Lawn care request saved by the capture API | `/lawn-care` (`homeowner.js`) | Submit lead form | **Primary** (homeowner campaign) | One |
| `MM – Directory search` | Locate Lawn Care search returns a result (including "no providers yet") | `/locate-lawn-care` (`directory.js`) | Other / Page view | **Secondary** (observe only, don't bid on it) | One |

The tag is `web/dist/ads-conversions.js`, loaded by `privacy-controls.js`. It:

- loads nothing before **Allow analytics**, only on `mowmatter.com`/`www.mowmatter.com`, and never with Global Privacy Control or Do Not Track. Withdrawing consent stops conversions and deletes `_gcl_*` cookies.
- stays fully off while IDs are placeholders: `AW-REPLACE_WITH_CONVERSION_ID` and the three `REPLACE_*_LABEL` values in `web/dist/privacy-controls.js` (copied to the root `privacy-controls.js` by `npm run sync:assets`).
- sends only the conversion event. No form contents, emails, names, addresses or ZIPs. The homeowner conversion carries a random submission UUID as `transaction_id` for de-duplication only.
- turns on Google's **restricted data processing** and turns off remarketing and ad personalization (`ad_personalization: denied`, `allow_ad_personalization_signals: false`). Enhanced conversions are not used.

Consent was renewed (`mm-privacy-v1` version `2026-11-03`) because the choice now covers Google Ads measurement. Every visitor sees the banner once again, and an earlier "Allow" doesn't carry over.

**Attribution into leads.** With consent, `gclid`, `gbraid`, `wbraid` and the five `utm_*` values from the landing URL are kept in `sessionStorage` (`mm-attribution-v1`) for that tab. They go into the existing `source` JSON on `mowmatter_leads` and `mowmatter_homeowner_requests`, so a click that lands on `/` and signs up on `/early-access` keeps its campaign. The capture function stores them only when `measurement_consent` is true and GPC/opt-out are absent (its allowlist now includes the three click IDs).

**Office sign-ups (Google/Facebook, direct, email confirmation).** Office loads **no Google code**, because it shows customer and homeowner records. Instead, `mm-client.js` marks a brand-new account on the business login page (`/login.html`). That means an email-confirmation link (`type=signup`) or a code exchange whose user was created in the last 15 minutes. Homeowner `customer-account.html` and Crew are never marked. When `login.js` would normally open the workspace, it goes once to `https://mowmatter.com/welcome?next=/index.html`. That page counts the conversion only if the visitor allowed analytics on mowmatter.com (and has no GPC), waits at most ~1.5 s for Google, then `location.replace`s to Office. `next` accepts only a single Office `*.html` path, so it can't be used as an open redirect. Without consent it forwards immediately.

**Still not measured:** sign-ups by people who never allowed analytics on mowmatter.com, which is correct. Paid-plan upgrades are also not measured. Later, consider a server-side offline import of *business* conversions (paid plan started). That first needs Office to store the consented gclid with the new business account, which isn't done today. Never do this for homeowners.

**Homeowner data rule.** Homeowner data must never be used for Mow Matter's own marketing. Don't upload homeowner emails, phones or requests to Google Ads (no Customer Match, no enhanced conversions for leads, no offline conversion import of homeowner records). Don't build remarketing audiences from homeowner pages. The homeowner conversion is a count of saved requests and nothing more.

## 2. Landing page review

| Audience | Page | Fit | Notes / proposed changes (not made in this PR) |
| --- | --- | --- | --- |
| Business | `/` | Good for broad "lawn care software" terms | Truthful status line ("Platform in development…"). Top bar "FOR YOUR HOME … Find lawn care" pulls business visitors toward the homeowner flow. **Done:** the bar is hidden for the tab when `utm_campaign` starts with `mm-biz` or `mm-home`. |
| Business | `/pricing` | **Best** for "free / pricing / cost" terms | Plans $0 / $49 / $129 per month. Platform fees 3.5% / 2.5% / 1.5% plus Stripe. Instant Quotes and Featured Placement are *proposed* launch offers. Don't advertise them. |
| Business | `/early-access` | Good final destination for "sign up" intent | Title "Business account & login" and the iframe are login-first. **Done:** the card now reads "Create your business account" with the Solo Starter facts from `/pricing` (including the 3.5% fee), and the Office form opens with *Create business account* first (`?intent=signup`, live after the Office deploy). |
| Homeowner | `/lawn-care` | **Best** (primary conversion) | Two-step form, "no payment required", says Palm Coast, FL. It already handles `?zip=`. Fine at 375px. |
| Homeowner | `/locate-lawn-care` | Use only for "near me / find" terms where listings exist | An empty result offers the request form, which is good. **Proposal:** fix the meta description, which describes a request flow rather than a directory search. |

Copy rules for all ads (from the current site): SMS and text-message features are **not active**, so don't mention texting or reminders. Customer notifications require activation. Instant price and quotes are in development. The homeowner flow is a request, not a booking, and has no guaranteed provider or date. Prices are confirmed before work.

## 3. Campaign A: Business owners (Office sign-ups)

- **Type:** Search only (turn off Display Network and Search Partners at first). **Bidding:** Maximize clicks with a $3.00 max CPC cap for 2–3 weeks. After ~30 `MM – Business signup` conversions, switch to Maximize conversions (then target CPA).
- **Geo:** the test cluster (§0) plus a **15-mile radius around Brandon, FL**, because operators who serve the cluster often live just outside it. Use **Presence** ("people in or regularly in"), not "interest". Don't widen to all of Florida during the test: a recruit outside the cluster adds no route density.
- **Budget (suggestion):** $10–15/day (about $300–450/month). A small area has little search volume, so more budget mostly buys pricier clicks. Put the rest of the effort into outreach (§0). While Campaign B is on hold, this is the whole ad budget.
- **Landing:** `/pricing` for price/free terms; `/` for general software terms. Final URL suffix: `utm_source=google&utm_medium=cpc&utm_campaign=mm-biz-{campaignid}&utm_term={keyword}`. Keep auto-tagging (gclid) on.

**Ad groups and keywords** (phrase "" and exact [] match):

| Ad group | Keywords |
| --- | --- |
| Lawn care software | "lawn care software", [lawn care business software], "software for lawn care business", "lawn service software", "lawn mowing business software" |
| Scheduling & crew | "lawn care scheduling software", "lawn care crew app", "lawn service scheduling app", "landscaping scheduling software" |
| Invoicing & payments | "lawn care invoicing software", "lawn care billing software", "lawn care invoice app" |
| Free / pricing (→ `/pricing`) | "free lawn care software", "lawn care software pricing", "free lawn business app" |

**Negatives (campaign level):** jobs, job, hiring, salary, careers, resume, near me, lawn mower, mower, repair, parts, for sale, used, rental, how to mow, diy, fertilizer, seed, sod, landscape design, design software, cad, 3d, drawing, template, excel, spreadsheet, course, class, certification, license, franchise, crack, torrent, apk, login, sign in. Add "jobber", "lawnpro", "yardbook" and other competitor names as negatives unless you choose to run a separate competitor test (bid on brands only, never use their trademarks in ad text).

**Responsive search ad (one per ad group; pin nothing at first):**

Headlines (≤30):
1. Lawn Care Business Software
2. Start Free: Up to 10 Customers
3. $0/Month Solo Starter Plan
4. Built for Solo & Small Crews
5. Organize Customers & Visits
6. Plan Your Crew's Day
7. Mobile Job Lists for Crews
8. Job Photos & Check-Ins
9. Plans From $0 to $129/Month
10. Invoices and Online Payments
11. Brandon & Riverview Lawn Pros
12. Clear Platform Fees
13. Create Your Free Account
14. Route Planning for Lawn Pros
15. Recurring Visits in One Place

Descriptions (≤90):
1. Organize customers, schedule recurring visits and assign jobs to your crew in one place.
2. Solo Starter is $0/month for up to 10 customers. 3.5% platform fee plus Stripe processing.
3. Crews open assigned jobs on a simple mobile site. Check-ins and photos keep you informed.
4. Paid plans from $49/month with lower platform fees: 2.5% Growth, 1.5% Scale, plus Stripe.

Display path (≤15 each): `software` / `free-plan`

Sitelinks (text ≤25, description lines ≤35):
- Pricing & Plans → `/pricing` — "$0, $49 and $129 monthly plans" / "Platform fees 3.5%, 2.5%, 1.5%"
- Create Account → `/early-access` — "Start with up to 10 customers" / "Solo Starter costs $0/month"
- Crew App → `/crew-app` — "Assigned jobs on a mobile site" / "Check-ins and completion photos"
- Growth Lab → `/growth` — "Explore route density" / "Model your next growth move"

Callouts (≤25): `$0 Starter Plan` · `Up to 10 Customers Free` · `Built for Small Crews` · `Clear Platform Fees`

## 4. Campaign B: Homeowners (lawn care requests)

> **Coverage check, 2026-11-03: hold this campaign.** The public Locate Lawn Care search (the same request the site makes) returned **0 approved providers** in the Brandon, Valrico and Riverview test-cluster ZIPs, in the West Orange alternate, and in 9 ZIPs around Palm Coast, Ormond Beach, St. Augustine and Daytona Beach. Paid homeowner clicks would produce requests nobody can serve yet. Launch Campaign B only when a ZIP cluster has **at least 3 approved providers** (re-run the query below), and spend on Campaign A until then. Recruiting providers *is* the business campaign's job.

- **Only the test cluster, and only ZIPs with approved providers.** Update the site's "Starting in Palm Coast, Florida" line to the cluster first (§0). Before launch, list the ZIPs that approved listings cover, using a **read-only** query in the Supabase SQL editor (project `pzymmsfjgspvzbivzvkx`):
  ```sql
  select zip, count(*) as approved_listings
  from mowmatter_directory_listings, unnest(service_zips) as zip
  where status = 'approved'
  group by zip order by approved_listings desc;
  ```
  Target **only those ZIP codes** (Google Ads → Locations → Advanced search → ZIP codes), **Presence** only. If the query returns nothing, **don't launch Campaign B**. A request with no provider still saves, but paying for leads you can't serve wastes budget and the homeowner's time.
- **Type:** Search only. **Bidding:** Maximize clicks with a $2.50 max CPC cap, then Maximize conversions on `MM – Homeowner request` after ~30 conversions. Set `MM – Directory search` as secondary.
- **Budget (suggestion):** $10–15/day for a 4–6 week validation run once ≥3 approved providers cover cluster ZIPs (about $300–450/month). Raise it only if provider availability and recurring rate (§0 scorecard) hold up.
- **Ad schedule:** all days. Optionally lower bids 9pm–6am.
- **Landing:** `/lawn-care` (primary). "Near me / find" ad group → `/locate-lawn-care`. Final URL suffix: `utm_source=google&utm_medium=cpc&utm_campaign=mm-home-{campaignid}&utm_term={keyword}`.

**Ad groups and keywords:**

| Ad group | Keywords | Landing |
| --- | --- | --- |
| Lawn mowing | "lawn mowing service", "lawn mowing brandon", "grass cutting service", [lawn cutting service], "lawn service riverview" | `/lawn-care` |
| Lawn care general | "lawn care service", "lawn care valrico", "yard maintenance service", "lawn care company" | `/lawn-care` |
| Cleanup & extras | "yard cleanup service", "hedge trimming service", "leaf removal service", "mulch installation" | `/lawn-care` |
| Find near me | "lawn care near me", "lawn mowing near me", "lawn service near me" | `/locate-lawn-care` |

**Negatives (campaign level):** jobs, hiring, salary, careers, lawn mower, mower, mowers, repair, parts, rental, for sale, used, buy, home depot, lowes, diy, how to, fertilizer, weed killer, seed, sod, artificial turf, irrigation, sprinkler, pest control, tree removal, stump, software, app, business, franchise, start a lawn care business, commercial landscaping, hoa contract. Also add every Florida city you don't cover that shows up in the search-terms report.

**Responsive search ad:**

Headlines (≤30):
1. Lawn Care in Brandon, FL
2. Need Your Lawn Mowed?
3. Request Lawn Care Online
4. Mowing, Edging & Hedges
5. Yard Cleanup & Mulch Beds
6. No Payment to Request
7. Find Local Lawn Care
8. Search Lawn Care by ZIP Code
9. Tell Us What Your Yard Needs
10. Weekly or Biweekly Mowing
11. One-Time Yard Cleanups
12. Price Confirmed Before Work
13. Simple 2-Step Request
14. Leaf Removal & Cleanups
15. Mow Matter Lawn Care

Descriptions (≤90):
1. Tell us your address and the services you need. We review local availability and reply.
2. Mowing, edging, hedges, leaves, cleanup or mulch. Request in 2 steps. No payment needed.
3. Serving Brandon, Valrico and Riverview. Provider, price and date confirmed before work.
4. Search approved local lawn care providers by ZIP code, or send one simple request.

Display path: `lawn-care` / `brandon`

Sitelinks: Request Lawn Care → `/lawn-care` ("Two steps, no payment needed" / "Pick services and frequency"); Find Providers → `/locate-lawn-care` ("Search approved listings" / "Search by ZIP or location").
Callouts: `No Payment to Request` · `Weekly or One-Time` · `Price Confirmed First` · `Approved Local Listings`

Don't claim: instant prices, guaranteed providers or dates, licensed/insured, "best", reviews or star ratings, text updates, or any area other than the covered ZIPs.

## 5. Manual steps for the owner (in your own Chrome)

1. **Account.** Create or confirm the Google Ads account (ads.google.com) and choose **Expert mode** so you can make a Search-only campaign without Performance Max. The draft you have open names a business called "Outvision". Confirm it belongs to the account you want to use for Mow Matter. Enter billing and accept Google's terms yourself.
2. **Conversion actions.** Goals → Conversions → New → Website → *Set up manually / Use Google tag*. Create the three actions in §1 with the listed category, primary/secondary role, "One" count and a 30-day click window. From each action's "Event snippet", copy the `AW-…` ID (shared) and the `send_to` label after the `/`.
3. **Fill the placeholders** in `web/dist/privacy-controls.js` (`adsId`, `adsBusinessSignup`, `adsHomeownerRequest`, `adsDirectorySearch`). Then run `npm run sync:assets && npm run check` in `api/`, commit, and merge. Merging to main publishes the marketing site through Cloudflare.
4. **Deploy in this order** (each step is safe on its own):
   1. Merge this PR. Cloudflare publishes `web/dist`, including `/welcome`, from main. Check that `https://mowmatter.com/welcome` loads before step 3.
   2. Deploy the capture function (adds the click-ID allowlist):
      `supabase functions deploy mowmatter-capture --project-ref pzymmsfjgspvzbivzvkx --no-verify-jwt`
      (the function does its own auth, and it's deployed today with `verify_jwt=false`).
   3. Render → **mowmatter-office** → *Manual Deploy* → *Deploy latest commit*. This brings the sign-up message and the new-account welcome hop. Then sign up a test business with Google and confirm you land in Office after the brief `/welcome` page.
   Until steps 2 and 3 are done, click IDs aren't stored and Office sign-ups aren't counted. Nothing breaks in the meantime.
5. **Link GA4** (property for stream `G-1T8EP3GRVX`) to Google Ads under Tools → Linked accounts, for reporting only. Leave Google Signals and ads personalization **off** in GA4.
6. **Auto-tagging** on (Account settings). Add the final URL suffixes from §3/§4.
7. **Verify after publishing:** open `https://mowmatter.com/?gclid=test`, click *Allow analytics*, and run a directory search. Then use Google Tag Assistant or the conversion action's diagnostics, which can take a few hours to show "Recording conversions". Check a test homeowner request row: `source.gclid` should be `test`.
8. **Run the homeowner ZIP query** (§4). Create Campaign B only once ≥3 approved providers cover a ZIP cluster, limited to those ZIPs. As of 2026-11-03 there are none in the test cluster.
9. **Build campaigns** from §3/§4 and paste the headlines and descriptions as written. Set daily budgets yourself. Review the Search terms report weekly and add negatives.
10. **Legal review (lower risk now).** The notices no longer make the absolute "we don't share for cross-context behavioral advertising" claim. They say what happens: conversion measurement with consent, restricted data processing on, no targeting or remarketing. Reject, Privacy controls and GPC count as an opt-out of any sale or sharing. A quick counsel review before launch is still wise.

## 6. Recommendations (in priority order)

1. **Start with recruiting in one cluster: Campaign A in Brandon–Valrico–Riverview + 15 mi at $10–15/day, sent to `/pricing`, plus direct outreach to 10–20 owner-operators (§0).** "$0 for up to 10 customers" is the strongest true hook you have. `/pricing` states it with the fee tiers, so the click matches the promise. Expect a learning phase: judge it on cost per sign-up after ~3 weeks or ~$400, not on day-3 numbers.
2. **Hold Campaign B** until ≥3 approved providers cover a ZIP cluster (§4). Each owner-operator approved in the cluster is what makes homeowner ads worth buying. Then run a 4–6 week homeowner test in those ZIPs only, judged on the §0 scorecard. When it launches, start with `/lawn-care` (2-step request) and leave `/locate-lawn-care` for "near me" terms only.
3. **Landing fixes are in this PR:** `/early-access` is sign-up-first, and paid campaign traffic doesn't see the other audience's bar.
4. **Recruit outside ads too:** phone calls and visits beat search ads for 10–20 local operators. Tag outreach links so the scorecard compares channels.
5. **Exact and phrase match only, Search Network only, Presence-only geo.** Skip Performance Max and Display for now. They need conversion volume and remarketing, which this setup deliberately doesn't use.
6. **Bid only on `MM – Business signup` / `MM – Homeowner request`.** Keep directory search as secondary so Google doesn't optimize for cheap searches.
7. **Weekly 15-minute review:** search terms → add negatives; pause keywords with no sign-up after ~$100 spend; pause headlines rated "Low" after two weeks.
8. **Don't advertise unbuilt features:** no texting or SMS reminders, instant quotes, Featured Placement, guaranteed providers or "best/#1".
9. **Re-check the homeowner data rule before any new Ads feature.** No Customer Match, no enhanced conversions, no audiences built from `/lawn-care` or `/locate-lawn-care` visitors.
