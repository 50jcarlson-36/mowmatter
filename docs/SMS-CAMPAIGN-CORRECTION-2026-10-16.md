# Bird 10DLC rejection correction — October 16, 2026

Campaign CYDJCUX (`cmp_01m4tqyt9ffe49zsjgwwxjrxyd`) was rejected October 16 at 16:05:52 UTC for CALL_TO_ACTION and MANDATORY_MESSAGE_TERMINOLOGY (861). The approved brand remains unchanged. The previous submission omitted an opt-in confirmation and supporting documents.

Corrections:
- Public `/sms` guide states the precise personal-link → verified email → Text updates and optional offers → separate optional choices → Save SMS preference path. Generic account URLs alone do not identify a customer.
- Actual account form links to SMS terms/privacy and support; both choices are optional and initially unchecked. Existing choices can remain checked when revisiting saved preferences.
- SMS privacy explicitly excludes mobile opt-in data from third-party marketing and referral-sale sharing. SMS terms disclose program identity, frequency, rates, STOP/HELP and support.
- Server saves preferences and claims one confirmation atomically, scoped to company/customer/phone. Existing customer-email authorization and phone suppression remain enforced. Disabled transport saves preferences without claiming or queuing a welcome. An explicit save after activation is needed; no historical bulk enrollment.
- Welcome contains brand, selected-category frequency, rates and HELP/STOP. Duplicate or uncertain sends are not retried automatically. Delivery callbacks include confirmation records and preserve terminal states. Carrier delivery remains untested.
- Bird workspace HELP, STOP and START rules updated and read back. STOP states brand/no further messages. START acknowledges the request and directs verified re-enrollment; it does not restore application consent.

Validation: all 175 API checks passed; Office tests/build passed. PGlite executes real preference functions and migration; validates ownership denial, off/no-consent gating, duplicate claims, STOP and browser-role denial. Signed webhook tests verify confirmation delivery status updates. No SMS sent.

Production migration `20261016192355_sms_opt_in_confirmation.sql` applied atomically through the authenticated Supabase SQL editor after connector access was denied. Migration history was recorded in the same transaction. Production permission read-back and deployment evidence are recorded in the project operations contract when verified.

The same campaign was resubmitted with the deployed opt-in screenshot and corrected copy after owner approval of the $15 review fee. Do not create a second campaign. SMS, registration-approved and webhooks-verified gates remain off until carrier approval plus an explicitly opted-in delivery/callback/STOP/HELP rehearsal passes. Route notices stay off separately.


## Verified release

Release `7170410279ff425bc17e53015c3be05a3356d024` (PR #13) is live on Render API and Office. Public `/sms`, `/privacy`, `/terms`, Office `commerce.js?v=sms-consent-20261016` and customer-account HTML match release bytes. GitHub quality passed on branch and merged release. Production confirmation table is empty; RLS and service-only execution grants verified. Health reports all SMS activation gates off. The live, authenticated form screenshot has been attached to the prepared CYDJCUX retry; it contains no customer identifiers, saved number or consent.

Owner approved the $15 resubmission, and Bird confirmation opc_01m533hwxfffbvfwynydc9aq6e completed at 19:38:59 UTC. Attempt 2 cms_01m533k3r3ebsbz7fcmv2hcfpv is submitted; campaign CYDJCUX is pending carrier review with proof attachment tca_01m533abb4fp8v88ena4hvyyw1 attached permanently. The existing number remains linked. No further monthly campaign was created. Submission is not carrier approval, and SMS remains off.
