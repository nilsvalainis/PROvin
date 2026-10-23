#!/usr/bin/env bash
# Uzstāda refill.js + save.js + sync.js (tikai lasa) + annul.js (tikai ar IRISS_WAYBILL_ANNUL_LIVE=1) uz /root/iriss-ttr
# (worker tos palaiž). Palaist kā root: bash install-waybill-scripts.sh
# Esošos failus nepārraksta bez backup. waybill-adapter.cjs (CSDD soļi) tiek atjaunots; waybill-ui.json tikai, ja tā vēl nav.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
ttr=/root/iriss-ttr
bk="/root/backup-pavadzimes-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$bk"
for f in refill.js save.js sync.js annul.js waybill-ui.json waybill-adapter.cjs ctl/waybill-run.mjs ctl/waybill-driver.mjs ctl/waybill-scripts-core.mjs ctl/csdd-waybills-core.mjs ctl/csdd-check.mjs; do
  [ -e "$ttr/$f" ] && { mkdir -p "$bk/$(dirname "$f")"; cp -a "$ttr/$f" "$bk/$f"; }
done
echo "backup: $bk"
mkdir -p "$ttr/ctl" "$ttr/state/waybill-jobs" "$ttr/pdf"
chmod 700 "$ttr/state" "$ttr/state/waybill-jobs"
install -m 644 "$here/waybill-run.mjs" "$here/waybill-driver.mjs" "$here/waybill-scripts-core.mjs" "$here/csdd-waybills-core.mjs" "$here/csdd-check.mjs" "$ttr/ctl/"
install -m 755 "$here/refill.js" "$here/save.js" "$here/sync.js" "$here/annul.js" "$ttr/"
install -m 644 "$here/waybill-ui.example.json" "$ttr/ctl/"
install -m 644 "$here/waybill-adapter.cjs" "$ttr/waybill-adapter.cjs"
[ -e "$ttr/waybill-ui.json" ] || install -m 600 "$here/waybill-ui.example.json" "$ttr/waybill-ui.json"
for c in "$ttr/.env" "$ttr/creds" "$ttr/creds-autoapkope-dza"; do [ -e "$c" ] && echo "piekļuve: $c ir" || echo "piekļuve: $c NAV"; done
node --check "$ttr/refill.js" && node --check "$ttr/save.js" && node --check "$ttr/sync.js" && node --check "$ttr/annul.js" && node --check "$ttr/ctl/waybill-run.mjs" && node --check "$ttr/waybill-adapter.cjs"
node -e 'import("/root/iriss-ttr/ctl/waybill-scripts-core.mjs").then(() => console.log("core ok"))'
echo "Pārbaude bez CSDD: IRISS_JOB_JSON='{}' node $ttr/refill.js  (gaidāms {\"ok\":false,...})"
