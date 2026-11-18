#!/usr/bin/env bash
set -Eeuo pipefail

# Restore a verified custom-format backup into an EMPTY target database.
# Required: TARGET_DATABASE_URL and BACKUP_FILE.
# This script intentionally does not use --clean or drop existing objects.

if [[ -z "${TARGET_DATABASE_URL:-}" ]]; then
  echo "ERROR: TARGET_DATABASE_URL is not set. Do not commit or share it." >&2
  exit 2
fi
if [[ -z "${BACKUP_FILE:-}" || ! -f "$BACKUP_FILE" ]]; then
  echo "ERROR: set BACKUP_FILE to an existing .dump file." >&2
  exit 2
fi

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
command -v pg_restore >/dev/null 2>&1 || {
  echo "ERROR: pg_restore is required (install PostgreSQL client tools)." >&2
  exit 2
}

echo "Verifying backup checksum and archive contents..."
bash "$SCRIPT_DIR/postgres-backup-verify.sh" "$BACKUP_FILE"

echo "Restoring into the supplied target. The target must be empty."
pg_restore \
  --dbname="$TARGET_DATABASE_URL" \
  --exit-on-error \
  --no-owner \
  --no-privileges \
  --verbose \
  "$BACKUP_FILE"

echo "Restore command completed. Verify row counts and application behavior before cutover."
