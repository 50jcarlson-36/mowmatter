# Database recovery evidence — 2026-10-13

`live-public-20261013.sql` reconstructs the 44 Mowmatter public application tables, constraints, indexes, 42 public functions, the private launch-preference function and four triggers read from the live PostgreSQL catalogs. It contains no customer rows, credentials, auth users or storage objects. All application tables restore with RLS enabled and deny browser roles; backend application functions execute only as service_role; the authenticated launch-preference wrapper and its private implementation retain their original authenticated grants. The destination must be an empty Supabase application schema with its managed auth/storage schemas already provisioned. Table creation intentionally fails on an occupied schema; never run this file against production.

`../recovered-history/` preserves all 17 original SQL history records, read from `supabase_migrations.schema_migrations`. This recovers the previously missing intake/directory/rate-limit definitions. These files are evidence, not an automatically replayed migration chain: the original project also received unrecorded SQL changes. Do not blindly copy them into migrations or use migration repair to mark code as applied.

## Restore rehearsal

1. Create an isolated local/staging Supabase database with PostGIS available in the extensions schema. No production connection or data is needed.
2. Restore `live-public-20261013.sql` once into its empty public application schema. This is a schema snapshot, not a backup of data.
3. Apply the four recorded release migrations in timestamp order: payment recovery, entitlements/crew scope, code hardening, and customer progress/dispatch. Keep SMS and route sending disabled.
4. Recreate private proof/public logo buckets using the existing storage setup; the snapshot does not export buckets, files, Auth settings, scheduled jobs or extension-internal objects. Use authenticated test users and synthetic records to verify owner/crew/customer boundaries.
5. Compare tables, function definitions, privileges and indexes against the captured catalogs. Test the eight flows in the original go-live audit.
6. After a successful PostGIS rehearsal, generate an official Supabase baseline migration via CLI schema dump/pull and reconcile remote history against the reviewed snapshot and actual pending SQL. Review `20261010144631_yard_weather_operations.sql` separately; its absence from history is not proof its changes are absent.
7. Verify the actual project backup/PITR plan and perform a restore drill. Read-only catalog access cannot prove recoverability or enable backups.

On 2026-10-13 the snapshot restored successfully in the official Supabase PostgreSQL 17.6 container with PostGIS in extensions. All four release migrations then executed without errors. The production project accepted those same migrations and now records versions 20261013155735, 20261013155746, 20261013155755 and 20261013155801; repository filenames match. All 51 public application tables remain RLS-enabled with no anon/authenticated table access. This closes the schema reconstruction and pending-migration portion of B2. Actual customer-data backup/PITR coverage and a data restore drill remain unverified; the snapshot is not a data backup.
