/**
 * VIN SCAN uzraudzības novērtējums, vēsture un paziņojumu lēmums (tīras funkcijas, bez I/O).
 *
 * Avota stāvoklis vienā palaišanā: ok / nav datu / kļūda / izlaists.
 * Sabrucis (paziņo vienreiz, kamēr nav atguvies):
 *  - kļūda vai «nav datu» 2 palaišanās pēc kārtas (≈ 2 dienas),
 *  - zelta VIN pēkšņi bez datiem (iepriekš bija dati, tagad nav),
 *  - reālos skenējumos ≥3 kļūdas pēc kārtas (`source_health`).
 */
import type { AdminPushMessage } from "@/lib/admin-push-shared";
import { isVinScanSourceId, vinScanCatalogItem } from "@/lib/vin-scan/catalog";
import type { VinScanCanaryExpect } from "@/lib/vin-scan/canary";

export type VinScanCanaryState = "ok" | "no_data" | "error" | "skipped";

export type VinScanCanaryResult = {
  vin: string;
  state: VinScanCanaryState;
  /** VIN SCAN statuss (found / none / timeout / ...) vai `missing`. */
  status: string;
  summary?: string;
};

export type VinScanCanaryRunRecord = { at: string; results: Record<string, VinScanCanaryResult> };

export type VinScanCanaryDoc = {
  version: 1;
  runs: VinScanCanaryRunRecord[];
  /** Sabrukušie avoti, par kuriem jau paziņots: atslēga → paziņojuma laiks. */
  alerted: Record<string, string>;
};

export type VinScanCanaryBrokenReason = "error_2x" | "no_data_2x" | "no_data_after_data" | "real_scans";

export type VinScanCanaryBroken = { key: string; id: string; reason: VinScanCanaryBrokenReason; detail?: string };

/** Glabā tik pēdējās palaišanas (~2 nedēļas). */
export const VIN_SCAN_CANARY_KEEP_RUNS = 14;
/** Iepriekšējā palaišana skaitās «vakardiena», ja nav vecāka par 3 dienām. */
export const VIN_SCAN_CANARY_PREV_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;
/** Rīta kopsavilkumā pēdējā palaišana jaunāka par 36 h, citādi «nav palaista». */
export const VIN_SCAN_CANARY_FRESH_MS = 36 * 60 * 60 * 1000;

const ERROR_STATUSES = new Set(["error", "timeout", "blocked", "unknown", "missing"]);
/** Nav ko pārbaudīt (nav atslēgas / karogs izslēgts / pārlūka josla / budžets). */
const SKIP_STATUSES = new Set(["skipped", "config_missing", "browser_only", "manual", "needs_input", "budget"]);

export function emptyVinScanCanaryDoc(): VinScanCanaryDoc {
  return { version: 1, runs: [], alerted: {} };
}

export function parseVinScanCanaryDoc(raw: unknown): VinScanCanaryDoc {
  if (!raw || typeof raw !== "object") return emptyVinScanCanaryDoc();
  const r = raw as Partial<VinScanCanaryDoc>;
  const runs = Array.isArray(r.runs)
    ? r.runs.filter(
        (run): run is VinScanCanaryRunRecord =>
          Boolean(run) && typeof run.at === "string" && Boolean(run.results) && typeof run.results === "object",
      )
    : [];
  const alerted: Record<string, string> = {};
  if (r.alerted && typeof r.alerted === "object") {
    for (const [k, v] of Object.entries(r.alerted)) if (typeof v === "string") alerted[k] = v;
  }
  return { version: 1, runs, alerted };
}

export function classifyVinScanCanaryStatus(expect: VinScanCanaryExpect, status: string): VinScanCanaryState {
  if (status === "found") return "ok";
  if (status === "none") return expect === "found" ? "no_data" : "ok";
  if (SKIP_STATUSES.has(status)) return "skipped";
  if (ERROR_STATUSES.has(status)) return "error";
  return "error";
}

export function appendVinScanCanaryRun(
  doc: VinScanCanaryDoc,
  run: VinScanCanaryRunRecord,
  keep = VIN_SCAN_CANARY_KEEP_RUNS,
): VinScanCanaryDoc {
  return { ...doc, runs: [...doc.runs, run].slice(-keep) };
}

/** Pēdējā palaišana pirms `current`, kurā avots tika pārbaudīts (nav izlaists). */
function previousResult(
  runs: readonly VinScanCanaryRunRecord[],
  id: string,
  currentAtMs: number,
): VinScanCanaryResult | null {
  for (let i = runs.length - 1; i >= 0; i -= 1) {
    const run = runs[i]!;
    const atMs = Date.parse(run.at);
    if (!Number.isFinite(atMs) || atMs >= currentAtMs) continue;
    if (currentAtMs - atMs > VIN_SCAN_CANARY_PREV_MAX_AGE_MS) return null;
    const res = run.results[id];
    if (res && res.state !== "skipped") return res;
  }
  return null;
}

