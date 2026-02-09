#!/usr/bin/env bash
set -euo pipefail

DB_PATH="${DB_PATH:-/zfs/git/beta-rag-mse/data/prod.db}"
BACKUP_DIR="${BACKUP_DIR:-/zfs/backup/rag-mse}"
SQLITE_BIN="${SQLITE_BIN:-sqlite3}"
LOG_PREFIX="${LOG_PREFIX:-[sqlite-backup]}"

log() {
  printf "%s %s %s\n" "$(date '+%Y-%m-%d %H:%M:%S')" "$LOG_PREFIX" "$*"
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    log "Missing required command: $1"
    exit 1
  fi
}

require_cmd "$SQLITE_BIN"
require_cmd gzip
require_cmd date
require_cmd basename
require_cmd mktemp

if [[ ! -f "$DB_PATH" ]]; then
  log "Database file not found: $DB_PATH"
  exit 1
fi

umask 027
mkdir -p "$BACKUP_DIR"

today="$(date +%F)"
cutoff_epoch="$(date -d '6 days ago 00:00:00' +%s)"
output_file="$BACKUP_DIR/prod.db.$today.sqlite3.gz"

tmp_dir="$(mktemp -d "$BACKUP_DIR/.backup-tmp.XXXXXX")"
trap 'rm -rf "$tmp_dir"' EXIT
tmp_db="$tmp_dir/prod.db.$today.sqlite3"
tmp_gz="$tmp_db.gz"

log "Starting SQLite online backup from $DB_PATH"
"$SQLITE_BIN" "$DB_PATH" ".timeout 5000" ".backup $tmp_db"
gzip -9c "$tmp_db" >"$tmp_gz"
mv -f "$tmp_gz" "$output_file"
log "Wrote backup: $output_file"

shopt -s nullglob
deleted=0
kept=0
for file in "$BACKUP_DIR"/prod.db.*.sqlite3.gz; do
  name="$(basename "$file")"
  date_part="${name#prod.db.}"
  date_part="${date_part%.sqlite3.gz}"

  if ! date -d "$date_part" +%F >/dev/null 2>&1; then
    continue
  fi

  keep="false"
  file_epoch="$(date -d "$date_part 00:00:00" +%s)"

  if ((file_epoch >= cutoff_epoch)); then
    keep="true"
  fi

  if [[ "${date_part:8:2}" == "01" ]]; then
    keep="true"
  fi

  if [[ "$keep" == "true" ]]; then
    kept=$((kept + 1))
    continue
  fi

  rm -f -- "$file"
  deleted=$((deleted + 1))
done

log "Retention complete. kept=$kept deleted=$deleted"
