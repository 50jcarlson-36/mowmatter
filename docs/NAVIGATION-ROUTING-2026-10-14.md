# Navigation, routing graphics and layout — October 14

Added Login to shared public main navigation (opens Office login) and shortened business-account CTAs to Create Account. Mobile navigation includes the same link. Corrected tablet wrapping caused by a conflicting nowrap rule.

Before/after illustrations use the same six stop locations, comparing scattered and grouped order. Homepage benefit graphic and detailed comparison, AI Intelligence, Platform, Growth and Crew marketing pages share the artwork. Sample Office map views include the explicitly illustrative comparison with Replay. Marketing animation runs once on entry, can replay, and honors reduced-motion. The graphics do not represent measured route savings or actual customer dispatch.

Fixed Office sidebar overlap: inherited nav viewport height caused its contents to collide with the business summary. Nav now takes its real height; summary has explicit spacing. Section headings and longer text wrap. Locally measured Sign out bottom 1025 versus summary top 1053 (28px gap at tested desktop size).

Routing inspection: live Office explicitly says AI route optimization is in development. Sample Office uses a nearest-neighbor proximity heuristic on fictional coordinates; it is not a live road/time optimizer. Weekly scheduling is an owner-review heuristic; confirmed appointments/capacity and unverified rosters require review. No backend optimization or dispatch behavior changed in this visual release.

Validation: 240 local Chromium viewport checks covering 47 pages plus invoice dialogs at 320, 390, 768, 1024 and 1440 CSS pixels; zero final page-level horizontal overflow. Synthetic account data and intercepted providers; not physical Safari or complete external account validation. Screenshot review and explicit replay/reduced-motion checks passed. Source syntax, security-header and drift gates passed. Added route asset mirror checks. All Office test suites passed; 12 targeted scheduling/dispatch/route-notice tests passed. No customer messages or changes to real routes were sent.

Application release: efd699ce369d17219b4fcf5b9cbd1b0f2dc5e749. Production verification recorded in operations contract.
