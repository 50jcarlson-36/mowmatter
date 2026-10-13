# MowMatter feature status — 2026-10-11

This is the release register. Implemented means code and database support exist; provider readiness and real-world verification are separate gates.

| Capability | Coverage | Remaining activation or limits |
| --- | --- | --- |
| Company branding | Logo, colors, support details, invoice terms, Powered by MowMatter and scoped customer account links | Owner supplies accurate legal/business details |
| Customer recurring payments | Owner prepares saved-service proposal; verified customer explicitly authorizes fixed monthly Stripe subscription; hosted payment-method management and period-end cancellation | Connected merchant charges/payouts and signed subscription/invoice webhooks must be enabled; full sandbox lifecycle and real merchant verification remain pending |
| Yard assessment upsells | Owner-reviewed catalog-priced future AI offers become immutable customer quotes; authenticated accept/decline; owner books accepted scope | Photo analysis allowance/provider activation remains a separate pilot gate; historical offers are not backfilled |
| During-visit add-ons | Assigned crew proposes work; owner prices it; customer approves; owner applies to active visit | Recurring visits get a separate one-time job/invoice, preserving monthly amount. Separate completion evidence required |
| SMS approval requests | Optional customer consent, US phone, price and secure account link, STOP/HELP, signed provider webhooks, deduplication and send cap | Bird adapter implemented; disabled until Bird credentials, approved sending number, signed webhooks and registration gates are ready. Replies alone do not authorize work or charges |
| Customer invoices | Stored snapshot, scoped payment checkout, payment status, external-payment/void audit note | Connected merchant readiness; refunds and disputes require provider workflow |
| Invoice email | Owner manual send, optional completion delivery, two optional overdue reminders, durable claims | Owner controls default off; free API hosting can suspend the worker while idle, so delivery timing needs a durable scheduler/always-on service; provider acceptance is not proof of inbox delivery; uncertain sends require review |
| Customer requests | Scoped service, reschedule, cancellation and account requests; owner response | Requests do not change service or subscription automatically |
| Privacy and marketing choices | Business and customer signup notices; optional marketing; cookie controls, analytics consent, GPC and referral opt-out | Ongoing jurisdiction/threshold review, vendor contracts, retention and rights operations are still required; this is not a legal certification |
| Weather and route planning | Forecast review and owner-approved planning | Travel-time matrix and autonomous rescheduling remain planned |
| Crew offline use | Existing local transition/photo queue | Device and weak-signal field verification pending |

Remaining competitive backlog: accounting synchronization/reconciliation; bulk imports and exports; two-way customer messaging; review requests; richer quote packages/deposits and change-order history; route travel optimization; broader mobile field validation; reliable delivery-event reconciliation; provider lifecycle tests; retention/deletion administration; configurable jurisdiction/tax treatment; accessible end-to-end customer flow review; and clearer feature entitlements/AI fulfillment.
