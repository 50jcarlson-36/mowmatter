# Release checks — October 10, 2026

Run `cd api && npm ci && npm run check` using Node 22. The command checks API and Office JavaScript syntax, formatting for the new pricing/scheduling modules, and the full API regression suite. `npm run format` normalizes the new modules. GitHub Actions runs these checks on pull requests and pushes to main; it also rejects whitespace errors with `git diff --check`.

## Drift and deployment gates

Before merging, compare the branch against the latest main. If behind, incorporate main and rerun checks; never overwrite newer work. Merge with an expected head SHA. Require the MowMatter quality check in branch rules once enabled by a repository administrator; merely adding a workflow does not prevent bypasses.

Render services must deploy the same approved commit: Marketing publishes web/dist, Office publishes office/dist, Crew publishes crew/dist, and API builds from api. Verify deployment commit IDs in each dashboard and verify the published Services preview and API health. A GitHub merge is not proof of a Render deployment; existing deployment documentation describes manual deploys.

The Cloudflare Workers check on the pricing branch failed without a detailed cause in its GitHub output. Inspect its build logs before treating it as a verified delivery path. Do not disable the check to hide the failure.

## Current feature boundaries

- Services & Pricing / guided labor setup: browser-local preview, not a persistent company catalog.
- AI setup suggestions: owner-authenticated endpoint, disabled unless explicitly configured; shared atomic usage accounting and real-session authorization review remain activation gates.
- Weekly weather planning: tested proposal heuristic, no live weather provider, road-route solver or dispatch.
- Yard Photo Insights / customer optional services: blueprint only, no inference, checkout or image processing enabled.

Run mobile and desktop browser checks, owner/crew/homeowner authorization checks, and live provider smoke tests before advertising these foundations as active product features. Do not equate successful unit tests with end-to-end production validation.
