# Mow Matter — Weather, Growth & Weekly Service Planning

October 10, 2026 · Review-branch architecture and planning foundation

## Outcome

Generate one owner-review plan that accounts for every due customer service across all crews. Use property location, area-specific weather, owner-approved lawn-growth profiles, contractual frequency, skills, personnel availability and travel time. Identify missed or infeasible work instead of quietly dropping it. This is not enabled on the live system yet.

The current Office source has active service plans, interval-based recurrence, customers, jobs and assigned members. No connected forecast/growth-aware routing engine was found in that inspected code. The review branch now contains a pure planning heuristic in `api/scheduling/weekly-planner.mjs` and seven focused tests. It does not call a weather provider, write schedules, compute road routes, dispatch a crew or notify customers.

## Inputs across the system

| Input | Source and use |
|---|---|
| Property location | Verified address coordinates, access instructions and service zone; not the owner's billing ZIP |
| Parcel/lawn area | Existing RealEstateAPI lookup plus confirmed mowable area; parcel size is not grass coverage |
| Weather | Zone-specific hourly forecasts, precipitation, wind and relevant official alerts; retain timestamp and source |
| Lawn profile | Owner-confirmed grass type or unknown, irrigation, shade, seasonal cadence, last completed service and crew observations |
| Service obligation | Accepted service scope, normal interval, earliest/latest service window, customer blackout periods and confirmed appointment locks |
| Labor capacity | Active crew roster, personnel working windows/time off, skills, equipment, travel, breaks and planned job duration |
| Travel | Road travel matrix and depot/crew starting location; geometric distance alone is insufficient |
| Actual results | Completion, actual labor/travel duration, weather deferral and observed lawn condition; verified service history |

Define zones around practical service territories with representative forecast coordinates. Do not use one citywide forecast for a geographically spread-out operation. Refresh as forecasts change and inspect the actual property/crew conditions when weather is uncertain. A grid forecast is not proof that a particular yard is dry or safe.

## Provider connections

For a U.S. first release, the National Weather Service API provides coordinate-based forecast discovery, hourly forecasts for the next seven days and active-alert endpoints. The service requires an identifying User-Agent with a valid contact. Cache point/grid mapping according to provider guidance; refresh forecasts separately and preserve freshness metadata. Unsupported coordinates, provider errors or stale forecasts produce **Weather review**, never a clear-weather assumption.

Open-Meteo is an alternative structured forecast adapter with temperature, precipitation and probability fields. Commercial Mow Matter usage requires selecting the appropriate commercial subscription/license and attribution, not assuming the free non-commercial endpoint is suitable for launch.

Keep provider credentials, rate limits and cache operations server-side. No homeowner names or customer lists are necessary for a forecast call. Coordinates are property-location data and belong in the privacy/data-sharing disclosures. Use rounded zone-level coordinates where precision is not necessary.

Google's road travel matrix can supply durations and distances. A constrained vehicle/visit route optimizer is a separate function from drawing a map. Confirm the configured APIs, credentials, quotas and product billing before enabling calls. Existing property API access does not automatically provide road routing or weather.

## Growth-aware planning without guessing customer needs

Grass type, irrigation, season and observed conditions matter. Temperature and rain alone do not establish a reliable growth rate. UF/IFAS mowing guidance treats cutting height and frequency together and recommends adjusting mowing to actual growth; drought may slow growth. These principles inform configuration, not a universal formula for every U.S. lawn.

Each property gets an owner-approved growth profile and seasonal plan. If the grass type or recent condition is unknown, use the accepted cadence and ask for an observation. Start with transparent rules and historical visit durations rather than an unvalidated prediction model.

Recommendations may include:

- A fast-growing cluster may need an earlier visit inside its allowed window or more service minutes.
- A slow-growing or dormant lawn may warrant an owner/customer cadence discussion.
- Irrigated lawns may behave differently from nearby unirrigated properties during dry weather.
- An overgrown first visit may require extra time and a separately approved cleanup quote.

Never alter contract frequency, recurring price, minimum billable visits or billing authorization solely because a model predicts slower growth. Keep a cadence-change proposal separate from the weekly routing plan and obtain the required agreement before applying it.

## The weekly planning cycle

1. Materialize all service obligations for the company-local seven-day horizon using accepted plan versions. Include overdue unfinished work and do not count cancelled or completed visits as upcoming demand. Store recurrence identity so reruns cannot create duplicate visits.
2. Fetch fresh forecasts and official alerts for service zones. Evaluate service-specific work windows; rain probability, observed wet ground, hazardous alerts and heat considerations are distinct signals.
3. Load available personnel, crews, equipment, skills, working hours, locks and customer access restrictions. Reserve confirmed commitments before adding new work.
4. Evaluate lawn-growth/condition recommendations and duration confidence. Unknown data goes to review rather than generating a fabricated duration or automatic service cancellation.
5. Build road travel costs. Group nearby work when feasible, then optimize within hard service, weather, labor and appointment constraints.
6. Produce proposed crew-day routes and an exception list. Every due visit must appear in exactly one accounted-for state. Report late proposals and work that cannot fit.
7. Owner reviews a before/after diff with reasons, approves an exact plan revision and selects which customer notices to send. Recheck weather freshness and capacity at approval.
8. Publish atomically, update Crew through the existing shared jobs data, and queue consent-aware Resend notices. SMS stays disabled until its provider is configured. Do not notify customers about an unapproved proposal.
9. Replan after a real delay, new accepted booking, crew absence or actual duration change. Preserve completed jobs, in-progress work and confirmed appointments. Require review for materially changed customer commitments.

