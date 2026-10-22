/**
 * VIN SCAN kanārijputna novērtējums un push dedupe (tīras funkcijas, bez I/O).
 */
import type { CronNotifyEntries } from "@/lib/cron-notify-entries";
import type { AdminPushMessage } from "@/lib/admin-push-shared";

export type VinScanCanaryRun = {
  vin: string;
  statVinRecord: boolean;
  /** sourceId -> status (found/none/error/timeout/...); `missing`, ja avots neatgrieza rezultātu. */
  statuses: Record<string, string>;
  /** Viss skenējums izmeta kļūdu. */
  error?: string;
};

export type VinScanCanaryFailure = { vin: string; sourceId: string; status: string };

const BROKEN = new Set(["error", "timeout", "blocked", "unknown", "missing"]);

/** Vienam un tam pašam kļūmju kopumam push ne biežāk kā reizi 3 dienās. */
export const VIN_SCAN_CANARY_ALERT_REPEAT_MS = 3 * 24 * 60 * 60 * 1000;

export function evaluateVinScanCanary(runs: readonly VinScanCanaryRun[], sourceIds: readonly string[]): VinScanCanaryFailure[] {
  const out: VinScanCanaryFailure[] = [];
  for (const run of runs) {
    if (run.error) {
      out.push({ vin: run.vin, sourceId: "scan", status: "error" });
      continue;
    }
    for (const id of sourceIds) {
      const status = run.statuses[id] ?? "missing";
      /** WMI dekodēšana vienmēr ir lokāla - tai jāatrod. */
      const decodeMissed = id === "vin_decode" && status !== "found";
      /** Zināmais stat.vin ieraksts pazudis. `browser_only` nav kļūme: serveris stat.vin nelasa (403), dati nāk no pārlūka. */
      const recordLost = id === "stat_vin" && run.statVinRecord && status === "none";
      if (BROKEN.has(status) || decodeMissed || recordLost) out.push({ vin: run.vin, sourceId: id, status });
    }
  }
  return out;
}

/** Paraksts: kuri avoti krīt (bez VIN), lai tas pats bojājums nedod jaunu push. */
export function canaryFailureSignature(failures: readonly VinScanCanaryFailure[]): string {
  return [...new Set(failures.map((f) => f.sourceId))].sort().join(",");
}

export type CanaryAlertDecision =
  | { send: true; signature: string; next: CronNotifyEntries }
  | { send: false; reason: "ok" | "already_sent"; next: CronNotifyEntries };

export function decideCanaryAlert(
  failures: readonly VinScanCanaryFailure[],
  sent: CronNotifyEntries,
  nowMs: number,
): CanaryAlertDecision {
  /** Viss zaļš - notīra stāvokli, lai nākamā kļūme atkal paziņo uzreiz. */
  if (failures.length === 0) return { send: false, reason: "ok", next: {} };
  const signature = canaryFailureSignature(failures);
  const last = Date.parse(sent[signature] ?? "");
  if (Number.isFinite(last) && nowMs - last < VIN_SCAN_CANARY_ALERT_REPEAT_MS) {
    return { send: false, reason: "already_sent", next: sent };
  }
  return { send: true, signature, next: { [signature]: new Date(nowMs).toISOString() } };
}

const SOURCE_LABEL: Record<string, string> = { vin_decode: "VIN dekodēšana", stat_vin: "stat.vin", scan: "skenēšana" };

export function adminPushVinScanCanaryMessage(failures: readonly VinScanCanaryFailure[]): AdminPushMessage {
  const ids = canaryFailureSignature(failures).split(",").filter(Boolean);
  return {
    title: "VIN SCAN avots nestrādā",
    body: `Krīt: ${ids.map((id) => SOURCE_LABEL[id] ?? id).join(", ")} (${failures.length} pārbaudes)`,
    url: "/admin/vin-scan",
    tag: "vin-scan-canary",
    audience: "pro",
  };
}
