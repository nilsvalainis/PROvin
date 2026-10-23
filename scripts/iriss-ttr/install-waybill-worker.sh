#!/usr/bin/env bash
# Uzstāda iriss-waybill-worker (pēc install-vpn-ctl.sh). Palaist kā root: bash install-waybill-worker.sh
# Noklusējumā DRY-RUN (tikai logo, ko darītu). Īstai izrakstīšanai /etc/iriss-ttr/env: IRISS_WAYBILL_WORKER_LIVE=1
# un Vercel IRISS_WAYBILL_AUTO=1. Pirms tam pārbaudi refill.js/save.js līgumu (README.md).
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
bk="/root/backup-pavadzimes-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$bk"
cp -a /etc/systemd/system/iriss-waybill-worker.service "$bk/" 2>/dev/null || true
cp -a /root/iriss-ttr/ctl "$bk/ctl" 2>/dev/null || true
echo "backup: $bk"
[ -f /etc/iriss-ttr/env ] || { echo "TRŪKST /etc/iriss-ttr/env" >&2; exit 2; }
mkdir -p /root/iriss-ttr/ctl
install -m 644 "$here/csdd-sync-schedule.mjs" "$here/waybill-worker-core.mjs" "$here/waybill-worker.mjs" /root/iriss-ttr/ctl/
install -m 644 "$here/iriss-waybill-worker.service" /etc/systemd/system/iriss-waybill-worker.service
systemctl daemon-reload
systemctl enable --now iriss-waybill-worker
systemctl is-active iriss-waybill-worker
journalctl -u iriss-waybill-worker -n 5 --no-pager
