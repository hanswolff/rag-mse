#!/usr/bin/env bash
set -euo pipefail

# Erzeugt die logrotate-Config aus der Vorlage und schreibt sie nach stdout
# (oder mit --install direkt nach /etc/logrotate.d/beta-rag-mse).
#
#   ops/logrotate/install.sh                 # Vorschau
#   sudo ops/logrotate/install.sh --install  # installieren
#
# APP_UID/APP_GID entsprechen denselben Variablen wie in compose.yaml und
# Containerfile; ohne Angabe wird der aufrufende Benutzer verwendet.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE="$SCRIPT_DIR/beta-rag-mse.template"
TARGET="/etc/logrotate.d/beta-rag-mse"

APP_DIR="${APP_DIR:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
APP_UID="${APP_UID:-$(id -u)}"
APP_GID="${APP_GID:-$(id -g)}"

if [[ ! -f "$TEMPLATE" ]]; then
  echo "Vorlage nicht gefunden: $TEMPLATE" >&2
  exit 1
fi

rendered="$(sed \
  -e "s|__APP_DIR__|$APP_DIR|g" \
  -e "s|__APP_UID__|$APP_UID|g" \
  -e "s|__APP_GID__|$APP_GID|g" \
  "$TEMPLATE")"

if [[ "${1:-}" == "--install" ]]; then
  printf '%s\n' "$rendered" >"$TARGET"
  echo "Installiert nach $TARGET (APP_DIR=$APP_DIR, APP_UID=$APP_UID, APP_GID=$APP_GID)" >&2
else
  printf '%s\n' "$rendered"
fi
