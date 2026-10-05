# Office-to-Crew release — October 5, 2026

Office now opens the authenticated live workspace by default. The original overview remains at /demo.html and explicitly uses sample data.

Implemented: persistent customer/property records, customer CSV export, weekly/biweekly/four-week service plans, 60-day initial job generation, explicit schedule extension, pause/resume, visit rescheduling/reassignment/cancellation, actual recurring-revenue projection, manual cash records, connected team messages and account recovery screens.

Existing Crew functions retain confirmed Start/Complete actions, private photos, checklists and user-scoped offline queues. Cancelled visits are hidden from active routes and cannot be started. Generation and cash writes use stable IDs for retry safety. Tenant authorization remains server-side; private tables are not exposed to browser roles.

Revenue projection assumes year-round service using 365.25 / interval-days / 12. It is neither collected cash nor a market appraisal. Each customer can have one active recurring plan. Saved changes affect newly generated visits; existing job snapshots remain unchanged.

SMS and Stripe are disabled. No automatic charge or homeowner delivery is enabled. Mapping, autonomous AI agents, native background location and homeowner portal remain separate future work.

Validation: transactional rollback checks cover generation counts, duplicate protection, owner restrictions, cross-company edits, reschedule, cancellation, pause/resume and cash idempotency. Office simulated DOM checks cover five live views, signup, recurring pricing, rescheduling and role-separated screens. Crew checks cover six views, confirmed start and completion-photo enforcement. Property-server tests pass.

Outstanding field acceptance: real owner/crew onboarding, auth-email delivery and redirects, physical-phone GPS and offline photo replay. Configure branded Office/Crew callback URLs in Supabase Auth and production SMTP before inviting external users if default email delivery is restricted.

Office build: node build.mjs. It generates live HTML from shell.html and leaves the demo independent. API changes live in crew/supabase/office-schema.sql and crew/supabase/functions/mowmatter-crew/index.ts.
