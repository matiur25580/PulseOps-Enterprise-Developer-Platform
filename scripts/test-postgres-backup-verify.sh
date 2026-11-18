#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
TEMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TEMP_DIR"' EXIT
mkdir -p "$TEMP_DIR/bin"

cat > "$TEMP_DIR/bin/pg_restore" <<'MOCK'
#!/usr/bin/env bash
set -Eeuo pipefail
if [[ "${1:-}" != "--list" || -z "${2:-}" || ! -s "$2" ]]; then
  echo "mock pg_restore expected --list and a non-empty archive" >&2
  exit 1
fi
printf 'PGDMP mock archive table of contents\n'
MOCK
chmod +x "$TEMP_DIR/bin/pg_restore"
export PATH="$TEMP_DIR/bin:$PATH"

ARCHIVE="$TEMP_DIR/backup.dump"
printf 'mock postgres archive bytes\n' > "$ARCHIVE"
printf 'PGDMP mock archive table of contents\n' > "$ARCHIVE.toc"
if command -v sha256sum >/dev/null 2>&1; then
  sha256sum "$ARCHIVE" > "$ARCHIVE.sha256"
else
  shasum -a 256 "$ARCHIVE" > "$ARCHIVE.sha256"
fi

bash "$ROOT/scripts/postgres-backup-verify.sh" "$ARCHIVE"

printf 'tampered bytes\n' > "$ARCHIVE"
if bash "$ROOT/scripts/postgres-backup-verify.sh" "$ARCHIVE" >/dev/null 2>&1; then
  echo "ERROR: verifier accepted a checksum mismatch." >&2
  exit 1
fi
printf 'mock postgres archive bytes\n' > "$ARCHIVE"
if command -v sha256sum >/dev/null 2>&1; then
  sha256sum "$ARCHIVE" > "$ARCHIVE.sha256"
else
  shasum -a 256 "$ARCHIVE" > "$ARCHIVE.sha256"
fi

printf 'incorrect table of contents\n' > "$ARCHIVE.toc"
if bash "$ROOT/scripts/postgres-backup-verify.sh" "$ARCHIVE" >/dev/null 2>&1; then
  echo "ERROR: verifier accepted a table-of-contents mismatch." >&2
  exit 1
fi

echo "Backup integrity verification tests passed."
