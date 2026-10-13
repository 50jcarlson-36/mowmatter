# Mobile layout audit — October 13, 2026

Scope: public marketing, Office, Crew, homeowner account and invoice presentation. Source baseline: 9f33079de401330090eff89aa14b0f3b9066b90c.

## Findings and corrections

| Area | Finding | Correction |
| --- | --- | --- |
| Invoice dialog | Desktop columns break dates and dollar amounts over several lines. Dialog and document padding reduce reading space; oversized business heading dominates a phone. | Single-column labeled service/date/total, smaller heading, less nested padding, full-width print action and 44-pixel close control. Legacy table responses receive accessible mobile labels. Print styling retained. |
| Invoice emails | Invoice fragment has no viewport declaration and relies on a three-column table. | Fluid single-column inline styles and complete email document with viewport metadata. Applied to manual send and automated delivery/reminders. No invoice values, recipients, authorization or settlement rules changed. |
| Accounting | Three equal-width summary cells expand past 320/390-pixel viewports with a six-digit dollar amount. | Stack financial summaries on narrow phones; allow grid children and long text to shrink/wrap. |
| Office/customer account | Dense action rows, nested padding and fixed/minimum layout sizes make phone reading difficult. | Wrap section headers, stack row actions, remove fixed minimum widths, keep form fields within cards, use scrollable dialogs. |
| Crew | Connection and close controls are under 44 pixels; job action/footer offsets omit device safe-area inset. | Larger controls, wrapping action row, dynamic dialog height and safe-area-aware content/action/toast spacing. |

## Verification

- Local Chromium viewport sweep: all 47 HTML pages at 320, 390, 768 and 1440 pixels, plus invoice dialog at each width: 192 checks; final run no page-level horizontal overflow. These are layout checks, not 192 end-to-end transaction tests.
- Synthetic Office dataset includes customers, visits and $123,456.78 cash summary. Invoice stress case includes long business name, email/address, multiple services and a six-digit total. Customer account and plan billing rendered with local fixtures. No real customer records, payments or communications were created.
- Office terms references the public legal stylesheet; initial local blocking of that stylesheet caused one false-positive overflow. Repeating with the matching repository stylesheet removed it without a product change.
- Browser screenshots inspected for phone invoice typography, date and total readability. CSS handles older server invoice tables as well as the new single-column response.
- Office and Crew test suites/builds passed. Branding model/security tests passed, including escaped content, customer scope, matching browser/email templates, responsive email wrapper and preserved legacy invoice labels.
- Marketing pages had no page-level horizontal overflow in the tested states; this release does not redesign them.

## Limits and release requirements

- Local mocks and disconnected service/error states do not replace authenticated end-to-end production checks. Dynamic quote/payment/growth/dispatch states that require a real provider are not comprehensively certified by the static sweep.
- No physical iPhone/Safari, Android, keyboard/rotation, screen-reader or real Gmail/Outlook rendering certification. A sent email cannot be restyled retroactively. Stripe-hosted receipts/billing are outside these templates and need a specific example if still affected.
- Layout work follows WCAG reflow intent (320 CSS pixels), with 44-pixel primary touch controls and 16-pixel form text. This is not a complete WCAG conformance audit.
- Office and Crew are manual Render deployments. The current deployment browser is signed out; do not claim their CSS is live until the services are deployed and public bytes verified.
- Deploy matching invoice models through the existing Supabase Business and invoice-delivery functions, preserving custom authentication and current `verify_jwt=false`. Do not deploy other backend services or change SMS/billing flags for this visual update.

Reference: https://www.w3.org/WAI/WCAG22/Understanding/reflow.html
