/**
 * Pretrunu pārbaudes mācīšanās (Nils 24.11: «jāmācās no savām kļūdām»).
 *
 * Operators pie katra brīdinājuma spiež «Nav pretruna» (dismiss) vai «Pareizi» (confirm).
 * - Pasūtījumā: `workspace.contradictionFeedback` (vecie melnraksti bez lauka netiek pārrakstīti).
 * - Kopējs žurnāls statistikai: Vercel Blob `admin-contradiction-feedback/YYYY-MM.jsonl` (bez personas datiem).
 * - Tas pats VIN + tas pats pirkstu nospiedums ar «Nav pretruna» - pelēks, neskaitās, nebloķē PDF.
 * - Noteikums + avotu pāris ar ≥5 lēmumiem 30 dienās un ≥80 % «Nav pretruna» - smagums pazeminās par vienu pakāpi
 *   (izņemot reģistrs pret reģistru nobraukuma kritumu, atsaukumu noliegumu, iekšējās piezīmes, marku).
 *
 * Tīras funkcijas (bez servera importiem) - lieto gan UI, gan API.
 */
import type { SourceIssue, SourceIssueSeverity } from "@/lib/source-consistency";
import type { FactCheckFlag, FactCheckLevel } from "@/lib/unit-facts/types";
import type { ClassifiedOdometerAnomaly } from "@/lib/odometer-anomaly-classify";

export type ContradictionVerdict = "dismiss" | "confirm";
export type ContradictionOrigin = "source" | "fact" | "odometer" | "prepdf";

export type ContradictionFeedbackEntry = {
  /** Stabils pirkstu nospiedums (bez sourceOrder, km līdz 100, datums līdz mēnesim). */
  fp: string;
  /** Noteikums (`mileage_drop`, `km_mismatch`, `odo_rollback` ...). */
  rule: string;
  /** Avotu pāris (sakārtots), ja ir. */
  pair?: string;
  origin: ContradictionOrigin;
  verdict: ContradictionVerdict;
  /** ISO laiks. */
  at: string;
  note?: string;
};

/** Žurnāla rinda (Blob): bez personas datiem - VIN un pasūtījuma id ir tehniski identifikatori. */
export type ContradictionFeedbackLogLine = ContradictionFeedbackEntry & {
  vin?: string;
  sessionId?: string;
  /** Brīdinājuma smagums brīdī, kad operators lēma. */
  severity?: string;
};

export const CONTRADICTION_FEEDBACK_MAX = 400;
export const AUTO_DOWNGRADE_MIN_DECISIONS = 5;
export const AUTO_DOWNGRADE_MIN_DISMISS_RATIO = 0.8;
export const AUTO_DOWNGRADE_WINDOW_DAYS = 30;

function clip(s: unknown, max: number): string {
  return typeof s === "string" ? s.trim().slice(0, max) : "";
}

/** Vecie pasūtījumi bez lauka paliek `undefined` - netiek pārrakstīti. */
export function parseContradictionFeedback(raw: unknown): ContradictionFeedbackEntry[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const byFp = new Map<string, ContradictionFeedbackEntry>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const fp = clip(o.fp, 400);
    const rule = clip(o.rule, 80);
    const verdict = o.verdict;
    const origin = o.origin;
    if (!fp || !rule || (verdict !== "dismiss" && verdict !== "confirm")) continue;
    const entry: ContradictionFeedbackEntry = {
      fp,
      rule,
      origin: origin === "source" || origin === "fact" || origin === "odometer" || origin === "prepdf" ? origin : "fact",
      verdict,
      at: clip(o.at, 40) || new Date(0).toISOString(),
    };
    const pair = clip(o.pair, 160);
    if (pair) entry.pair = pair;
    const note = clip(o.note, 300);
    if (note) entry.note = note;
    byFp.set(fp, entry);
  }
  return [...byFp.values()].slice(-CONTRADICTION_FEEDBACK_MAX);
}

/** Persistences lauks - tikai ja masīvs ir. */
export function contradictionFeedbackSnapshotField(
  entries: ContradictionFeedbackEntry[] | null | undefined,
): { contradictionFeedback?: ContradictionFeedbackEntry[] } {
  return entries != null ? { contradictionFeedback: entries } : {};
}