/** Sabrukušie avoti pēc šīs palaišanas (`history` - iepriekšējās palaišanas, bez `current`). */
export function vinScanCanaryBroken(
  current: VinScanCanaryRunRecord,
  history: readonly VinScanCanaryRunRecord[],
  realScanStreaks: readonly { id: string; streak: number; msg?: string }[] = [],
): VinScanCanaryBroken[] {
  const out: VinScanCanaryBroken[] = [];
  const atMs = Date.parse(current.at);
  for (const [id, res] of Object.entries(current.results)) {
    if (res.state === "ok" || res.state === "skipped") continue;
    const prev = previousResult(history, id, atMs);
    if (res.state === "no_data" && prev?.state === "ok") {
      out.push({ key: id, id, reason: "no_data_after_data", detail: res.summary });
    } else if (prev && prev.state === res.state) {
      out.push({ key: id, id, reason: res.state === "error" ? "error_2x" : "no_data_2x", detail: res.summary });
    } else if (prev && prev.state !== "ok") {
      // kļūda → nav datu (vai otrādi): divas dienas pēc kārtas nestrādā.
      out.push({ key: id, id, reason: "error_2x", detail: res.summary });
    }
  }
  const seen = new Set(out.map((b) => b.id));
  for (const row of realScanStreaks) {
    if (!isVinScanSourceId(row.id) || seen.has(row.id)) continue;
    out.push({ key: `scan:${row.id}`, id: row.id, reason: "real_scans", detail: `${row.streak} kļūdas pēc kārtas` });
  }
  return out;
}

export type VinScanCanaryAlertDecision = {
  send: boolean;
  /** Avoti, par kuriem paziņo pirmo reizi. */
  fresh: VinScanCanaryBroken[];
  next: Record<string, string>;
};

/**
 * Paziņo vienreiz par katru sabrukušo avotu. Kad avots atguvies, atslēga pazūd -
 * nākamā kļūme atkal paziņo uzreiz.
 */
export function decideVinScanCanaryAlert(
  broken: readonly VinScanCanaryBroken[],
  alerted: Readonly<Record<string, string>>,
  nowIso: string,
): VinScanCanaryAlertDecision {
  const next: Record<string, string> = {};
  const fresh: VinScanCanaryBroken[] = [];
  for (const b of broken) {
    const prev = alerted[b.key];
    if (prev) next[b.key] = prev;
    else {
      next[b.key] = nowIso;
      fresh.push(b);
    }
  }
  return { send: fresh.length > 0, fresh, next };
}

const SOURCE_LABEL: Record<string, string> = { vin_decode: "VIN dekodēšana" };

export function vinScanSourceLabel(id: string): string {
  return SOURCE_LABEL[id] ?? (isVinScanSourceId(id) ? vinScanCatalogItem(id).label : id);
}

const REASON_LABEL: Record<VinScanCanaryBrokenReason, string> = {
  error_2x: "kļūda 2 dienas",
  no_data_2x: "nav datu 2 dienas",
  no_data_after_data: "zelta VIN pēkšņi bez datiem",
  real_scans: "kļūdas reālos skenējumos",
};

export function vinScanCanaryBrokenLabel(b: VinScanCanaryBroken): string {
  return `${vinScanSourceLabel(b.id)} (${REASON_LABEL[b.reason]})`;
}

export function adminPushVinScanCanaryMessage(fresh: readonly VinScanCanaryBroken[]): AdminPushMessage {
  return {
    title: "VIN SCAN avots nestrādā",
    body: fresh.map(vinScanCanaryBrokenLabel).join(", "),
    url: "/admin/vin-scan",
    tag: "vin-scan-canary",
    audience: "pro",
  };
}

/**
 * Rīta kopsavilkuma rinda: «VIN SCAN: N/M avoti strādā; sabrukuši: …».
 * Pārbaudīti = pēdējā palaišanā nav izlaisti. Sabrukuši = šobrīd paziņotie (alerted).
 */
export function vinScanCanarySummaryLine(doc: VinScanCanaryDoc, nowMs: number): string | null {
  const last = doc.runs.at(-1);
  if (!last) return null;
  const atMs = Date.parse(last.at);
  if (!Number.isFinite(atMs) || nowMs - atMs > VIN_SCAN_CANARY_FRESH_MS) {
    return `VIN SCAN: uzraudzība nav palaista kopš ${last.at.slice(0, 10)}`;
  }
  const checked = Object.entries(last.results).filter(([, r]) => r.state !== "skipped");
  const working = checked.filter(([, r]) => r.state === "ok").length;
  const brokenIds = [...new Set(Object.keys(doc.alerted).map((k) => k.replace(/^scan:/, "")))];
  const failingToday = checked.filter(([, r]) => r.state !== "ok").map(([id]) => id);
  const parts = [`VIN SCAN: ${working}/${checked.length} avoti strādā`];
  if (brokenIds.length) parts.push(`sabrukuši: ${brokenIds.map(vinScanSourceLabel).join(", ")}`);
  const watch = failingToday.filter((id) => !brokenIds.includes(id));
  if (watch.length) parts.push(`šodien nestrādā: ${watch.map(vinScanSourceLabel).join(", ")}`);
  return parts.join("; ");
}
