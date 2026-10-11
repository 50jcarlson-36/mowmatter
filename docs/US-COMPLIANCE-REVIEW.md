# US readiness review — October 11, 2026

Scope: MowMatter business signup, customer signup, marketing, invoices, customer portal, privacy choices and paid homeowner referrals. This is an implementation review, not a legal certification.

## Implemented controls

Business and customer signup show terms and privacy notices. Marketing consent is separate and initially unchecked. Necessary service notices are distinct from marketing. Signup receipts currently use editable authentication metadata; they are not an immutable legal acceptance ledger.

Optional marketing-site analytics default off and stop after withdrawal. Browser privacy signals override optional analytics consent. Public referral sale/sharing opt-out requires only an email, without creating an account or consenting to marketing. Its private suppression record and database trigger prevent future referral sharing for that email. Homeowner submissions honor browser privacy signals. Prior disclosures cannot be recalled. Anonymous browser signals do not identify every existing account across devices.

Email unsubscribe saves suppression and disables optional launch updates. Privacy access, export, correction and deletion requests enter a private review queue. Deletion and disclosure require verification and operational handling; a published form does not complete those workflows.

Business branding, branded invoices, Powered by MowMatter attribution and authenticated customer account links were deployed before this review.

## Unfinished legal and operational work

- Confirm contracting entity, actual practices, vendor/subprocessor disclosures and signed processor agreements with counsel.
- Determine applicable state privacy laws using revenue, resident counts and referral monetization; assess data-broker registration separately.
- Assign privacy-request ownership, verification, deadlines, appeals and records; establish retention, backup deletion and incident response procedures.
- Review recurring subscription disclosures, renewal consent evidence, cancellation experience and applicable state automatic-renewal laws. No legal certification or revised checkout was deployed in this review.
- Review marketing email templates and sending operations for a valid postal address, accurate sender/subject, clear opt-out and timely suppression. SMS marketing remains outside this review.
- Assess accessibility, payment-security obligations and new California risk-assessment/audit/automated-decision rules only where applicable.

## Current authoritative sources reviewed

- Colorado Attorney General universal opt-out guidance: https://coag.gov/opt-out/
- California Privacy Protection Agency 2026 regulations: https://www.cppa.ca.gov/regulations/ccpa_updates.html
- FTC CAN-SPAM business guidance: https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business
- FTC March 2026 negative-option rulemaking: https://www.ftc.gov/news-events/news/press-releases/2026/03/ftc-seeks-public-comment-response-advance-notice-proposed-rulemaking-regarding-negative-option

The 2024 federal click-to-cancel rule was vacated; the March 2026 FTC proceeding is proposed rulemaking. Existing federal and state duties still require assessment. US-only operations do not remove state privacy or consumer-protection obligations.

## Validation

Privacy behavior tests cover default-off analytics, withdrawal, browser signals, blocked storage, expiration, server gating, email-only referral opt-out and failure handling. Database rollback tests verified that opted-out referrals cannot regain sharing consent. Synthetic test changes were rolled back. No customer account was created and no payment was charged.
