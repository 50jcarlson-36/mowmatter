# Mow Matter — Yard Photo Insights

Product and integration blueprint · October 10, 2026

## Product purpose

An optional paid operator add-on that turns yard photos into owner-reviewed observations, possible plant/grass identification and optional service opportunities. Use it during an initial quote, a first visit and later completion checks. Homeowners can choose approved extra services; no service or charge is added automatically.

This document defines the feature. No live image-analysis endpoint, model request, subscription product or customer upsell has been activated by this change.

## Two separate charges

1. **Operator analysis cost:** Mow Matter charges the lawn company for an explicitly requested photo assessment through its own add-on/usage balance. Ordinary proof-of-work photo uploads remain available without paid analysis.
2. **Homeowner service cost:** The lawn company offers a separately priced optional service from its approved catalog. A homeowner must accept an exact quote revision before scheduling or payment authorization. A photo upload or an AI finding does not authorize either charge.

Recommend bounded usage pricing initially, with an allowance measured in assessments rather than ambiguous unlimited AI use. Define one assessment as up to three optimized photos of one property for one requested purpose. Final price and allowance should follow measured model, storage and processing costs; create no Stripe product until those economics and the retry/refund policy are approved. Keep this entitlement separate from Instant Quotes unless explicitly sold as a bundle.

## Capture experience

**Initial quote / homeowner portal**

- Optional “Add photos for a more informed estimate.”
- Ask for an overall lawn view, a grass/leaf close-up, and the area of concern.
- Explain that photos improve review but cannot guarantee plant identification or a diagnosis.
- Ask short contextual questions: last cut, irrigation, recent changes, issue location and requested service. Grass type may be “I don't know.”
- Uploading does not charge the homeowner or automatically spend the operator's analysis credits. The operator requests the assessment under its configured policy.

**Crew mobile website / first visit**

- Capture Overview, Grass/plant close-up and Concern detail, using the mobile browser camera or existing photos.
- Link to the authorized property and visit, never an arbitrary client-provided company ID.
- Completion photos and initial-condition photos are distinct records.
- If requested, show the actual owner-authorized analysis price/usage amount before “Analyze this yard.” A crew member may request analysis only with a specific spending permission; default is owner approval.
- Permit upload/retry under slow connectivity and confirm what reached the server.

**Repeat visits**

Compare documented observations with comparable images and capture dates. Do not claim measured plant growth, yard area or health improvement from incomparable viewpoints alone. Reanalyzing an existing job requires another explicit request unless covered by an approved usage policy.

## Structured result and uncertainty

Separate visible evidence from inferred explanations:

| Result | Example wording | Action |
|---|---|---|
| Visible observation | “Grass appears to extend over this walkway edge.” | Owner reviews an edging suggestion |
| Possible identification | “This may be St. Augustinegrass; a clearer blade/stolon photo would help.” | Owner confirms; do not overwrite the lawn profile |
| Condition to inspect | “Sparse coverage is visible. The cause cannot be established from these photos.” | Offer an inspection, not a disease diagnosis |
| Poor input | “The photo is too dark to assess the grass.” | Request a better photo; no invented finding |
| Optional opportunity | “A cleanup of visible debris may be worth discussing.” | Match to an approved cleanup service |

Use confidence labels (tentative / reasonably supported / needs more evidence), never a model-generated percentage presented as calibrated accuracy. Each observation references an authorized photo ID and a plain-language evidence description. Species labels, suspected causes, severity and service need are suggestions, not confirmed facts.

UF/IFAS guidance supports multiple clear photos plus site context. Its turfgrass diagnosis guidance describes preliminary identification and referral to a county Extension office or diagnostic clinic where the problem cannot be narrowed down. Brown or sparse turf alone does not establish a disease. Photo-based findings must therefore permit an unknown result and a qualified review path.

## Service recommendations that connect to pricing

Match observations to the owner's active services and package rules. The model can suggest a service ID and rationale; it cannot invent an amount, measurement, labor duration or chemical treatment.

