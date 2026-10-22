#!/usr/bin/env bash
# CSDD reģistra nolasījums: uzstādīšana uz Hetzner (root). NEPALAIŽ nolasījumu - tikai uzliek kodu un taimeri.
# Pirms jebkuras izmaiņas: backup uz /root/backups/registrs-cron-<datums>/ (crontab, systemd vienības, kods, env).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd /
APP_DIR="${APP_DIR:-/opt/csdd-registrs}"
ENV_FILE="${ENV_FILE:-/etc/csdd-registrs.env}"
STATE_DIR="${REGISTRS_STATE_DIR:-/var/lib/csdd-registrs}"
UNIT_DIR=/etc/systemd/system

[[ $EUID -eq 0 ]] || { echo "Palaist kā root." >&2; exit 1; }
[[ -f "$SCRIPT_DIR/read-registry.mjs" && "$SCRIPT_DIR" != "$APP_DIR" && "$SCRIPT_DIR" != "/" ]] || { echo "Nederīgs SCRIPT_DIR=$SCRIPT_DIR" >&2; exit 1; }
[[ -n "$APP_DIR" && "$APP_DIR" != "/" ]] || { echo "Nederīgs APP_DIR" >&2; exit 1; }

BACKUP="/root/backups/registrs-cron-$(date +%Y-%m-%d-%H%M%S)"
echo "== Backup -> $BACKUP"
mkdir -p "$BACKUP"
chmod 700 "$BACKUP"
crontab -l > "$BACKUP/crontab-root.txt" 2>/dev/null || echo "(nav root crontab)" > "$BACKUP/crontab-root.txt"
for f in "$UNIT_DIR/csdd-registrs.service" "$UNIT_DIR/csdd-registrs.timer" "$ENV_FILE"; do
  [[ -e "$f" ]] && cp -a "$f" "$BACKUP/"
done
[[ -d "$APP_DIR" ]] && tar -C "$APP_DIR" -czf "$BACKUP/app.tgz" .
systemctl list-timers --all --no-pager > "$BACKUP/timers-before.txt" 2>&1 || true
echo "backup gatavs: $(ls "$BACKUP" | tr '\n' ' ')"

echo "== Kods -> $APP_DIR"
mkdir -p "$APP_DIR"
find "$APP_DIR" -mindepth 1 -maxdepth 1 ! -name node_modules -exec rm -rf {} +
tar -C "$SCRIPT_DIR" --exclude=node_modules --exclude=.git -cf - . | tar -C "$APP_DIR" -xf -
chmod 750 "$APP_DIR/run.sh"
mkdir -p "$STATE_DIR"
chmod 700 "$STATE_DIR"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "== $ENV_FILE no parauga (aizpildi PROVIN_REGISTRS_TOKEN un REGISTRS_LIST_URL_*)"
  install -m 600 "$APP_DIR/csdd-registrs.env.example" "$ENV_FILE"
fi

if ! node -e 'import("playwright")' --input-type=module 2>/dev/null; then
  ttr="${IRISS_TTR_DIR:-/root/iriss-ttr}"
  if [[ -d "$ttr/node_modules/playwright" ]]; then
    echo "== Playwright: lietos $ttr/node_modules (tas pats, ko iriss-ttr)"
  else
    echo "!! Playwright nav atrasts ne $APP_DIR, ne $ttr. Uzstādi: npm --prefix $APP_DIR install playwright && npx --prefix $APP_DIR playwright install chromium" >&2
  fi
fi

echo "== systemd taimeris (crontab netiek mainīts)"
install -m 644 "$APP_DIR/systemd/csdd-registrs.service" "$UNIT_DIR/csdd-registrs.service"
install -m 644 "$APP_DIR/systemd/csdd-registrs.timer" "$UNIT_DIR/csdd-registrs.timer"
systemctl daemon-reload
systemctl enable --now csdd-registrs.timer
systemctl list-timers csdd-registrs.timer --no-pager || true
echo "Gatavs. Pirmais gājiens ar roku: $APP_DIR/run.sh --force --dry-run  (tad bez --dry-run)"
