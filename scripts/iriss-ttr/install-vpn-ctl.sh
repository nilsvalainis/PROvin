#!/usr/bin/env bash
# Uzstāda iriss-vpn-ctl Hetzner serverī. Palaist kā root no repo kopijas mapes: bash install-vpn-ctl.sh
# Pirms izmaiņām backup uz /root/backup-pavadzimes-<datums>/. Neaiztiek provin-csdd-*, provin-listings*, provin-mnt*, caddy.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
bk="/root/backup-pavadzimes-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$bk"
cp -a /etc/systemd/system/iriss-vpn.service "$bk/" 2>/dev/null || true
cp -a /etc/systemd/system/iriss-vpn.service.d "$bk/" 2>/dev/null || true
cp -a /etc/systemd/system/iriss-vpn-ctl.service "$bk/" 2>/dev/null || true
cp -a /root/iriss-ttr/ctl "$bk/ctl" 2>/dev/null || true
echo "backup: $bk"

if [ ! -f /etc/iriss-ttr/env ]; then
  echo "TRŪKST /etc/iriss-ttr/env (root 600): IRISS_API_BASE, IRISS_AIVARS_API_TOKEN, IRISS_VPN_IDLE_MIN" >&2
  exit 2
fi
chmod 600 /etc/iriss-ttr/env

mkdir -p /root/iriss-ttr/ctl /etc/systemd/system/iriss-vpn.service.d
install -m 644 "$here/csdd-sync-schedule.mjs" "$here/vpn-lease.mjs" "$here/vpn-ctl.mjs" /root/iriss-ttr/ctl/
install -m 644 "$here/iriss-vpn-no-restart.conf" /etc/systemd/system/iriss-vpn.service.d/10-no-restart.conf
install -m 644 "$here/iriss-vpn-ctl.service" /etc/systemd/system/iriss-vpn-ctl.service
systemctl daemon-reload
systemctl disable iriss-vpn >/dev/null 2>&1 || true
systemctl enable --now iriss-vpn-ctl
systemctl show iriss-vpn -p Restart -p UnitFileState
systemctl is-active iriss-vpn-ctl
curl -s http://127.0.0.1:9334/status; echo
