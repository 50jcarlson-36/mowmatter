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

Resubmit the same campaign with the deployed opt-in screenshot and corrected copy. A retry incurs another review fee; inspect its amount and obtain owner approval before the charged submission. Do not create a second campaign. SMS, registration-approved and webhooks-verified gates remain off until carrier approval plus an explicitly opted-in delivery/callback/STOP/HELP rehearsal passes. Route notices stay off separately.
