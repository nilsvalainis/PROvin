#!/usr/bin/env bash
# PROVIN IRISS LIST relejs: uzstādīšana uz Hetzner (Ubuntu/Debian). Palaist kā root.
# Neaiztiek CSDD (8787), mnt.ee (8788) servisus un Caddy. Caddy maršrutu pievieno atsevišķi (skat. README).
set -euo pipefail
# npm no /root dod EACCES, ja skriptu palaiž no root mājas mapes.
cd /

APP_DIR="${APP_DIR:-/opt/provin-listings}"
DATA_DIR="${DATA_DIR:-/var/lib/provin-listings}"
ENV_FILE="${ENV_FILE:-/etc/provin-listings.env}"
SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_USER="provin-listings"

if [[ $EUID -ne 0 ]]; then
  echo "Palaist kā root (sudo)." >&2
  exit 1
fi

echo "== Pakotnes (Xvfb, x11vnc, noVNC, Chrome atkarības)"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq xvfb x11vnc novnc websockify fonts-liberation fonts-noto-color-emoji ca-certificates curl >/dev/null

if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | sed 's/v\([0-9]*\).*/\1/')" -lt 20 ]]; then
  echo "== Node 20 (NodeSource)"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi
echo "node $(node -v), npm $(npm -v)"

echo "== Sistēmas lietotājs un mapes"
id -u "$SERVICE_USER" >/dev/null 2>&1 || useradd --system --home "$DATA_DIR" --shell /usr/sbin/nologin "$SERVICE_USER"
mkdir -p "$APP_DIR" "$DATA_DIR/profiles/openlane" "$DATA_DIR/profiles/auto1" "$DATA_DIR/profiles/autobid" "$DATA_DIR/ms-playwright"
chown -R "$SERVICE_USER:$SERVICE_USER" "$DATA_DIR"
chmod 750 "$DATA_DIR"

echo "== Kods -> $APP_DIR"
rsync -a --delete --exclude node_modules --exclude '.git' "$SRC_DIR/" "$APP_DIR/"
chown -R "$SERVICE_USER:$SERVICE_USER" "$APP_DIR"

echo "== npm install + Playwright Chromium (kā $SERVICE_USER)"
sudo -u "$SERVICE_USER" env HOME="$DATA_DIR" PLAYWRIGHT_BROWSERS_PATH="$DATA_DIR/ms-playwright" npm --prefix "$APP_DIR" install --omit=dev --no-audit --no-fund
PLAYWRIGHT_BROWSERS_PATH="$DATA_DIR/ms-playwright" npx --prefix "$APP_DIR" playwright install-deps chromium
sudo -u "$SERVICE_USER" env HOME="$DATA_DIR" PLAYWRIGHT_BROWSERS_PATH="$DATA_DIR/ms-playwright" npx --prefix "$APP_DIR" playwright install chromium

if command -v google-chrome >/dev/null 2>&1 || command -v google-chrome-stable >/dev/null 2>&1; then
  echo "Sistēmas Google Chrome atrasts: relejs lietos channel=chrome (kā /opt/provin-mnt)."
else
  echo "Sistēmas Google Chrome nav: relejs lietos Playwright Chromium. Ja Openlane rāda Cloudflare challenge, uzstādi google-chrome-stable."
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "== Env paraugs -> $ENV_FILE (AIZPILDI tokenu un paroles!)"
  install -m 600 -o root -g root "$SRC_DIR/provin-listings.env.example" "$ENV_FILE"
else
  echo "== $ENV_FILE jau eksistē, neaiztieku"
fi
chmod 600 "$ENV_FILE"

echo "== systemd"
install -m 644 "$SRC_DIR/systemd/provin-listings-xvfb.service" /etc/systemd/system/
install -m 644 "$SRC_DIR/systemd/provin-listings.service" /etc/systemd/system/
install -m 644 "$SRC_DIR/systemd/provin-listings-novnc.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now provin-listings-xvfb.service
systemctl enable --now provin-listings.service
# noVNC nestartē līdz ar boot: tikai ielogošanās laikā (systemctl start provin-listings-novnc).

echo
echo "Gatavs. Pārbaude:"
echo "  systemctl status provin-listings --no-pager"
echo "  curl -s http://127.0.0.1:8789/listings/health | head -c 600"
echo "Ielogošanās: /admin/iriss/sludinajumi poga Ielogoties (relejs pats paceļ noVNC). SSH tunelis paliek kā rezerve."
