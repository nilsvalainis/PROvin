#!/usr/bin/env bash
# CSDD tirdzniecības reģistra ikdienas nolasījums (bez AI, tikai lasīšana). Palaiž systemd taimeris
# 03:30 Europe/Riga un ik 20 min līdz 05:50; pēc veiksmīga gājiena tajā dienā vairs nedarbojas.
#
# VPN: read-registry.mjs lieto to pašu lease kā pavadzīmes (scripts/iriss-ttr/vpn-ctl.mjs, POST 127.0.0.1:9334/lease).
# Nils lieto VPN ("Man vajag VPN", 409) vai VPN nav -> kods 75, nākamais mēģinājums pēc 20 min.
set -uo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${ENV_FILE:-/etc/csdd-registrs.env}"
# shellcheck disable=SC1090
[[ -f "$ENV_FILE" ]] && set -a && . "$ENV_FILE" && set +a

STATE_DIR="${REGISTRS_STATE_DIR:-/var/lib/csdd-registrs}"
DEADLINE="${REGISTRS_DEADLINE_HHMM:-0600}"
mkdir -p "$STATE_DIR"
chmod 700 "$STATE_DIR"

today="$(TZ=Europe/Riga date +%F)"
now_hhmm="$(TZ=Europe/Riga date +%H%M)"
done_mark="$STATE_DIR/done-$today"
log() { echo "[csdd-registrs] $(date -Is) $*"; }

if [[ -f "$done_mark" && "${1:-}" != "--force" ]]; then
  log "šodien jau izdarīts"
  exit 0
fi
if [[ "${1:-}" != "--force" && "$now_hhmm" > "$DEADLINE" ]]; then
  log "pēc $DEADLINE - šodien vairs nemēģinām"
  echo "{\"ok\":false,\"error\":\"missed_window\",\"date\":\"$today\"}" > "$STATE_DIR/missed-$today.json"
  exit 0
fi

RUN=(node "$APP_DIR/read-registry.mjs")

ARGS=()
[[ "${1:-}" == "--dry-run" || "${2:-}" == "--dry-run" ]] && ARGS+=(--dry-run)

timeout "${REGISTRS_TIMEOUT:-15m}" "${RUN[@]}" "${ARGS[@]}"
rc=$?
if [[ $rc -eq 0 && ${#ARGS[@]} -eq 0 ]]; then
  touch "$done_mark"
  log "gatavs"
elif [[ $rc -eq 75 ]]; then
  log "VPN/reģistrs nav pieejams - mēģināsim vēlāk"
else
  log "kļūda (kods $rc) - mēģināsim vēlāk, sk. $STATE_DIR/last-run.json"
fi
exit 0
