#!/usr/bin/env bash
# PROVIN AutoDNA relejs: uzstādīšana uz Hetzner (Ubuntu/Debian). Palaist kā root no izpakošanas mapes.
# Neaiztiek citus servisus (8787 CSDD, 8788 mnt, 8789 listings, 8790 e.csdd, 8791 LTAB, 8792 CarVertical, iriss-vpn) un Caddy (maršrutu pievieno atsevišķi, sk. README).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_DIR="$SCRIPT_DIR"
cd /

APP_DIR="${APP_DIR:-/opt/provin-autodna}"
DATA_DIR="${DATA_DIR:-/var/lib/provin-autodna}"
ENV_FILE="${ENV_FILE:-/etc/provin-autodna.env}"
SERVICE_USER="provin-autodna"

if [[ $EUID -ne 0 ]]; then
  echo "Palaist kā root (sudo)." >&2
  exit 1
fi
if [[ -z "$SRC_DIR" || "$SRC_DIR" == "/" || "$SRC_DIR" == "$APP_DIR" || ! -f "$SRC_DIR/server.mjs" ]]; then
  echo "Nederīgs SRC_DIR=$SRC_DIR (nav server.mjs)." >&2
  exit 1
fi

echo "== Backup"
BACKUP="/root/backups/provin-autodna-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP"
[[ -d "$APP_DIR" ]] && tar -C "$APP_DIR" --exclude=node_modules -czf "$BACKUP/app.tgz" . || true
[[ -f "$ENV_FILE" ]] && install -m 600 "$ENV_FILE" "$BACKUP/provin-autodna.env" || true
cp /etc/systemd/system/provin-autodna*.service "$BACKUP/" 2>/dev/null || true

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
  echo "== Env paraugs -> $ENV_FILE (AIZPILDA galvenais: AUTODNA_RELAY_TOKEN, AUTODNA_WEB_EMAIL, AUTODNA_WEB_PASSWORD)"
  install -m 600 -o root -g root "$SRC_DIR/provin-autodna.env.example" "$ENV_FILE"
else
  echo "== $ENV_FILE jau ir, neaiztieku"
fi
chmod 600 "$ENV_FILE"

echo "== systemd"
install -m 644 "$SRC_DIR/systemd/provin-autodna-xvfb.service" /etc/systemd/system/
install -m 644 "$SRC_DIR/systemd/provin-autodna.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable provin-autodna-xvfb.service provin-autodna.service >/dev/null
if grep -qE '^AUTODNA_RELAY_TOKEN=.{16,}' "$ENV_FILE"; then
  systemctl restart provin-autodna-xvfb.service provin-autodna.service
  sleep 2
  curl -fsS http://127.0.0.1:8793/autodna/health || true
  echo
else
  echo "AUTODNA_RELAY_TOKEN vēl nav $ENV_FILE - serviss netiek startēts."
fi
echo "Gatavs. Backup: $BACKUP"
