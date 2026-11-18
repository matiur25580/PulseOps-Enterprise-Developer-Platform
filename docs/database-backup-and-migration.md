# PulseOps PostgreSQL backup and migration runbook

**Current database:** Render Free Postgres `pulseops-test-db`  
**Resource ID:** `dpg-dbuudh61egvs739mk51g-a`  
**Created:** 2026-11-18 17:56:20 UTC  
**Expires:** **2026-12-18 17:56:20 UTC**  
**PostgreSQL major version:** 16  
**Region:** Singapore  
**API service:** `pulseops-api-test` (`srv-dbutvdu8bjmc73ahuc7g`)

## Critical facts

- Render Free Postgres expires 30 days after creation. After expiry it is inaccessible; Render documents a 14-day grace period to upgrade before deletion.
- Free Postgres does **not** include managed backups, exports, or point-in-time recovery.
- Render permits only one active Free Postgres database per workspace. A second Free database cannot be provisioned in the same workspace while this one is active.
- Therefore, do not rely on the expiry grace period as a backup strategy. Make and validate an external logical dump before **2026-12-17**.
- The replacement target must be provisioned separately. For a no/low-downtime cutover, use a paid target temporarily or a separate provider/workspace. A same-workspace Free-to-Free replacement requires a maintenance window: stop writes, take and verify the dump, free the existing Free database slot, create the replacement, restore, then repoint the API.

Official Render references:
- Free plan limitations: https://render.com/docs/free
- Backup and restore guide: https://render.com/docs/postgresql-backups
- Postgres migration guidance: https://render.com/docs/postgresql-upgrading

## Phase 1 — Create an external backup (target by 2026-12-10; hard deadline 2026-12-17)

1. Open the database dashboard: https://dashboard.render.com/d/dpg-dbuudh61egvs739mk51g-a
2. In the database Info page, copy its **External Database URL**. Keep it private; do not paste it into chat, commit it, or put it in logs.
3. On a trusted machine with PostgreSQL 16 client tools installed, run:

   ```bash
   export DATABASE_URL='PASTE_EXTERNAL_DATABASE_URL_LOCALLY'
   bash scripts/postgres-backup.sh
   unset DATABASE_URL
   ```

4. The script creates a PostgreSQL custom-format `.dump`, a table-of-contents validation file, and a SHA-256 checksum under `backups/`.
5. Copy the three backup files to a secure location outside this repository (for example, encrypted local storage plus a second private backup location). Do not commit database dumps to Git.
6. Verify the checksum with `sha256sum -c <backup-file>.sha256` (or `shasum -a 256 -c ...`) and retain the file size, timestamp, and checksum.

If the external URL is unreachable, check the database's Networking/IP allowlist and allow only the trusted machine's current public IP temporarily. Remove the temporary rule after the backup. Do not open the database to all IP addresses.

## Phase 2 — Provision and dry-run restore (target by 2026-12-12)

1. Choose a replacement PostgreSQL 16+ target. Keep it in Singapore if possible to reduce API latency.
2. Obtain the target's connection URL privately.
3. Restore the dump into a **new, empty** target database:

   ```bash
   export TARGET_DATABASE_URL='TARGET_EXTERNAL_DATABASE_URL'
   export BACKUP_FILE='backups/pulseops-postgres-YYYYMMDDTHHMMSSZ.dump'
   bash scripts/postgres-restore.sh
   unset TARGET_DATABASE_URL BACKUP_FILE
   ```

4. Validate that the expected Prisma tables and migration history exist. Compare row counts for important tables (tenants, users, tenant_memberships, teams, services, incidents, audit_logs) between source and target where both are still available.
5. Run the API against the target in a staging/test service first. Verify login, tenant isolation, read/write endpoints, and background workers. Do not cut production over based only on an HTTP health check.

## Phase 3 — Cutover (complete by 2026-12-17)

1. Announce a maintenance window. Pause user writes and background workers that mutate data.
2. Take a final fresh dump and checksum using Phase 1.
3. Restore the final dump into the target (or repeat the dry-run into a fresh empty target).
4. Update Render API service `DATABASE_URL` to the target's **internal** connection string when the target is on Render in the same region. Keep credentials in Render Environment settings only.
5. Deploy/restart the API. Confirm Prisma migrations are applied and verify database-backed endpoints and a controlled write/read/delete test.
6. Re-enable writers and workers. Monitor application logs for database errors.
7. Keep the old source database untouched until the target has passed verification and the external backup has been independently checked. Never delete the source before this point.

## Recovery / rollback

- If target validation fails before writes resume, keep the old source database as the active database and fix the target.
- If writes have already resumed on the target, do not simply switch back to the old source (that would lose new writes). Pause writes, dump the target, reconcile/restore into the chosen primary, then cut over deliberately.
- Keep at least one verified external dump beyond the Render expiry date. Render-hosted Free database backups are not a substitute for this.

## Operational status

- [ ] External source dump created
- [ ] Archive TOC validation passed
- [ ] SHA-256 verified
- [ ] Backup copied to a second secure location
- [ ] Replacement target provisioned
- [ ] Dry-run restore completed
- [ ] Table counts and application smoke tests passed
- [ ] Final write pause and dump completed
- [ ] API DATABASE_URL cut over and verified
- [ ] Writers/workers re-enabled and logs clean

**Current limitation:** the connected Render account tools do not expose the database password/External Database URL, and the hosted SQL query tool cannot connect because the database IP allowlist is empty. The backup cannot be run from this session without the external URL and a permitted network path. The scripts above are ready to run locally without exposing credentials.
