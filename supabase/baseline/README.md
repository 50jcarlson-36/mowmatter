# Database recovery evidence — 2026-10-13

`live-public-20261013.sql` reconstructs the 44 Mowmatter public application tables, constraints, indexes, 42 functions and four triggers read from the live PostgreSQL catalogs. It contains no customer rows, credentials, auth users or storage objects. All application tables restore with RLS enabled and deny browser roles; application functions execute only as service_role. The destination must be an empty Supabase application schema with its managed auth/storage schemas already provisioned. Table creation intentionally fails on an occupied schema; never run this file against production.

`../recovered-history/` preserves all 17 original SQL history records, read from `supabase_migrations.schema_migrations`. This recovers the previously missing intake/directory/rate-limit definitions. These files are evidence, not an automatically replayed migration chain: the original project also received unrecorded SQL changes. Do not blindly copy them into migrations or use migration repair to mark code as applied.

## Restore rehearsal

1. Create an isolated local/staging Supabase database with PostGIS available in the extensions schema. No production connection or data is needed.
2. Restore `live-public-20261013.sql` once into its empty public application schema. This is a schema snapshot, not a backup of data.
3. Apply the pending `../migrations/*_go_live_code_hardening.sql`. Apply `../../api/commerce/route-notices.sql` separately only when preparing the dispatch release. Keep route sending disabled.
4. Recreate private proof/public logo buckets using the existing storage setup; the snapshot does not export buckets, files, Auth settings, scheduled jobs or extension-internal objects. Use authenticated test users and synthetic records to verify owner/crew/customer boundaries.
5. Compare tables, function definitions, privileges and indexes against the captured catalogs. Test the eight flows in the original go-live audit.
6. After a successful PostGIS rehearsal, generate an official Supabase baseline migration via CLI schema dump/pull and reconcile remote history against the reviewed snapshot and actual pending SQL. Review `20261010144631_yard_weather_operations.sql` separately; its absence from history is not proof its changes are absent.
7. Verify the actual project backup/PITR plan and perform a restore drill. Read-only catalog access cannot prove recoverability or enable backups.

The local settlement tests exercise real PostgreSQL triggers and restricted function grants with PGlite. They do not run PostGIS, independent database connections or a full Supabase restore. B2 remains open until the restore rehearsal and history reconciliation succeed.
