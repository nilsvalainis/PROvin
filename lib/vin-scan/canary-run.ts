import "server-only";

import { sendAdminPush } from "@/lib/admin-push";
import { readSourceHealth } from "@/lib/source-health-store";
import { sourcesFailingInARow } from "@/lib/source-health";
import {
  VIN_SCAN_CANARY_BATCHES,
  VIN_SCAN_CANARY_BUDGET_MS,
  VIN_SCAN_CANARY_CONCURRENCY,
  VIN_SCAN_CANARY_THECARAPI_MIN_GAP_MS,
  type VinScanCanaryBatch,
} from "@/lib/vin-scan/canary";
import {
  adminPushVinScanCanaryMessage,
  appendVinScanCanaryRun,
  classifyVinScanCanaryStatus,
  decideVinScanCanaryAlert,
  vinScanCanaryBroken,
  type VinScanCanaryBroken,
  type VinScanCanaryDoc,
  type VinScanCanaryResult,
  type VinScanCanaryRunRecord,
} from "@/lib/vin-scan/canary-alert";
import { readVinScanCanaryDoc, updateVinScanCanaryDoc } from "@/lib/vin-scan/monitor-store";
import { runVinScan } from "@/lib/vin-scan/run";
import { vinScanSourceTimeoutMs } from "@/lib/vin-scan/source-timeouts";
import { thecarapiVinScanEnabled } from "@/lib/vin-scan/thecarapi-flags";

/** Rezerve pēc partijas avotu ilgākā limita (relejs, Blob ieraksts). */
const BATCH_MARGIN_MS = 10_000;
/** Tik secīgu kļūdu reālos skenējumos (source_health) ir sabrukums. */
const REAL_SCAN_STREAK_MIN = 3;

function lastThecarapiCheckMs(doc: VinScanCanaryDoc): number {
  for (let i = doc.runs.length - 1; i >= 0; i -= 1) {
    const res = doc.runs[i]!.results.thecarapi_eu;
    if (res && res.state !== "skipped") return Date.parse(doc.runs[i]!.at);
  }
  return Number.NaN;
}

function skippedBatch(batch: VinScanCanaryBatch, status: string, summary: string): Record<string, VinScanCanaryResult> {
  const out: Record<string, VinScanCanaryResult> = {};
  for (const c of batch.checks) out[c.id] = { vin: batch.vin, state: "skipped", status, summary };
  return out;
}

async function runBatch(
  batch: VinScanCanaryBatch,
  deadlineMs: number,
  skip: ReadonlySet<string>,
): Promise<Record<string, VinScanCanaryResult>> {
  const out: Record<string, VinScanCanaryResult> = {};
  const checks = batch.checks.filter((c) => {
    if (!skip.has(c.id)) return true;
    out[c.id] = { vin: batch.vin, state: "skipped", status: "skipped", summary: "Šodien jau pārbaudīts vai izslēgts" };
    return false;
  });
  if (checks.length === 0) return out;
  const need = Math.max(...checks.map((c) => vinScanSourceTimeoutMs(c.id))) + BATCH_MARGIN_MS;
  if (Date.now() + need > deadlineMs) {
    return { ...out, ...skippedBatch({ ...batch, checks }, "budget", "Cron laika budžets beidzās") };
  }
  const started = Date.now();
  try {
    const rows = await runVinScan({ vin: batch.vin, sourceIds: checks.map((c) => c.id), ignoreBreaker: true });
    const byId = new Map(rows.map((r) => [r.id, r]));
    for (const c of checks) {
      const row = byId.get(c.id);
      const status = row?.status || "missing";
      out[c.id] = {
        vin: batch.vin,
        state: classifyVinScanCanaryStatus(c.expect, status),
        status,
        ...(row?.summary ? { summary: row.summary.slice(0, 160) } : {}),
      };
    }
  } catch (err) {
    const reason = err instanceof Error ? err.message.slice(0, 160) : "canary_failed";
    for (const c of checks) out[c.id] = { vin: batch.vin, state: "error", status: "error", summary: reason };
  }
  console.info(
    JSON.stringify({
      canary: true,
      vin: batch.vin,
      ms: Date.now() - started,
      results: Object.fromEntries(Object.entries(out).map(([id, r]) => [id, r.status])),
    }),
  );
  return out;
}

/** Partijas pa `concurrency` vienlaikus; katra sāk tikai, ja tās limits iekļaujas budžetā. */
async function runBatches(
  batches: readonly VinScanCanaryBatch[],
  deadlineMs: number,
  skip: ReadonlySet<string>,
): Promise<Record<string, VinScanCanaryResult>> {
  const results: Record<string, VinScanCanaryResult> = {};
  let next = 0;
  const worker = async () => {
    while (next < batches.length) {
      const batch = batches[next]!;
      next += 1;
      Object.assign(results, await runBatch(batch, deadlineMs, skip));
    }
  };
  await Promise.all(Array.from({ length: Math.min(VIN_SCAN_CANARY_CONCURRENCY, batches.length) }, worker));
  return results;
}

export async function runVinScanCanaryWithAlert(nowMs = Date.now()) {
  const deadlineMs = nowMs + VIN_SCAN_CANARY_BUDGET_MS;
  const before = await readVinScanCanaryDoc().catch(() => null);
  const skip = new Set<string>();
  if (!thecarapiVinScanEnabled()) skip.add("thecarapi_eu");
  const lastTca = before ? lastThecarapiCheckMs(before) : Number.NaN;
  if (Number.isFinite(lastTca) && nowMs - lastTca < VIN_SCAN_CANARY_THECARAPI_MIN_GAP_MS) skip.add("thecarapi_eu");

  const results = await runBatches(VIN_SCAN_CANARY_BATCHES, deadlineMs, skip);
  const run: VinScanCanaryRunRecord = { at: new Date(nowMs).toISOString(), results };
  const streaks = await readSourceHealth()
    .then((doc) => sourcesFailingInARow(doc, REAL_SCAN_STREAK_MIN))
    .catch(() => []);

  let broken: VinScanCanaryBroken[] = [];
  let fresh: VinScanCanaryBroken[] = [];
  let stored = true;
  try {
    ({ broken, fresh } = await updateVinScanCanaryDoc((current) => {
      const b = vinScanCanaryBroken(run, current.runs, streaks);
      const decision = decideVinScanCanaryAlert(b, current.alerted, run.at);
      const next = { ...appendVinScanCanaryRun(current, run), alerted: decision.next };
      return { value: { broken: b, fresh: decision.fresh }, next };
    }));
  } catch (err) {
    stored = false;
    console.error("[vin-scan-canary] store failed", err instanceof Error ? err.message : err);
  }

  // Paziņojums tikai pēc saglabāta stāvokļa: citādi katru dienu tas pats push.
  let alert: "ok" | "already_sent" | "sent" | "push_not_delivered" | "store_failed" = broken.length ? "already_sent" : "ok";
  if (!stored) alert = "store_failed";
  else if (fresh.length > 0) {
    const res = await sendAdminPush(adminPushVinScanCanaryMessage(fresh)).catch(() => ({ sent: 0 }));
    alert = res.sent > 0 ? "sent" : "push_not_delivered";
  }

  const checked = Object.values(results).filter((r) => r.state !== "skipped");
  return {
    ok: true as const,
    working: checked.filter((r) => r.state === "ok").length,
    checked: checked.length,
    results,
    broken,
    alert,
  };
}
