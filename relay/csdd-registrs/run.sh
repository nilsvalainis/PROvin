#!/usr/bin/env bash
# CSDD tirdzniecības reģistra ikdienas nolasījums (bez AI, tikai lasīšana). Palaiž systemd taimeris
# 03:30 Europe/Riga un ik 20 min līdz 05:50; pēc veiksmīga gājiena tajā dienā vairs nedarbojas.
#
# VPN: nedublē VPN loģiku. Ja ir VPN_LEASE_CMD (kopīgā lease komanda no pavadzīmju ātruma darba),
#   `$VPN_LEASE_CMD acquire <holder> <ttl_sek>` -> 0 = iegūts, cits = aizņemts (piem. "Man vajag VPN") -> izlaižam;
#   `$VPN_LEASE_CMD keepalive <holder>` (read-registry.mjs ik 60 s), `$VPN_LEASE_CMD release <holder>` beigās.
# Ja VPN_LEASE_CMD nav: tikai neaizņemta kopīgā slēdzene `flock -n $IRISS_VPN_LOCK` (citi VPN lietotāji to pašu).
set -uo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${ENV_FILE:-/etc/csdd-registrs.env}"
# shellcheck disable=SC1090
[[ -f "$ENV_FILE" ]] && set -a && . "$ENV_FILE" && set +a

STATE_DIR="${REGISTRS_STATE_DIR:-/var/lib/csdd-registrs}"
HOLDER="${VPN_LEASE_HOLDER:-csdd-registrs}"
LEASE_TTL="${VPN_LEASE_TTL_SEC:-1200}"
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

released=0
release() {
  [[ $released -eq 1 ]] && return
  released=1
  if [[ -n "${VPN_LEASE_CMD:-}" ]]; then
    /bin/sh -c "$VPN_LEASE_CMD release $HOLDER" >/dev/null 2>&1 || true
  fi
}
trap release EXIT

if [[ -n "${VPN_LEASE_CMD:-}" ]]; then
  if ! /bin/sh -c "$VPN_LEASE_CMD acquire $HOLDER $LEASE_TTL"; then
    log "VPN aizņemts - mēģināsim pēc 20 min"
    released=1
    exit 0
  fi
  export VPN_LEASE_CMD VPN_LEASE_HOLDER="$HOLDER"
  RUN=(node "$APP_DIR/read-registry.mjs")
else
  LOCK="${IRISS_VPN_LOCK:-/run/lock/iriss-vpn.lock}"
  exec 9>"$LOCK"
  if ! flock -n 9; then
    log "VPN slēdzene aizņemta - mēģināsim pēc 20 min"
    exit 0
  fi
  RUN=(node "$APP_DIR/read-registry.mjs")
fi

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
