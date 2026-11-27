#!/usr/bin/env bash
# CheckThisReg -> PROVIN darbinieks: uzstādīšana uz Hetzner (root). Uzliek kodu + taimeri; pirmais gājiens -
# bāzes līnija (esošie e-pasti tikai atzīmēti, uz PROVIN nekas netiek sūtīts).
# Backup pirms izmaiņām: /root/backups/provin-ctr-inbox-<datums>/
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd /
APP_DIR="${APP_DIR:-/opt/provin-ctr-inbox}"
ENV_FILE="${ENV_FILE:-/etc/provin-ctr-inbox.env}"
STATE_DIR="${CTR_STATE_DIR:-/var/lib/provin-ctr-inbox}"
UNIT_DIR=/etc/systemd/system

[[ $EUID -eq 0 ]] || { echo "Palaist kā root." >&2; exit 1; }
[[ -f "$SCRIPT_DIR/ctr_inbox.py" && "$SCRIPT_DIR" != "$APP_DIR" && "$SCRIPT_DIR" != "/" ]] || { echo "Nederīgs SCRIPT_DIR=$SCRIPT_DIR" >&2; exit 1; }
[[ -n "$APP_DIR" && "$APP_DIR" != "/" ]] || { echo "Nederīgs APP_DIR" >&2; exit 1; }
command -v python3 >/dev/null || { echo "Nav python3" >&2; exit 1; }
command -v flock >/dev/null || { echo "Nav flock (util-linux)" >&2; exit 1; }

BACKUP="/root/backups/provin-ctr-inbox-$(date +%Y-%m-%d-%H%M%S)"
echo "== Backup -> $BACKUP"
mkdir -p "$BACKUP"
chmod 700 "$BACKUP"
for f in "$UNIT_DIR/provin-ctr-inbox.service" "$UNIT_DIR/provin-ctr-inbox.timer" "$ENV_FILE"; do
  [[ -e "$f" ]] && cp -a "$f" "$BACKUP/"
done
[[ -d "$APP_DIR" ]] && tar -C "$APP_DIR" -czf "$BACKUP/app.tgz" .
[[ -d "$STATE_DIR" ]] && tar -C "$STATE_DIR" -czf "$BACKUP/state.tgz" .
echo "backup gatavs: $(ls "$BACKUP" | tr '\n' ' ')"

echo "== Kods -> $APP_DIR"
mkdir -p "$APP_DIR"
find "$APP_DIR" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
tar -C "$SCRIPT_DIR" --exclude=__pycache__ --exclude=.git -cf - . | tar -C "$APP_DIR" -xf -
chmod 750 "$APP_DIR/run.sh" "$APP_DIR/ctr_inbox.py"
mkdir -p "$STATE_DIR"
chmod 700 "$STATE_DIR"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "== $ENV_FILE no parauga (aizpildi CTR_INGEST_TOKEN, CTR_IMAP_USER, CTR_OP_ITEM)"
  install -m 600 "$APP_DIR/provin-ctr-inbox.env.example" "$ENV_FILE"
fi
chmod 600 "$ENV_FILE"

echo "== Testi"
(cd "$APP_DIR" && python3 -m unittest test_ctr_inbox.py 2>&1 | tail -2)

echo "== systemd taimeris"
install -m 644 "$APP_DIR/systemd/provin-ctr-inbox.service" "$UNIT_DIR/provin-ctr-inbox.service"
install -m 644 "$APP_DIR/systemd/provin-ctr-inbox.timer" "$UNIT_DIR/provin-ctr-inbox.timer"
systemctl daemon-reload
if grep -qE '^CTR_INGEST_TOKEN=.{24,}' "$ENV_FILE" && grep -qE '^CTR_IMAP_USER=.+' "$ENV_FILE" && grep -qE '^CTR_OP_ITEM=.+' "$ENV_FILE"; then
  if [[ ! -f "$STATE_DIR/seen.json" ]]; then
    echo "== Bāzes līnija (esošie CheckThisReg e-pasti -> apstrādāti, nekas netiek sūtīts)"
    "$APP_DIR/run.sh" --baseline
  fi
  systemctl enable --now provin-ctr-inbox.timer
  systemctl list-timers provin-ctr-inbox.timer --no-pager || true
  echo "Gatavs. Žurnāls: journalctl -u provin-ctr-inbox -n 50"
else
  echo "!! $ENV_FILE nav aizpildīts (CTR_INGEST_TOKEN, CTR_IMAP_USER, CTR_OP_ITEM) - taimeris NAV ieslēgts. Aizpildi un palaid install.sh vēlreiz."
fi