Reasonable first-release categories:

- Edging or string trimming.
- Manual bed weeding.
- Shrub trimming with owner-confirmed scope and species considerations.
- Debris or leaf cleanup.
- Mulch refresh with confirmed bed measurements.
- Irrigation inspection, if the operator offers it.
- Lawn-condition inspection or referral.

Potential fertilization, pesticide/herbicide, disease treatment, hazardous tree work and other specialized services need a separate qualified-operator and local-rules workflow. Do not generate an automatic chemical prescription, application rate, treatment guarantee or paid treatment quote from a picture.

For pricing, use the approved company catalog version and confirmed units, labor and access assumptions. Do not count shrubs, infer bed square footage or declare precise lawn area from an ordinary unscaled photo as a billable measurement. Unknown quantity means “Review needed” or a site assessment, not a made-up total.

If an opportunity is already included in the customer's package, mark it Included and do not bill it again. Low-confidence identifications cannot change a recurring plan or the routing growth profile without owner confirmation.

## Owner review screen

Show photo thumbnails, visible observations, tentative identifications, confidence limitations and candidate services. For each candidate offer:

- **Approve optional offer** — choose catalog service, confirm scope/quantity, recompute price server-side.
- **Edit** — correct the description, identification or scope.
- **Request another photo / inspect on site** — preserve uncertainty.
- **Dismiss** — record the reason and do not send a customer upsell.

Keep an audit record of the original assessment and the owner's approved version. Applying an observation to the property profile is a separate explicit action from creating an optional quote.

## Homeowner presentation

Use a calm optional card rather than an alarming “your lawn is unhealthy” sales message:

**Optional improvement: Bed weeding**

“We noticed visible weeds in the planting bed. If you'd like, we can include bed weeding with your next visit.”

Show the operator-approved exact price and whether it is one-time or recurring. If measurement is missing, show “Request a confirmed price” instead of an amount.

Actions: **Add to my quote**, **Ask a question**, **No thanks**.

No preselected extras, artificial urgency, condition scare tactics or automatic recurring enrollment. Declining an extra does not reduce the original agreed service. Accepted extras need their own scope and cancellation/payment terms where applicable.

## Customer Yard Insights portal and engagement

Make **Yard Insights** a first-class homeowner portal page, available from the quote confirmation, property dashboard and visit history. It shows only that homeowner's properties and owner-approved findings. Do not expose internal margins, analysis spending, crew location or unreviewed model output.

The page contains:

- **Your yard today:** dated photos, plain-language observations, possible grass/plant identification with uncertainty, and what the operator has confirmed.
- **Care already covered:** show included services before presenting extras, reinforcing the value of the existing plan.
- **Optional improvements:** relevant owner-approved service cards with confirmed scope, exact price, one-time/recurring label, and available scheduling subject to capacity confirmation.
- **Ask your lawn company:** questions tied to a finding, plus “Upload another photo” and “Request an inspection.” Uploading never creates a paid analysis automatically.
- **Progress over visits:** comparable dated photos and confirmed work completed, without invented health scores or unsupported improvement claims.

Customer journey: open an insight → understand the observation → ask a question or select an optional service → review the full quote revision and total → explicitly accept → capacity confirmation → authorized payment under the agreed terms. “Add to my quote” alone is not payment consent.

An optional paid **Yard Review** for homeowners can be offered later as its own catalog item, with its actual price, scope, limitations and refund policy shown before checkout. This is separate from the operator's analysis usage charge and any subsequent lawn work; the same analysis must not be billed to both parties without an explicitly disclosed separate service. Do not enable homeowner analysis billing in the first release by default.

Engagement should deliver useful updates, not repeated upsells: show a new reviewed insight after a visit, invite a response to an open question, and optionally remind the customer about an unresolved offer. Respect channel preferences and applicable consent, offer notification controls, suppress declined suggestions until new evidence or a customer request, and cap offer reminders. Transactional completion messages should not silently become promotional campaigns.

