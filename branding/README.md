# MowMatter business branding and customer accounts

Business settings is an owner-only live Office page, replacing the old browser-only sample settings. One profile controls the logo, primary and accent colors, tagline, business address, phone, support email, website, invoice message and terms. Logo storage uses public brand assets only, with authenticated owner-only server uploads. Invoice and customer data remain private.

The Powered by MowMatter SVG preserves the existing brand icon. Business branding takes precedence in customer documents. Button labels choose black or white by relative luminance. Logo uploads accept PNG/JPEG/WebP up to 2 MB with server file signatures; SVG uploads are excluded.

Accounting supports invoices from completed priced customer visits, one immutable snapshot per job. Automatic invoice creation defaults off, applies to future completions and never charges customers. The completion transaction generates the invoice before the existing notification workflow, which includes the branded invoice when enabled. Existing consent, provider configuration and durable email outbox restrictions still apply. Owner invoice email sends use the customer record's email and consent, a durable processing claim, and provider idempotency. Email acceptance is not inbox delivery. Failed retries are limited to the provider idempotency window.

Customer links contain business and customer identifiers, not authentication credentials. Every account read and phone update requires a server-verified confirmed email matching that specific customer in that business. Links alone disclose no private data. Customers can see visits, invoices, provider contacts, update their phone and print/save invoices as PDF. Email/property/schedule changes go through the provider. Payment collection and Stripe reconciliation remain in the existing payment flow; invoices explicitly avoid asserting paid/unpaid without verified payment data.

Deploy `branding/schema.sql`, `mowmatter-business` and the updated `mowmatter-crew` Edge function with the relative model module. Both functions authenticate tokens internally with `auth.getUser`; platform JWT verification is disabled to support publishable-key authentication. Deploy `office/dist`, plus the synced marketing authentication assets. Supabase authentication redirect allowlists must permit `https://office.mowmatter.com/customer-account.html*` for customer confirmation/recovery links.

Validation: Office regression tests and branding DOM tests; invoice validation/escaping tests; existing email outbox tests; database rollback tests for automatic issuance, duplicate prevention and snapshot stability; endpoint tests for unauthenticated access.

Industry references: https://help.getjobber.com/en/articles/business-profile/ and https://help.housecallpro.com/en/articles/8448657-using-the-customer-portal/ . Pattern: single business profile, consistent customer-facing branding, contextual account links.
