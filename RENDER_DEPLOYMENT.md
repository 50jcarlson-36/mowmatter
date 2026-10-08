# Mow Matter deployment

Workspace: tea-db1qtlks728c73dpaplg (MowMatter).

- Marketing: root `web`, publish `dist`, build `test -f dist/index.html`.
- Office: root `office`, publish `dist`, build `test -f dist/index.html`.
- Crew: root `crew`, publish `dist`, build `test -f dist/crew.js`.
- Property API: root `api`, Node 22, build `node --test server.test.mjs`, start `node server.mjs`, health `/health`, free instance.

Only the API service links the `mowmatter` environment group. It reads `realestate_api` at runtime. Never attach this key to a static build or put it in browser files.

Shared backend: Supabase project pzymmsfjgspvzbivzvkx. Crew jobs, events, private proof photos and internal messages use authenticated owner/assigned-member access. SQL functions atomically enforce job state and idempotency. Customer updates are an outbox only; no SMS/email provider is connected.

Office has a clearly separated sample overview and a real `crew-live.html` workspace. Owners can create a business, assign verified crew accounts, create jobs and view activity. Crew is a PWA with explicit job confirmations and a device queue; location prompts require the app to remain open. Native background geofencing is not implemented.

Property lookup preview: ten attempts over fourteen days, with a global daily cap. The full address is transmitted to RealEstateAPI after the owner confirms. Failed attempts count. Responses expose only property specifications and boundary geometry; owner, mortgage and financial records are removed. The lot is not treated as mowable grass. The operator confirms grass area and pricing before an owner-review estimate. Quotes do not charge customers, enroll recurring billing, guarantee margins or activate a paid add-on. Provider plan entitlement still controls parcel availability.

Free Render API instances sleep; the first property lookup may take a minute to wake up. Static services created from a public Git URL use manual deployment until an authorized Git provider/Blueprint configuration is added. Do not assume a GitHub push was deployed; verify each service deployment.

Custom domains require the Render-provided domain verification and Cloudflare DNS updates before launch on mowmatter.com, office.mowmatter.com and crew.mowmatter.com.

## Business Login embedding and launch updates (2026-10-08)

Deploy Marketing (`web/dist`) and Office (`office/dist`) after the login-preference change. In Marketing's existing Content-Security-Policy header, add `frame-src https://office.mowmatter.com;` while keeping the other directives. Without this explicit directive, `default-src 'self'` blocks the Business Login iframe. Office already allows the two marketing origins in `frame-ancestors`.

The launch-updates checkbox belongs to the login form and defaults checked. Email sign-in and OAuth save both true and false through authenticated `mm_launch_updates`. It resolves the email from the confirmed account on the server. Existing unsubscribe suppressions remain authoritative. Launch-email audiences must filter `launch_updates = true` and exclude `mowmatter_marketing_suppressions`; `marketing_consent` remains a separate promotional preference. No separate lead form is required on the early-access page.
