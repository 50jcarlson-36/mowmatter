# Published routes and homeowner progress

## Release scope

- Office: crew/day dispatch board, next-seven-days view, tap/keyboard reorder, drag-to-move with confirmation, version checks and basic service-time overlap validation. Publish remaining routes explicitly. Work underway must stay first. Moves affect one visit, not a recurring series.
- Crew: refresh the server-published stop positions for the signed-in crew; preserve them in the existing offline snapshot. Starts and completions remain confirmed crew actions.
- Customer account: scoped visit status, actual stops ahead when a published route has active work, care-option and change-request links. No public crew location or other customers' addresses.
- Vonage worker: once-per-visit approaching notice, either two stops away or next, plus date/time-change and cancellation notices. Reads current server data, claims atomically and checks consent/suppression. Uncertain provider sends are not automatically retried. Signed delivery callbacks update status.
- Messages send only between 8 AM and 8 PM in the owner's selected business time zone. Overnight changes remain queued; stale changes are superseded.
- New route-message consent is separate from the previous two arrival/completion texts. Existing opt-ins do not automatically authorize the additional notices.

## Activation, in order

1. Apply `api/commerce/route-notices.sql` to Supabase project `pzymmsfjgspvzbivzvkx`. The script adds columns, protected tables and service-role-only invoker functions. It creates no test customers and sends no messages.
2. Verify route tables have RLS enabled and `anon`/`authenticated` cannot execute the dispatch or claim functions.
3. Deploy the API, Office and Crew from the same main commit on their existing Render services.
4. Set `MOW_ROUTE_NOTICES_ENABLED=true` on the API service only after the database migration and the Vonage sender/campaign/signed callbacks are verified. Save and deploy. Default is disabled.
5. In Office → Visits, verify business time zone and publish a real crew's remaining route. The board does not rewrite promised visit times when reordering stops; review those times before publication.
6. A homeowner signs in to their company-scoped account and explicitly opts into approaching/schedule-change texts. SMS consent is optional.
7. With an authorized test recipient, start a real test route. Verify one next/two-stop notice, actual provider delivery, STOP handling, arrival/completion, schedule-change correction and the secure customer link. A unit test is not carrier-delivery validation.

## Verification and limits

JavaScript and DOM tests cover notice copy/scoped links, disabled/duplicate behavior, uncertain sends, invalid dispatch payloads, versioned publication and care navigation. Local embedded Postgres checks cover owner authorization, route publication/progress gating, stop counts, duplicate claims, stale/overlapping moves, route invalidation, opt-outs and restricted grants.

No fabricated ETA, background mobile-browser GPS promise, automatic upsell charge, weather auto-commit, live traffic optimization or travel-time capacity validation is included. Service-minute totals exclude driving. Start with owner-reviewed route suggestions and publish deliberately.

Supabase write calls returned `Invalid or expired requestState` during this release; read-back confirmed the migration was not applied. Route sending remains disabled, the original visit list remains available, and marketing labels the new communication flow as a preview. Restore connector write access before activation. Render delivery and a live customer SMS still require verification.
