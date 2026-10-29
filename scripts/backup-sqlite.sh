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

# Konsistentes SQLite-Online-Backup an ein festes Ziel — die eine Implementierung
# für beide Aufrufer (systemd-Timer im Standardmodus unten, deploy.sh über
# --single). Bevorzugt `sqlite3 .backup`; ohne sqlite3 fällt es auf cp inklusive
# WAL zurück: Das WAL muss mitkopiert werden, sonst fehlen committete, noch
# nicht zurückgeschriebene Änderungen (Ziel dann: <ziel> plus ggf. <ziel>-wal).
backup_sqlite_to() {
  local source_db="$1"
  local target_db="$2"

  if command -v "$SQLITE_BIN" >/dev/null 2>&1; then
    "$SQLITE_BIN" "$source_db" ".timeout 5000" ".backup '$target_db'"
  else
    log "sqlite3 ('$SQLITE_BIN') not found - falling back to cp (including WAL)."
    cp "$source_db" "$target_db"
    if [[ -f "$source_db-wal" ]]; then
      cp "$source_db-wal" "$target_db-wal"
    fi
  fi
}

# Modus --single <quelle> <ziel>: genau ein Backup ohne Retention und ohne gzip,
# z. B. das Pre-Deploy-Backup aus deploy.sh. Das Ziel bleibt eine rohe .db-Datei,
# die der Rollback-Pfad direkt zurückkopieren kann.
if [[ "${1:-}" == "--single" ]]; then
  if [[ $# -ne 3 ]]; then
    log "Usage: $0 --single <source-db> <target-file>"
    exit 1
  fi
  single_source="$2"
  single_target="$3"

  if [[ ! -f "$single_source" ]]; then
    log "Database file not found: $single_source"
    exit 1
  fi

  mkdir -p "$(dirname "$single_target")"
  backup_sqlite_to "$single_source" "$single_target"
  log "Wrote single backup: $single_target"
  exit 0
elif [[ $# -gt 0 ]]; then
  log "Unknown argument: $1 (supported: --single <source-db> <target-file>)"
  exit 1
fi

# --- Standardmodus (systemd-Timer): tägliches gzip-Backup mit Retention ---

# sqlite3 bleibt hier Pflicht: Die gzip-/Retention-Kette erwartet genau EINE
# konsolidierte Datei; der cp-Fallback erzeugte zusätzlich ein -wal, das weder
# komprimiert noch von der Aufbewahrung erfasst würde.
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
backup_sqlite_to "$DB_PATH" "$tmp_db"
gzip -9c "$tmp_db" >"$tmp_gz"
mv -f "$tmp_gz" "$output_file"
log "Wrote backup: $output_file"

# Upload-Verzeichnisse (Dokumente, Ausschreibungen) mitsichern — sie liegen
# nicht in der Datenbank und wären sonst in keinem Backup-Job enthalten.
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
