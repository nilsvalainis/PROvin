#!/usr/bin/env bash
# Uzstāda refill.js + save.js uz /root/iriss-ttr (worker tos palaiž). Palaist kā root: bash install-waybill-scripts.sh
# Esošos failus nepārraksta bez backup; waybill-ui.json/waybill-adapter.cjs nekad nepārraksta (tos aizpilda ar roku).
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
ttr=/root/iriss-ttr
bk="/root/backup-pavadzimes-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$bk"
for f in refill.js save.js waybill-ui.json waybill-adapter.cjs ctl/waybill-run.mjs ctl/waybill-driver.mjs ctl/waybill-scripts-core.mjs; do
  [ -e "$ttr/$f" ] && { mkdir -p "$bk/$(dirname "$f")"; cp -a "$ttr/$f" "$bk/$f"; }
done
echo "backup: $bk"
mkdir -p "$ttr/ctl" "$ttr/state/waybill-jobs" "$ttr/pdf"
chmod 700 "$ttr/state" "$ttr/state/waybill-jobs"
install -m 644 "$here/waybill-run.mjs" "$here/waybill-driver.mjs" "$here/waybill-scripts-core.mjs" "$ttr/ctl/"
install -m 755 "$here/refill.js" "$here/save.js" "$ttr/"
install -m 644 "$here/waybill-ui.example.json" "$here/waybill-adapter.example.cjs" "$ttr/ctl/"
[ -e "$ttr/waybill-ui.json" ] || echo "JĀAIZPILDA: cp $ttr/ctl/waybill-ui.example.json $ttr/waybill-ui.json && nano $ttr/waybill-ui.json"
node --check "$ttr/refill.js" && node --check "$ttr/save.js" && node --check "$ttr/ctl/waybill-run.mjs"
node -e 'import("/root/iriss-ttr/ctl/waybill-scripts-core.mjs").then(() => console.log("core ok"))'
echo "Pārbaude bez CSDD: IRISS_JOB_JSON='{}' node $ttr/refill.js  (gaidāms {\"ok\":false,...})"