## What the owner and crew see

### Office weekly board

- **Due this week**: all promised services in the planning horizon.
- **Scheduled / proposed**: count and percentage with adequate capacity.
- **Weather review / blocked**: affected zones, hours, source and freshness.
- **Capacity exceptions**: staffing, equipment or service-window conflicts.
- **Overdue / at risk**: customer visits requiring action, with reasons.
- Crew-day workload includes drive time and buffers, not just mowing minutes.
- Actions: Review proposal, Compare changes, Approve week, Resolve exceptions.

Example explanation: “Tuesday's North zone has a forecast conflict. These four visits can fit Thursday within their service windows. Two others need customer confirmation.” This is explanatory copy, not a fabricated live forecast.

### Crew mobile website

Approved route, service scope, access notes, roster, weather notices and clear start/complete confirmations. If a job is blocked, show an owner escalation action instead of directing a crew into it. Manual location/connection recovery remains available. A locked or backgrounded browser cannot guarantee continuous location tracking.

### Homeowner portal

Next approved service day/window, requested services, completion history and approved change notices. Avoid promising an exact arrival time that the route cannot support. A weather deferral is a service-state change, not a completed visit or automatic payment trigger.

## AI's role and hard constraints

AI may explain tradeoffs, suggest seasonal settings and summarize exception resolutions. It must not invent forecasts, change wages, mark visits complete, override unsafe conditions, silently change contracts or authorize charges. The constraint checker and route solver remain authoritative. AI proposals must cite the input forecast/condition records and return structured IDs that are revalidated server-side.

Hard constraints: active and authorized crew membership; no personnel overlap; required equipment/skills; allowed customer service window; confirmed locks; working-hour/break policy; service-specific weather restrictions; travel and capacity feasibility. Soft goals: less travel, denser routes, fewer changes to the prior plan, fair crew workload and fewer late visits. Never trade away a hard constraint to improve a soft score.

## Storage and publication

Add company-scoped service zones, property growth profiles, weather snapshots, scheduling-policy versions, daily availability, route proposals, proposal assignments, exceptions and approval/audit events. Use immutable plan revisions and optimistic locking. Only owners/authorized dispatchers can approve; crew users receive only assigned operational data; homeowners receive only their own approved service schedule.

Use a transaction/RPC for plan publication and an outbox for notices. Make recurrence generation, proposal approval and message delivery idempotent. A scheduler retry must not duplicate jobs or send repeated notices. Billing references completion/accepted agreement rules, not a weather recommendation.

## Implemented foundation and limitations

`proposeWeek()` is a daily greedy heuristic with owner-review output. It uses validated service windows, due dates, growth priority, crew skills/eligibility, verified rosters, capacity/travel allowances and fresh zone forecasts. It flags stale/missing weather, weather blocks, staffing conflicts and locked visits. It accounts for every input obligation as proposed or requiring action and never changes cadence.

It does not solve hourly windows, generate recurrence, infer turf growth, call Google/weather APIs, know live ground conditions or publish schedules. The heuristic reserves known locked daily slots and stops new proposals when confirmed reservations are missing or inconsistent. Production must check precise personnel availability, build provider travel matrices, validate hazards at the relevant hour and perform authoritative server permissions before approval. Do not expose the heuristic as autonomous dispatch.

## Release checks

- Rain in one zone does not block every unrelated zone.
- Missing/stale forecasts cannot be labeled clear.
- A customer remains accounted for when the week is full or unsafe.
- New bookings cannot double-book a person across crews.
- Deferrals do not advance completion history or trigger completed-job billing.
- Forecast changes cannot move completed, started or locked visits without the proper workflow.
- Owner approval and notification retries preserve a single plan revision.
- Growth recommendations do not reduce promised service or change price without agreement.
- Company-local dates handle daylight saving and overnight time entries correctly.
- Provider outages leave the last approved schedule intact with a clear review warning.

## Sources reviewed

- https://www.weather.gov/documentation/services-web-api
- https://www.weather.gov/documentation/services-web-alerts
- https://open-meteo.com/en/docs
- https://open-meteo.com/en/pricing
- https://open-meteo.com/en/terms
- https://ask.ifas.ufl.edu/publication/LH028
- https://edis.ifas.ufl.edu/publication/LH007/
- https://gardeningsolutions.ifas.ufl.edu/lawns/maintenance-and-care/improving-your-lawns-drought-tolerance/

- https://developers.google.com/maps/documentation/routes/compute_route_matrix