Measure insight views, questions, optional-offer acceptance, accepted-service revenue, repeat bookings, declines, opt-outs and complaints using real events. Do not display fabricated demand, acceptance counts or urgency. A customer who declines remains fully supported on their current plan.

## Connection to weather, growth and scheduling

After owner confirmation, identified grass type and observations may enrich the lawn-growth profile. The weekly planner can then consider season, irrigation, recent weather, accepted cadence and validated job duration. Photos do not establish soil wetness, a safe weather window or a scientifically reliable growth rate by themselves.

An accepted optional service adds its confirmed labor, equipment and duration to the relevant visit. The route planner must recheck capacity before promising a day. A recurring extra becomes a separate accepted contract/version, not a model-generated billing change.

## Technical integration contract

1. Authenticate the requester and verify property/visit access plus spending entitlement.
2. Reserve an assessment unit and idempotency key atomically. Enforce per-company and global spend/concurrency limits before the provider call.
3. Validate stored photo IDs and tenant ownership. Fetch only from approved private storage; reject arbitrary URLs and SSRF paths.
4. Decode/re-encode images, cap image count/size/dimensions, enforce supported formats and remove unnecessary EXIF location/device metadata. Handle phone HEIC conversion deliberately; do not assume every mobile upload is JPEG.
5. Generate short-lived access only for authorized processing. Never expose service keys or long-lived public customer-photo URLs.
6. Submit minimized images/context to a configured vision-capable model under the approved retention/data-use configuration. Text contained inside a photo is untrusted content, not a system instruction.
7. Require structured output with observation IDs, photo references, tentative identification, uncertainty, explanation and candidate approved service IDs. Reject invented photos/services and malformed responses.
8. Persist the assessment as `owner_review`, settle reserved usage once and apply the documented failure/retry policy. Duplicate request/replay must not duplicate spending.
9. Produce a separate owner-approved quote revision. Recalculate monetary totals using the approved catalog, never model output or browser amounts.
10. Publish an approved optional offer through the homeowner portal/consent-aware delivery. Accept, schedule and charge through distinct, idempotent actions.

Suggested records: private property photos, analysis request/reservation, immutable model assessment, owner review revision, confirmed lawn observations, optional quote candidates and accepted quote revisions. All are company scoped; finance/spending controls and photo access use separate permissions. Completion photos are not automatically reused for marketing or model training. Define retention/deletion and disclose relevant image-processing providers in the privacy policy before activation.

## Release gates

- Blurred, dark or irrelevant photos produce an abstention/retry result.
- Different plant species and turf types, mixed lawns, dormant lawns and drought stress are evaluated without a forced identification.
- Same-property photos cannot leak across companies; crew and homeowner access is restricted.
- Visible text cannot instruct the model to reveal records or publish an offer.
- Identifications remain unconfirmed until owner review.
- All optional prices come from approved rates and confirmed measurements.
- Package-included work cannot be charged twice.
- No automatic treatment recommendation or recurring upsell reaches a homeowner.
- Credit reservation, provider failure and duplicate retries reconcile correctly.
- Homeowner rejection leaves the base contract unchanged.
- Customer insight links require property-level authorization; forwarded links reveal no private photos or findings without access.
- Customer quote selection, acceptance and payment are separate; repeated taps cannot duplicate an extra or charge.
- Declined offers and notification opt-outs suppress promotional reminders.
- Accepted extras cannot overbook a crew or bypass Stripe authorization.
- Private storage, image retention, spend budgets and live model quality are verified before enabling.

## Sources reviewed

- https://blogs.ifas.ufl.edu/duvalco/2025/07/03/a-picture-is-worth-a-thousand-words-help-with-landscape-problem-identification/
- https://ask.ifas.ufl.edu/publication/LH064
- https://ask.ifas.ufl.edu/publication/LH040
- https://gardeningsolutions.ifas.ufl.edu/lawns/maintenance-and-care/turfgrass-sample/
