#!/usr/bin/env bash
# PROVIN LTAB relejs: uzstādīšana uz Hetzner (Ubuntu/Debian). Palaist kā root no izpakošanas mapes.
# Neaiztiek citus servisus (8787 CSDD, 8788 mnt, 8789 listings, iriss-vpn) un Caddy (maršrutu pievieno atsevišķi, sk. README).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_DIR="$SCRIPT_DIR"
cd /

APP_DIR="${APP_DIR:-/opt/provin-ltab}"
DATA_DIR="${DATA_DIR:-/var/lib/provin-ltab}"
ENV_FILE="${ENV_FILE:-/etc/provin-ltab.env}"
SERVICE_USER="provin-ltab"

if [[ $EUID -ne 0 ]]; then
  echo "Palaist kā root (sudo)." >&2
  exit 1
fi
if [[ -z "$SRC_DIR" || "$SRC_DIR" == "/" || "$SRC_DIR" == "$APP_DIR" || ! -f "$SRC_DIR/server.mjs" ]]; then
  echo "Nederīgs SRC_DIR=$SRC_DIR (nav server.mjs)." >&2
  exit 1
fi

echo "== Backup"
BACKUP="/root/backups/provin-ltab-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP"
[[ -d "$APP_DIR" ]] && tar -C "$APP_DIR" --exclude=node_modules -czf "$BACKUP/app.tgz" . || true
[[ -f "$ENV_FILE" ]] && install -m 600 "$ENV_FILE" "$BACKUP/provin-ltab.env" || true
cp /etc/systemd/system/provin-ltab*.service "$BACKUP/" 2>/dev/null || true

echo "== Pakotnes (Xvfb, Chrome atkarības)"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq xvfb fonts-liberation ca-certificates curl >/dev/null
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | sed 's/v\([0-9]*\).*/\1/')" -lt 20 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi

echo "== Lietotājs un mapes"
id -u "$SERVICE_USER" >/dev/null 2>&1 || useradd --system --home "$DATA_DIR" --shell /usr/sbin/nologin "$SERVICE_USER"
mkdir -p "$APP_DIR" "$DATA_DIR/profile" "$DATA_DIR/ms-playwright"
chown -R "$SERVICE_USER:$SERVICE_USER" "$DATA_DIR"
chmod 750 "$DATA_DIR"
chmod 700 "$DATA_DIR/profile"

echo "== Kods -> $APP_DIR"
find "$APP_DIR" -mindepth 1 -maxdepth 1 ! -name node_modules -exec rm -rf {} +
tar -C "$SRC_DIR" --exclude=node_modules --exclude=.git -cf - . | tar -C "$APP_DIR" -xf -
chown -R "$SERVICE_USER:$SERVICE_USER" "$APP_DIR"

echo "== npm install + Playwright Chromium"
sudo -u "$SERVICE_USER" env HOME="$DATA_DIR" PLAYWRIGHT_BROWSERS_PATH="$DATA_DIR/ms-playwright" npm --prefix "$APP_DIR" install --omit=dev --no-audit --no-fund
PLAYWRIGHT_BROWSERS_PATH="$DATA_DIR/ms-playwright" npx --prefix "$APP_DIR" playwright install-deps chromium
sudo -u "$SERVICE_USER" env HOME="$DATA_DIR" PLAYWRIGHT_BROWSERS_PATH="$DATA_DIR/ms-playwright" npx --prefix "$APP_DIR" playwright install chromium

if [[ ! -f "$ENV_FILE" ]]; then
  echo "== Env paraugs -> $ENV_FILE (AIZPILDA NILS: LTAB_RELAY_TOKEN, SMARTID_PERSONAL_CODE)"
  install -m 600 -o root -g root "$SRC_DIR/provin-ltab.env.example" "$ENV_FILE"
else
  echo "== $ENV_FILE jau ir, neaiztieku"
fi
chmod 600 "$ENV_FILE"

echo "== systemd"
install -m 644 "$SRC_DIR/systemd/provin-ltab-xvfb.service" /etc/systemd/system/
install -m 644 "$SRC_DIR/systemd/provin-ltab.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable provin-ltab-xvfb.service provin-ltab.service >/dev/null
if grep -qE '^LTAB_RELAY_TOKEN=.{16,}' "$ENV_FILE"; then
  systemctl restart provin-ltab-xvfb.service provin-ltab.service
  sleep 2
  curl -fsS http://127.0.0.1:8791/ltab/health || true
  echo
else
  echo "LTAB_RELAY_TOKEN vēl nav $ENV_FILE - serviss netiek startēts."
fi
echo "Gatavs. Backup: $BACKUP"
