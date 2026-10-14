# Operational routing implementation — October 14, 2026

Status: implemented and locally verified; production activation pending. Do not advertise this as fully operational until the activation checks below pass.

## Workflow
Office → Visits → crew/day → Optimize route. Owner enters the starting/return address and work hours, and individually marks visits whose agreed arrival time is flexible. Unchecked visits are fixed appointments. The server loads the complete company/crew/day route; browser-supplied addresses, travel matrices, visit lists or prices are not trusted.

Google Routes Compute Route Matrix supplies directed road distances and typical driving durations. Live traffic is intentionally excluded. A bounded nondominated beam search minimizes drive time while respecting fixed arrivals, service durations, a five-minute buffer per visit and return-to-base deadline. All 2–12 scheduled remaining visits must fit. It is a heuristic, not a guaranteed global optimum. Work underway and blocked visits must be resolved before using this predeparture planner. Weather, trailer restrictions and breaks require owner review. This release does not automatically balance multiple crews or reschedule from weather forecasts.

The preview shows current/proposed driving totals, ordered visits, old/new appointment times and return time. Owner approval publishes the full schedule and crew order atomically. Signed previews expire in 15 minutes, bind to owner/company and carry every visit version. Changed, completed, started, canceled or added visits invalidate publication. No partial schedule is committed. Fixed appointment times cannot move. Replaying a successful proposal fails its version check.

Crew order no longer depends on the SMS feature flag; unpublished routes fall back to time ordering. Existing customer communication consent and transport gates remain unchanged. Route changes may queue notices, but this release does not enable SMS. Owners must contact customers about schedule changes while sending is disabled.

## Cost, data and security controls
- Server-only GOOGLE_ROUTES_API_KEY, restricted to Routes API and appropriate server egress; Google project billing and Routes API must be enabled.
- MOW_ROUTING_ENABLED=true explicitly activates after database/provider verification. Default is off.
- Optional ROUTE_SIGNING_SECRET; otherwise existing server-only Supabase service credential signs domain-separated route proposals. Never place either in static assets.
- Maximum 13 addresses including depot, 169 matrix elements per calculation; 20 attempts/company/UTC day, 30 seconds between attempts, 200 global/day. Provider failures consume a quota reservation. Google billing quotas should also be configured. Quota rows older than seven days are removed during reservation.
- No guessed geometry/straight-line fallback or fabricated savings when provider fails. Partial/unreachable matrices fail closed. Raw provider errors/secrets are not returned.
- Route estimates remain in the ephemeral preview. Database stores operational appointment times/order, not road matrices.
- API paths require a verified business owner. Database functions and quota table are service-role-only with RLS; the existing dispatch authorization is rechecked in the transaction.
- Publication briefly takes a table write lock to prevent concurrent inserts from changing full-route membership; this is bounded to 12 visits. Review this mechanism before materially increasing fleet scale.

## Verification
- Routing tests cover directed costs, fixed appointments, infeasibility, full coverage, baseline nonregression, provider partial/error responses, owner isolation, signature tampering/expiry, quota rejection, and crew ordering with SMS disabled.
- PostgreSQL-compatible PGlite runs both dispatch and routing migrations and exercises atomic publication, rollback, fixed-time enforcement, stale/foreign/active rejection, quotas and database permissions.
- DOM workflow verifies selected flexibility, preview review gate, signed publication and reload.
- Mobile preview tested at 320, 390, 768 and 1440 CSS pixels; no page/dialog horizontal overflow.
- Final API check passed: syntax, security headers, formatting, drift and all 173 tests. Office tests passed. Final mobile UI refinement also passed its DOM regression.

## Activation checklist / outstanding evidence
1. Production SQL inspection returned `user rejected MCP tool call`; no production routing migration was applied in this turn. Apply `supabase/migrations/20261014115944_operational_route_planning.sql` through the approved migration tool and reconcile its production version with repository history.
2. Configure GOOGLE_ROUTES_API_KEY on the existing Render API service, then validate a real road lookup. Credential availability has not been established. Google sign-in credentials do not enable Routes API.
3. Enable MOW_ROUTING_ENABLED=true only after migration and provider test; redeploy API. `/health` reports provider_configured/enabled without exposing secrets.
4. Use a dedicated owner/crew test route with consented test addresses to calculate, review and publish; confirm actual Crew ordering and fixed appointments. Do not message customers or alter customer visits merely to test.
5. Marketing remains truthful about pending activation. Manual dispatch remains available throughout.

Official provider references: https://developers.google.com/maps/documentation/routes/compute_route_matrix and https://developers.google.com/maps/documentation/routes/policies .
