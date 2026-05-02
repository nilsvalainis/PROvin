#!/usr/bin/env bash
# Verificē admin sesiju, IRISS session-health un pēc vajadzības palaiž sync-now.
#
# Noklusējums (lokālais dev): admin / provin-local-dev
# Ja `.env.local` satur citu ADMIN_USERNAME, pirms palaišanas:
#   export SYNC_CHECK_ADMIN_USER="…" SYNC_CHECK_ADMIN_PASS="…"
#
# Bāzes URL:
#   export BASE=http://localhost:3040
#
set -euo pipefail

BASE="${BASE:-http://localhost:3040}"
JAR="${JAR:-/tmp/provin-admin-cookies.txt}"
TMPDIR="${TMPDIR:-/tmp}"
LOGIN_JSON="$TMPDIR/provin-login-body.json"
HEALTH_JSON="$TMPDIR/provin-session-health.json"
SYNC_JSON="$TMPDIR/provin-sync-now.json"

LOGIN_USER="${SYNC_CHECK_ADMIN_USER:-admin}"
LOGIN_PASS="${SYNC_CHECK_ADMIN_PASS:-provin-local-dev}"

login_payload() {
  export _SYNCHK_U="$LOGIN_USER" _SYNCHK_P="$LOGIN_PASS"
  python3 -c 'import json,os; print(json.dumps({"username":os.environ["_SYNCHK_U"],"password":os.environ["_SYNCHK_P"]}))'
  unset _SYNCHK_U _SYNCHK_P
}

echo "=== POST $BASE/api/admin/login (lietotājs: $LOGIN_USER) ==="
LOGIN_HTTP="$(curl -sS -o "$LOGIN_JSON" -w "%{http_code}" -c "$JAR" -X POST "$BASE/api/admin/login" \
  -H 'Content-Type: application/json' \
  -d "$(login_payload)")"
cat "$LOGIN_JSON"
echo ""
if [[ "$LOGIN_HTTP" != "200" ]]; then
  echo "Login failed (HTTP $LOGIN_HTTP)." >&2
  echo "Ja lietojat .env.local ar citu ADMIN_USERNAME, eksportējiet SYNC_CHECK_ADMIN_USER / SYNC_CHECK_ADMIN_PASS." >&2
  exit 1
fi

echo ""
echo "=== GET $BASE/api/admin/iriss-listings/session-health (pilna JSON) ==="
HEALTH_HTTP="$(curl -sS -o "$HEALTH_JSON" -w "%{http_code}" -b "$JAR" "$BASE/api/admin/iriss-listings/session-health")"
if [[ "$HEALTH_HTTP" != "200" ]]; then
  echo "session-health HTTP $HEALTH_HTTP (gaidīts 200). Ķermeņa sākums:" >&2
  head -c 400 "$HEALTH_JSON" >&2 || true
  echo "" >&2
  echo "Ja tas ir HTML 404, pārlādējiet serveri no šī repozitorija (vecā instance var neietvert /api/admin/iriss-listings/*)." >&2
  exit 1
fi
if ! python3 -m json.tool <"$HEALTH_JSON" 2>/dev/null; then
  echo "Atbilde nav derīgs JSON. Pirmais fragments:" >&2
  head -c 600 "$HEALTH_JSON" >&2 || true
  echo "" >&2
  exit 1
fi

echo ""
echo "=== Platformu kopsavilkums ==="
python3 << 'PY' <"$HEALTH_JSON"
import json, sys
data = json.load(sys.stdin)
for it in data.get("items", []):
    p = it.get("platform", "?")
    st = it.get("status", "?")
    note = it.get("note", "")
    if st == "login_required":
        tag = "SESSION ERROR (login_required)"
    elif st == "expiring_soon":
        tag = "brīdinājums (expiring_soon)"
    else:
        tag = "ok"
    print(f"  [{tag}] {p}: {st} — {note}")
PY

HAS_LR="$(python3 -c "import json; d=json.load(open('$HEALTH_JSON')); print(1 if any(i.get('status')=='login_required' for i in d.get('items',[])) else 0)")"

echo ""
if [[ "$HAS_LR" == "1" ]]; then
  echo "=== Sync nav palaists: vismaz vienai platformai statuss ir 'login_required' ==="
  echo ""
  echo "=== Trūkstošo / jāpārbauda env atslēgas (no .env.local, ja fails eksistē) ==="
  ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  ENV_FILE="$ROOT/.env.local"
  if [[ -f "$ENV_FILE" ]]; then
    python3 << PY
from pathlib import Path

env_path = Path("$ENV_FILE")
lines = env_path.read_text(encoding="utf-8", errors="replace").splitlines()

def val(key: str) -> str:
    prefix = key + "="
    for ln in lines:
        s = ln.strip()
        if not s or s.startswith("#"):
            continue
        if s.startswith(prefix):
            return s[len(prefix) :].strip().strip('"').strip("'")
    return ""

def has_auth(platform: str) -> bool:
    pfx = f"IRISS_LISTINGS_{platform.upper()}"
    auth = val(f"{pfx}_AUTH_HEADER")
    cookie = val(f"{pfx}_COOKIE")
    login_url = val(f"{pfx}_LOGIN_URL")
    username = val(f"{pfx}_LOGIN_USERNAME")
    password = val(f"{pfx}_LOGIN_PASSWORD")
    return bool(auth or cookie or (login_url and username and password))

for plat in ("mobile", "autobid", "openline", "auto1"):
    pfx = f"IRISS_LISTINGS_{plat.upper()}"
    if has_auth(plat):
        print(f"  {plat}: ir AUTH_HEADER vai COOKIE vai pilns LOGIN_* bloks")
    else:
        print(
            f"  {plat}: trūkst — iestatiet {pfx}_COOKIE un/vai {pfx}_AUTH_HEADER "
            f"un/vai {pfx}_LOGIN_URL + {pfx}_LOGIN_USERNAME + {pfx}_LOGIN_PASSWORD"
        )
PY
  else
    echo "  (.env.local nav mapē $ROOT — platformu atslēgas meklējiet Vercel / citā env failā)"
  fi
  exit 2
fi

echo "=== POST $BASE/api/admin/iriss-listings/sync-now (pilna JSON atbilde) ==="
SYNC_HTTP="$(curl -sS -o "$SYNC_JSON" -w "%{http_code}" -b "$JAR" -X POST "$BASE/api/admin/iriss-listings/sync-now")"
python3 -m json.tool <"$SYNC_JSON" 2>/dev/null || cat "$SYNC_JSON"
echo "(HTTP $SYNC_HTTP)"
