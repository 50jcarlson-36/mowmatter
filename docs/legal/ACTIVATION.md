# Compliance release and activation
## Completed implementation
Branded legal hub, separate full Privacy/Terms drafts, homeowner request information, billing disclosures, browser measurement controls, support/privacy/marketing opt-out request form, footer/app links and durable request/suppression backend.
## Before binding-contract activation or marketing send
Supply legal entity, mailing address, monitored email and jurisdiction; counsel approves liability/indemnity and state renewal rules; approve retention and refund/proration policies; publish final effective versions; implement server-recorded account/booking acceptance before enforcing those agreements. No continuous tracking or Google Maps optimization represented as currently running.
All promotional email must have accurate sender/subject, ad identification where required, valid postal address and working unsubscribe; process opt-outs promptly and within applicable deadlines. Sender must check mowmatter_marketing_suppressions before every commercial send. No campaign is enabled by this patch. The public form records opt-outs without account enumeration. Staff must monitor mowmatter_compliance_requests and verify identity before access/deletion/export. No email delivery or response SLA is promised.
## Deploy
Apply additive supabase/compliance.sql; deploy existing mowmatter-capture with its prior verify_jwt=false and in-handler publishable key/rate/origin controls; deploy static pages. Smoke-test unauthorized access, request validation, duplicate request and suppression. Existing financial and service features are unchanged.
## Evidence
FTC: https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business ; https://www.ftc.gov/business-guidance/advertising-marketing
Supabase: https://supabase.com/docs/guides/database/postgres/row-level-security
A website patch does not certify compliance across every US state.
