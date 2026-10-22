import "server-only";

import { sendAdminPush } from "@/lib/admin-push";
import { isCronNotifyStoreDurable, readCronNotifyEntries, writeCronNotifyEntries } from "@/lib/cron-notify-dedupe-store";
import { VIN_SCAN_CANARY_VINS, vinScanCanarySourceIds } from "@/lib/vin-scan/canary";
import {
  adminPushVinScanCanaryMessage,
  decideCanaryAlert,
  evaluateVinScanCanary,
  type VinScanCanaryRun,
} from "@/lib/vin-scan/canary-alert";
import { isPaidVinScanSourceId } from "@/lib/vin-scan/free-sources";
import { runVinScan } from "@/lib/vin-scan/run";

const SCOPE = "vin-scan-canary";

export async function runVinScanCanaryWithAlert(nowMs = Date.now()) {
  const sourceIds = vinScanCanarySourceIds().filter((id) => !isPaidVinScanSourceId(id));
  const runs: VinScanCanaryRun[] = [];
  for (const row of VIN_SCAN_CANARY_VINS) {
    const started = Date.now();
    try {
      const indicators = await runVinScan({ vin: row.vin, sourceIds });
      const statuses: Record<string, string> = {};
      for (const item of indicators) statuses[item.id] = item.status || "missing";
      runs.push({ vin: row.vin, statVinRecord: row.statVinRecord, statuses });
      console.info(JSON.stringify({ canary: true, vin: row.vin, statuses, ms: Date.now() - started }));
    } catch (err) {
      const reason = err instanceof Error ? err.message : "canary_failed";
      runs.push({ vin: row.vin, statVinRecord: row.statVinRecord, statuses: {}, error: reason });
      console.info(JSON.stringify({ canary: true, vin: row.vin, status: "error", reason, ms: Date.now() - started }));
    }
  }

  const failures = evaluateVinScanCanary(runs, sourceIds);
  let alert: "ok" | "already_sent" | "sent" | "push_not_delivered" | "store_not_durable" = "ok";
  if (failures.length > 0 && !isCronNotifyStoreDurable()) {
    alert = "store_not_durable";
  } else {
    const sent = isCronNotifyStoreDurable() ? await readCronNotifyEntries(SCOPE) : {};
    const decision = decideCanaryAlert(failures, sent, nowMs);
    if (decision.send) {
      const res = await sendAdminPush(adminPushVinScanCanaryMessage(failures));
      if (res.sent > 0) {
        await writeCronNotifyEntries(SCOPE, decision.next);
        alert = "sent";
      } else {
        alert = "push_not_delivered";
      }
    } else {
      alert = decision.reason;
      if (decision.reason === "ok" && Object.keys(sent).length > 0) await writeCronNotifyEntries(SCOPE, {});
    }
  }

  return { ok: true as const, sources: sourceIds, runs, failures, alert };
}