/** Jaunākais lēmums par fp aizstāj iepriekšējo; atkārtots tas pats lēmums - noņem (pārslēgšana). */
export function upsertContradictionFeedback(
  entries: readonly ContradictionFeedbackEntry[] | null | undefined,
  next: ContradictionFeedbackEntry,
): ContradictionFeedbackEntry[] {
  const list = [...(entries ?? [])];
  const i = list.findIndex((e) => e.fp === next.fp);
  if (i >= 0 && list[i]!.verdict === next.verdict) {
    list.splice(i, 1);
    return list;
  }
  if (i >= 0) list.splice(i, 1);
  list.push(next);
  return list.slice(-CONTRADICTION_FEEDBACK_MAX);
}

export function feedbackFor(
  fp: string,
  entries: readonly ContradictionFeedbackEntry[] | null | undefined,
): ContradictionFeedbackEntry | undefined {
  return (entries ?? []).find((e) => e.fp === fp);
}

/* ---------- pirkstu nospiedumi ---------- */

function normVin(vin: string | null | undefined): string {
  return (vin ?? "").trim().toUpperCase().slice(0, 17);
}

/** Skaitļi > 999 → noapaļoti līdz 100; datumi DD.MM.YYYY → MM.YYYY. */
export function normalizeFingerprintValue(raw: string): string {
  return (raw ?? "")
    .replace(/\b\d{1,2}[./](\d{1,2})[./](\d{4})\b/g, (_m, mo: string, y: string) => `${mo.padStart(2, "0")}.${y}`)
    .replace(/(\d{1,3}(?:[  ]\d{3})+|\d{4,})/g, (m) => {
      const n = Number(m.replace(/\D/g, ""));
      return Number.isFinite(n) && n >= 1000 ? String(Math.round(n / 100) * 100) : m;
    })
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Avota etiķete bez «(sludinājums)», datuma, vizītes astēm. */
function normSource(label: string): string {
  return (label ?? "")
    .replace(/\s*\d{1,2}\.\d{1,2}\.\d{4}.*$/, "")
    .replace(/\s*-\s*vizīte.*$/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

/** Īss, deterministisks hash (FNV-1a) - teikumiem un vērtību sarakstiem. */
export function shortHash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/** Avotu josla: noteikums + VIN + avotu pāris (sakārtots) + normalizētās vērtības. */
export function sourceIssueFingerprint(issue: Pick<SourceIssue, "kind" | "values">, vin?: string | null): { fp: string; rule: string; pair: string } {
  const sources = [...new Set(issue.values.map((v) => normSource(v.source)).filter(Boolean))].sort();
  const values = issue.values.map((v) => `${normSource(v.source)}=${normalizeFingerprintValue(v.value)}`).sort();
  const pair = sources.join("+");
  return { fp: `src|${issue.kind}|${normVin(vin)}|${pair}|${shortHash(values.join(";"))}`, rule: issue.kind, pair };
}

/** Noteikuma id bez skaitļiem / atslēgas astēm («csdd_foreign_mileage_123456» → «csdd_foreign_mileage»). */
export function factRuleOf(id: string): string {
  const odo = id.match(/^(odo_[a-z_]+?)_v2\|/);
  if (odo) return odo[1]!;
  return id.replace(/_\d+$/, "").replace(/\|.*$/, "");
}

/** Teksta brīdinājums: noteikums + VIN + teikuma hash bez cipariem. */
export function factFlagFingerprint(flag: Pick<FactCheckFlag, "id" | "sentence">, vin?: string | null): { fp: string; rule: string } {
  const rule = factRuleOf(flag.id);
  const sentence = (flag.sentence ?? "").toLowerCase().replace(/\d+/g, "#").replace(/\s+/g, " ").trim();
  return { fp: `fact|${rule}|${normVin(vin)}|${shortHash(sentence)}`, rule };
}

/** Odometra anomālija: stabilā atslēga jau bez sourceOrder. */
export function odometerFingerprint(a: Pick<ClassifiedOdometerAnomaly, "key" | "class" | "fromSource" | "toSource">, vin?: string | null): { fp: string; rule: string; pair: string } {
  const pair = [a.fromSource, a.toSource].filter((x): x is string => Boolean(x)).map(normSource).sort().join("+");
  return { fp: `odo|${normVin(vin)}|${a.key}`, rule: `odo_${a.class}`, pair };
}

/* ---------- automātiska pazemināšana ---------- */

const REGISTRY_RE = /\bCSDD\b|REĢISTR|MNT\.EE|TRAFICOM|CAR\.INFO|TJEKBIL|RDW|DMR/i;

/** Noteikumi, kurus nekad automātiski nepazemina. */
export function neverAutoDowngrade(rule: string, pair?: string): boolean {
  if (/^(?:recall_denied|no_recalls_claim|c10_internal_note|c10_\w*|make|leak_\w*)$/.test(rule)) return true;
  if ((rule === "mileage_drop" || rule === "odo_rollback") && pair) {
    const parts = pair.split("+").filter(Boolean);
    if (parts.length >= 2 && parts.every((p) => REGISTRY_RE.test(p))) return true;
  }
  return false;
}

export function ruleKey(rule: string, pair?: string): string {
  return pair ? `${rule}|${pair}` : rule;
}

export type RuleFeedbackStats = {
  rule: string;
  pair: string;
  total: number;
  dismiss: number;
  confirm: number;
  dismissRatio: number;
  /** Līdz 2 piemēri (VIN + īss fp). */
  examples: { vin: string; fp: string }[];
  autoDowngrade: boolean;
};

/** Statistika pa noteikumiem + avotu pāriem (pēdējās `days` dienās). */
export function computeRuleFeedbackStats(
  lines: readonly ContradictionFeedbackLogLine[],
  nowMs: number,
  days: number = AUTO_DOWNGRADE_WINDOW_DAYS,
): RuleFeedbackStats[] {
  const since = nowMs - days * 24 * 60 * 60 * 1000;
  // Viens lēmums uz VIN+fp (jaunākais) - operatora pārdomas neskaitās divreiz.
  const latest = new Map<string, ContradictionFeedbackLogLine>();
  for (const l of lines) {
    const t = Date.parse(l.at);
    if (!Number.isFinite(t) || t < since) continue;
    const k = `${l.vin ?? ""}|${l.fp}`;
    const prev = latest.get(k);
    if (!prev || Date.parse(prev.at) <= t) latest.set(k, l);
  }
  const by = new Map<string, RuleFeedbackStats>();
  for (const l of latest.values()) {
    const k = ruleKey(l.rule, l.pair);
    const s =
      by.get(k) ??
      { rule: l.rule, pair: l.pair ?? "", total: 0, dismiss: 0, confirm: 0, dismissRatio: 0, examples: [], autoDowngrade: false };
    s.total += 1;
    if (l.verdict === "dismiss") {
      s.dismiss += 1;
      if (s.examples.length < 2) s.examples.push({ vin: l.vin ?? "", fp: l.fp.slice(0, 120) });
    } else s.confirm += 1;
    by.set(k, s);
  }
  for (const s of by.values()) {
    s.dismissRatio = s.total > 0 ? s.dismiss / s.total : 0;
    s.autoDowngrade =
      s.total >= AUTO_DOWNGRADE_MIN_DECISIONS &&
      s.dismissRatio >= AUTO_DOWNGRADE_MIN_DISMISS_RATIO &&
      !neverAutoDowngrade(s.rule, s.pair || undefined);
  }
  return [...by.values()].sort((a, b) => b.dismissRatio - a.dismissRatio || b.total - a.total);
}

/** Automātiski pazemināto noteikumu atslēgas (`rule|pair` un arī `rule`, ja pāris nav). */
export function autoDowngradedRuleKeys(stats: readonly RuleFeedbackStats[]): string[] {
  return stats.filter((s) => s.autoDowngrade).map((s) => ruleKey(s.rule, s.pair || undefined));
}

export function downgradeSourceSeverity(s: SourceIssueSeverity): SourceIssueSeverity {
  return s === "critical" ? "warn" : "info";
}

export function downgradeFactLevel(l: FactCheckLevel): FactCheckLevel {
  return l === "E" ? "W" : "I";
}

function isDowngraded(keys: ReadonlySet<string>, rule: string, pair?: string): boolean {
  return (pair ? keys.has(ruleKey(rule, pair)) : false) || keys.has(rule);
}

/** Avotu josla: VIN noraidītie - info + `dismissedAt`; automātiski pazeminātie - par pakāpi zemāk. */
export type SourceIssueWithFeedback = SourceIssue & {
  fp: string;
  rule: string;
  pair: string;
  verdict?: ContradictionVerdict;
  verdictAt?: string;
  autoDowngraded?: boolean;
  originalSeverity: SourceIssueSeverity;
};

export function applyFeedbackToSourceIssues(
  issues: readonly SourceIssue[],
  opts: { vin?: string | null; entries?: readonly ContradictionFeedbackEntry[] | null; downgraded?: readonly string[] | null },
): SourceIssueWithFeedback[] {
  const keys = new Set(opts.downgraded ?? []);
  return issues.map((issue) => {
    const { fp, rule, pair } = sourceIssueFingerprint(issue, opts.vin);
    const fb = feedbackFor(fp, opts.entries);
    let severity = issue.severity;
    let autoDowngraded = false;
    if (fb?.verdict === "dismiss") severity = "info";
    else if (fb?.verdict !== "confirm" && severity !== "info" && isDowngraded(keys, rule, pair) && !neverAutoDowngrade(rule, pair)) {
      severity = downgradeSourceSeverity(severity);
      autoDowngraded = true;
    }
    return {
      ...issue,
      severity,
      originalSeverity: issue.severity,
      fp,
      rule,
      pair,
      ...(fb ? { verdict: fb.verdict, verdictAt: fb.at } : {}),
      ...(autoDowngraded ? { autoDowngraded } : {}),
    };
  });
}

/** Teksta / pirms-PDF brīdinājumi: noraidītie pazūd no bloķējošiem (paliek I), pazeminātie - par pakāpi zemāk. */
export function applyFeedbackToFactFlags<T extends FactCheckFlag>(
  flags: readonly T[],
  opts: { vin?: string | null; entries?: readonly ContradictionFeedbackEntry[] | null; downgraded?: readonly string[] | null },
): T[] {
  const keys = new Set(opts.downgraded ?? []);
  return flags.map((f) => {
    const { fp, rule } = factFlagFingerprint(f, opts.vin);
    const fb = feedbackFor(fp, opts.entries);
    if (fb?.verdict === "dismiss") return { ...f, level: "I" as const };
    if (fb?.verdict !== "confirm" && f.level !== "I" && isDowngraded(keys, rule) && !neverAutoDowngrade(rule)) {
      return { ...f, level: downgradeFactLevel(f.level) };
    }
    return f;
  });
}

/** «noraidīts 24.11» pelēkajai rindai. */
export function feedbackDateLabel(at: string | undefined): string {
  const t = Date.parse(at ?? "");
  if (!Number.isFinite(t)) return "";
  const d = new Date(t);
  return `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Mēneša žurnāla ceļš Blob krātuvē. */
export function contradictionFeedbackLogPath(atIso: string): string {
  const m = (atIso ?? "").match(/^(\d{4})-(\d{2})/);
  const ym = m ? `${m[1]}-${m[2]}` : new Date().toISOString().slice(0, 7);
  return `admin-contradiction-feedback/${ym}.jsonl`;
}

/** Nedēļas push teksts: top 5 noraidītie noteikumi + pazeminātie (tukšs - nav lēmumu). */
export function contradictionWeeklyPushBody(stats: readonly RuleFeedbackStats[], downgraded: readonly string[]): string {
  const top = stats.filter((s) => s.dismiss > 0).slice(0, 5);
  if (top.length === 0 && downgraded.length === 0) return "";
  const parts = top.map((s) => `${s.rule}${s.pair ? ` (${s.pair})` : ""} ${s.dismiss}/${s.total}`);
  const tail = downgraded.length ? ` Pazemināti: ${downgraded.slice(0, 3).join(", ")}${downgraded.length > 3 ? "…" : ""}.` : "";
  return `Noraidītie: ${parts.join("; ") || "nav"}.${tail}`.slice(0, 240);
}

/** Ieteikums galvenajam pie noteikuma (admin lapā). */
export function ruleAdviceLv(s: Pick<RuleFeedbackStats, "dismissRatio" | "total" | "autoDowngrade">): string {
  if (s.autoDowngrade) return "Automātiski pazemināts - labot slieksni / izņēmumu kodā";
  if (s.total >= 3 && s.dismissRatio >= 0.6) return "Bieži viltus - apsvērt izņēmumu";
  if (s.dismissRatio <= 0.2) return "Noteikums strādā";
  return "Vērot";
}
