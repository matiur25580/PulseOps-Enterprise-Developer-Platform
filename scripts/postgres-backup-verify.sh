#!/usr/bin/env bash
set -Eeuo pipefail

# Verify a custom-format PostgreSQL backup before it is copied or restored.
# Required: BACKUP_FILE (or pass the dump path as the first argument).
BACKUP_FILE="${1:-${BACKUP_FILE:-}}"
if [[ -z "$BACKUP_FILE" || ! -f "$BACKUP_FILE" ]]; then
  echo "ERROR: provide BACKUP_FILE pointing to an existing .dump file." >&2
  exit 2
fi

CHECKSUM_FILE="$BACKUP_FILE.sha256"
TOC_FILE="$BACKUP_FILE.toc"
if [[ ! -s "$CHECKSUM_FILE" ]]; then
  echo "ERROR: checksum sidecar is missing or empty: $CHECKSUM_FILE" >&2
  exit 1
fi
if [[ ! -s "$TOC_FILE" ]]; then
  echo "ERROR: archive table-of-contents sidecar is missing or empty: $TOC_FILE" >&2
  exit 1
fi

command -v pg_restore >/dev/null 2>&1 || {
  echo "ERROR: pg_restore is required (install PostgreSQL client tools)." >&2
  exit 2
}

EXPECTED="$(awk 'NR == 1 { print $1 }' "$CHECKSUM_FILE")"
if [[ ! "$EXPECTED" =~ ^[[:xdigit:]]{64}$ ]]; then
  echo "ERROR: checksum sidecar does not contain a valid SHA-256 digest." >&2
  exit 1
fi

if command -v sha256sum >/dev/null 2>&1; then
  ACTUAL="$(sha256sum "$BACKUP_FILE" | awk '{ print $1 }')"
else
  ACTUAL="$(shasum -a 256 "$BACKUP_FILE" | awk '{ print $1 }')"
fi
if [[ "$ACTUAL" != "$EXPECTED" ]]; then
  echo "ERROR: backup SHA-256 mismatch; the archive may be damaged or altered." >&2
  exit 1
fi

TEMP_TOC="$(mktemp)"
trap 'rm -f "$TEMP_TOC"' EXIT
pg_restore --list "$BACKUP_FILE" > "$TEMP_TOC"
if ! cmp -s "$TEMP_TOC" "$TOC_FILE"; then
  echo "ERROR: archive table of contents does not match its recorded sidecar." >&2
  exit 1
fi

echo "Backup integrity verified: checksum and PostgreSQL archive contents match."
