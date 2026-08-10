#!/usr/bin/env bash
set -euo pipefail

DB_PATH="${DB_PATH:-/zfs/git/beta-rag-mse/data/prod.db}"
# Default entspricht ops/systemd/beta-rag-db-backup.service und der Doku.
BACKUP_DIR="${BACKUP_DIR:-/zfs/backups/beta-rag-mse}"
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

# Obergrenze für Monats-Backups. MONTHLY_KEEP=0 würde über `head -n 0` sämtliche
# Monatsstände löschen, ein nicht-numerischer Wert die Aufbewahrung abbrechen.
MONTHLY_KEEP="${MONTHLY_KEEP:-12}"
if [[ ! "$MONTHLY_KEEP" =~ ^[1-9][0-9]*$ ]]; then
  log "Ungültiges MONTHLY_KEEP ('$MONTHLY_KEEP'); erwartet wird eine positive Ganzzahl."
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

# Upload-Verzeichnisse (Dokumente, Ausschreibungen) mitsichern — sie liegen
# nicht in der Datenbank und waeren sonst in keinem Backup-Job enthalten.
DATA_DIR="${DATA_DIR:-$(dirname "$DB_PATH")}"
files_output="$BACKUP_DIR/files.$today.tar.gz"
file_dirs=()
for dir in documents ausschreibungen; do
  if [[ -d "$DATA_DIR/$dir" ]]; then
    file_dirs+=("$dir")
  fi
done
if ((${#file_dirs[@]} > 0)); then
  tmp_tar="$tmp_dir/files.$today.tar.gz"
  tar -czf "$tmp_tar" -C "$DATA_DIR" "${file_dirs[@]}"
  mv -f "$tmp_tar" "$files_output"
  log "Wrote file backup: $files_output (${file_dirs[*]})"
else
  log "No document directories found under $DATA_DIR, skipping file backup."
fi

shopt -s nullglob

backup_date_part() {
  local name
  name="$(basename "$1")"
  name="${name#prod.db.}"
  name="${name#files.}"
  name="${name%.sqlite3.gz}"
  name="${name%.tar.gz}"
  printf '%s' "$name"
}

monthly_dates=()
for file in "$BACKUP_DIR"/prod.db.*.sqlite3.gz "$BACKUP_DIR"/files.*.tar.gz; do
  date_part="$(backup_date_part "$file")"
  if ! date -d "$date_part" +%F >/dev/null 2>&1; then
    continue
  fi
  if [[ "${date_part:8:2}" == "01" ]]; then
    monthly_dates+=("$date_part")
  fi
done

retained_monthly=""
if ((${#monthly_dates[@]} > 0)); then
  retained_monthly="$(printf '%s\n' "${monthly_dates[@]}" | sort -ru | head -n "$MONTHLY_KEEP")"
fi

deleted=0
kept=0
for file in "$BACKUP_DIR"/prod.db.*.sqlite3.gz "$BACKUP_DIR"/files.*.tar.gz; do
  date_part="$(backup_date_part "$file")"

  if ! date -d "$date_part" +%F >/dev/null 2>&1; then
    continue
  fi

  keep="false"
  file_epoch="$(date -d "$date_part 00:00:00" +%s)"

  if ((file_epoch >= cutoff_epoch)); then
    keep="true"
  fi

  # Herestring statt Pipe: `grep -q` beendet sich beim ersten Treffer, das
  # schreibende printf bekäme SIGPIPE, und unter `set -o pipefail` gälte die
  # Bedingung dann als nicht erfüllt — ein zu behaltendes Backup würde gelöscht.
  if [[ "${date_part:8:2}" == "01" ]] && grep -qxF "$date_part" <<<"$retained_monthly"; then
    keep="true"
  fi

  if [[ "$keep" == "true" ]]; then
    kept=$((kept + 1))
    continue
  fi

  rm -f -- "$file"
  deleted=$((deleted + 1))
done

log "Retention complete. kept=$kept deleted=$deleted (monthly keep=$MONTHLY_KEEP)"
