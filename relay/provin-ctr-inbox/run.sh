#!/usr/bin/env bash
# CheckThisReg -> PROVIN: viens gājiens (systemd taimeris ik 10 min). Paroles netiek logotas.
set -uo pipefail
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${ENV_FILE:-/etc/provin-ctr-inbox.env}"
# shellcheck disable=SC1090
[[ -f "$ENV_FILE" ]] && set -a && . "$ENV_FILE" && set +a
STATE_DIR="${CTR_STATE_DIR:-/var/lib/provin-ctr-inbox}"
mkdir -p "$STATE_DIR"
chmod 700 "$STATE_DIR"
# Viens gājiens vienlaikus (garš AI solis serverī var aizņemt līdz 5 min).
exec 9>"$STATE_DIR/.lock"
flock -n 9 || { echo "[ctr-inbox] iepriekšējais gājiens vēl darbojas"; exit 0; }
timeout "${CTR_TIMEOUT:-25m}" python3 -I "$APP_DIR/ctr_inbox.py" "$@"
rc=$?
[[ $rc -ne 0 ]] && echo "[ctr-inbox] kļūda (kods $rc) - nākamais gājiens pēc 10 min"
exit 0
