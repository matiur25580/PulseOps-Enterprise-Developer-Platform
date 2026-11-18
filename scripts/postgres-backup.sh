#!/usr/bin/env bash
set -Eeuo pipefail

# Create a portable PostgreSQL custom-format backup.
# Required: DATABASE_URL (use the external Render connection URL when running locally).
# Optional: BACKUP_DIR (defaults to ./backups).

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL is not set. Read it from the database dashboard; do not commit it." >&2
  exit 2
fi

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="${BACKUP_DIR:-backups}"
mkdir -p "$BACKUP_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_FILE="$BACKUP_DIR/pulseops-postgres-$STAMP.dump"

command -v pg_dump >/dev/null 2>&1 || {
  echo "ERROR: pg_dump is required (install PostgreSQL client tools)." >&2
  exit 2
}
command -v pg_restore >/dev/null 2>&1 || {
  echo "ERROR: pg_restore is required (install PostgreSQL client tools)." >&2
  exit 2
}

echo "Creating custom-format backup: $BACKUP_FILE"
pg_dump --dbname="$DATABASE_URL" --format=custom --no-owner --no-acl --verbose --file="$BACKUP_FILE"

echo "Creating checksum and archive table-of-contents sidecars..."
pg_restore --list "$BACKUP_FILE" > "$BACKUP_FILE.toc"
if command -v sha256sum >/dev/null 2>&1; then
  sha256sum "$BACKUP_FILE" > "$BACKUP_FILE.sha256"
else
  shasum -a 256 "$BACKUP_FILE" > "$BACKUP_FILE.sha256"
fi

bash "$SCRIPT_DIR/postgres-backup-verify.sh" "$BACKUP_FILE"
echo "Backup complete. Keep the .dump, .toc, and .sha256 files in at least two secure locations outside this repository."
