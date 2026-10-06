# Mow Matter transactional emails

Six responsive account templates are installed in Supabase Auth. Their source is in auth-templates.json. Supabase renders ConfirmationURL or Token; never replace them with a static sign-in link.

Crew Start and Complete events use email.mjs. The function authenticates the actor, authorizes the job/company, checks customer consent and current email, suppresses cancelled/historical visits and uses a stable per-event Resend idempotency key. SMS and Stripe remain disabled. Customer messages do not include private completion photos or account tokens.

Set RESEND_API_KEY in Supabase Edge Function Secrets using a sending-enabled Resend key for mowmatter.com. It is separate from the SMTP credential stored inside Auth. Missing configuration keeps updates pending. Only new Start/Complete events send automatically; older updates are not swept or replayed. Office owners can retry eligible failed/pending updates under 23 hours old. Late retries require a new reviewed communication, avoiding Resend's 24-hour idempotency expiry.

Notification status sent means accepted by Resend, not proven inbox delivery. Verify delivery in Resend. No delivery webhook is installed. Email failures never undo a recorded job transition. There is no background retry worker, booking confirmation or scheduled reminder worker yet.

Run node --test emails/email.test.mjs for consent, company scope, duplicate suppression, HTML escaping and failure retry checks.

Live branded password-reset test to jcarlson30@gmail.com was Delivered on October 5, 2026. It redirects to Office; this does not constitute a physical-device Crew or password-change acceptance test.
