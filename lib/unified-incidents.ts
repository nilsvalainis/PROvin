/**
 * Vienota negadījumu tabula PDF — AutoDNA, CarVertical, LTAB, Citi avoti (tikai rindas ar aizpildītu „Zaudējumu summu”).
 * PDF: visi ieraksti vienā kalendāra mēnesī apvienojas vienā rindā ar avotu strīpiņām un summu diapazonu.
 */

import type { ClientManualLtabBlockPdf, ClientManualVendorBlockPdf, LtabIncidentRow } from "@/lib/admin-source-blocks";
import {
  normalizeLossAmountEurDisplay,
  parseLossAmountEurBounds,
  parseLossAmountEurComparable,
} from "@/lib/loss-amount-format";
import { parseMileageDateForSort } from "@/lib/unified-mileage";

export type UnifiedIncidentRow = {
  date: string;
  lossAmount: string;
  country: string;
  sortableTime: number;
  sourceOrder: number;
  sourceLabel: string;
};

/** Tabulas rinda pēc PDF mēneša apvienošanas — vairāki avoti / summas vienā rindā. */
export type UnifiedIncidentDisplayRow = UnifiedIncidentRow & {
  sourceLabels: string[];
  /** Cik avotu ierakstu iekļauti šajā mēneša rindā. */
  sourceRecordCount: number;
};

export type UnifiedIncidentCountSummary = {
  /** Rindu skaits pēc mēneša apvienošanas (periodi). */
  periodCount: number;
  /** Neapvienoto avotu ierakstu skaits. */
  sourceRecordCount: number;
  /** Ieraksti pa avotu etiķeti (AutoDNA, CarVertical, …). */
  bySource: { label: string; count: number }[];
};

/** Relatīvā summas starpība (no lielākās) — paliek utilītēm / testiem. */
export const UNIFIED_INCIDENT_MERGE_MAX_REL_DIFF = 0.15;

/** Absolūtā summas starpība (€). */
export const UNIFIED_INCIDENT_MERGE_MAX_ABS_DIFF_EUR = 250;

function incidentRowHasLossAmount(r: LtabIncidentRow): boolean {
  return Boolean(r.lossAmount.trim());
}

export type CollectUnifiedIncidentOptions = {
  omitVendorBlockTitles?: Set<string>;
  omitLtab?: boolean;
};

export function collectUnifiedIncidentRows(args: {
  manualVendorBlocks?: ClientManualVendorBlockPdf[] | null;
  manualLtabBlock?: ClientManualLtabBlockPdf | null;
  options?: CollectUnifiedIncidentOptions;
}): UnifiedIncidentRow[] {
  const out: UnifiedIncidentRow[] = [];
  let sourceOrder = 0;
  const omitTitles = args.options?.omitVendorBlockTitles;
  const push = (r: LtabIncidentRow, sourceLabel: string) => {
    if (!incidentRowHasLossAmount(r)) return;
    const d = r.csngDate.trim();
    out.push({
      date: d || "—",
      lossAmount: normalizeLossAmountEurDisplay(r.lossAmount) || r.lossAmount.trim(),
      country: r.incidentNo.trim() || "—",
      sortableTime: parseMileageDateForSort(d),
      sourceOrder: sourceOrder++,
      sourceLabel: sourceLabel.trim() || "Nezināms avots",
    });
  };
  for (const b of args.manualVendorBlocks ?? []) {
    if (omitTitles?.has(b.title)) continue;
    for (const r of b.incidentRows) push(r, b.title);
  }
  if (!args.options?.omitLtab) {
    for (const r of args.manualLtabBlock?.rows ?? []) push(r, "LTAB");
  }
  return out;
}

/** Jaunākais datums / mēnesis augšā. */
export function sortUnifiedIncidentsNewestFirst(rows: UnifiedIncidentRow[]): UnifiedIncidentRow[] {
  return [...rows].sort((a, b) => {
    if (a.sortableTime !== b.sortableTime) return b.sortableTime - a.sortableTime;
    return a.sourceOrder - b.sourceOrder;
  });
}

/** Kalendāra mēneša atslēga `YYYY-MM` (UTC); bez derīga datuma — atsevišķi. */
export function incidentMonthGroupKey(r: UnifiedIncidentRow): string {
  if (r.sortableTime !== Number.NEGATIVE_INFINITY) {
    const d = new Date(r.sortableTime);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  }
  return `raw:${r.date.trim().toLowerCase() || "—"}`;
}

export function formatIncidentMonthLabel(monthKey: string, fallbackDate: string): string {
  const m = monthKey.match(/^(\d{4})-(\d{2})$/);
  if (m) return `${m[2]}.${m[1]}`;
  return fallbackDate || "—";
}

function sourceKey(label: string): string {
  return label.trim().toLowerCase() || "nezināms avots";
}

/** Vai divas summas uzskatāmas par tuvām (min(15 %, 250 €)) — utilīta / testi. */
export function areUnifiedIncidentAmountsSimilar(aRaw: string, bRaw: string): boolean {
  const a = parseLossAmountEurComparable(aRaw);
  const b = parseLossAmountEurComparable(bRaw);
  if (a == null || b == null) return false;
  const diff = Math.abs(a - b);
  const relCap = UNIFIED_INCIDENT_MERGE_MAX_REL_DIFF * Math.max(a, b);
  const cap = Math.min(relCap, UNIFIED_INCIDENT_MERGE_MAX_ABS_DIFF_EUR);
  return diff <= cap;
}

function uniqueSourceLabelsOrdered(rows: UnifiedIncidentRow[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of rows) {
    const lbl = r.sourceLabel.trim() || "Nezināms avots";
    const key = sourceKey(lbl);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(lbl);
  }
  return out;
}

function formatMergedLossAmount(rows: UnifiedIncidentRow[]): string {
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  let anyNumeric = false;
  const nonNumeric: string[] = [];
  const seenText = new Set<string>();

  for (const r of rows) {
    const bounds = parseLossAmountEurBounds(r.lossAmount);
    if (bounds) {
      anyNumeric = true;
      lo = Math.min(lo, bounds.lo);
      hi = Math.max(hi, bounds.hi);
      continue;
    }
    const t = r.lossAmount.trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seenText.has(key)) continue;
    seenText.add(key);
    nonNumeric.push(t);
  }

  const parts: string[] = [];
  if (anyNumeric) {
    if (lo === hi) parts.push(normalizeLossAmountEurDisplay(`${lo} €`) || `${lo} €`);
    else parts.push(normalizeLossAmountEurDisplay(`${lo} - ${hi} €`) || `${lo} - ${hi} €`);
  }
  parts.push(...nonNumeric);
  if (parts.length === 0) return rows[0]?.lossAmount ?? "";
  return parts.join("; ");
}

function mergeIncidentMonthCluster(
  monthKey: string,
  cluster: UnifiedIncidentRow[],
): UnifiedIncidentDisplayRow {
  const sorted = sortUnifiedIncidentsNewestFirst(cluster);
  const primary = sorted[0] ?? cluster[0]!;
  const labels = uniqueSourceLabelsOrdered(cluster);
  const countries = [
    ...new Set(cluster.map((r) => r.country.trim()).filter((c) => c && c !== "—")),
  ];
  const monthMs =
    primary.sortableTime !== Number.NEGATIVE_INFINITY
      ? Date.UTC(
          new Date(primary.sortableTime).getUTCFullYear(),
          new Date(primary.sortableTime).getUTCMonth(),
          1,
        )
      : primary.sortableTime;
  return {
    ...primary,
    date: formatIncidentMonthLabel(monthKey, primary.date),
    sortableTime: monthMs,
    lossAmount: formatMergedLossAmount(cluster),
    country: countries.length <= 1 ? (countries[0] ?? primary.country) : countries.join(" / "),
    sourceOrder: Math.min(...cluster.map((r) => r.sourceOrder)),
    sourceLabel: labels[0] ?? primary.sourceLabel,
    sourceLabels: labels,
    sourceRecordCount: cluster.length,
  };
}

/**
 * PDF: apvieno visus ierakstus vienā kalendāra mēnesī (gads + mēnesis) — vieglākai uztverei.
 * Viena rinda = mēnesis; summa kā diapazons; avoti kā strīpiņas.
 */
export function mergeUnifiedIncidentRowsForPdf(rows: UnifiedIncidentRow[]): UnifiedIncidentDisplayRow[] {
  const byMonth = new Map<string, UnifiedIncidentRow[]>();
  for (const row of rows) {
    const key = incidentMonthGroupKey(row);
    const bucket = byMonth.get(key) ?? [];
    bucket.push(row);
    byMonth.set(key, bucket);
  }

  const out: UnifiedIncidentDisplayRow[] = [];
  for (const [monthKey, bucket] of byMonth) {
    out.push(mergeIncidentMonthCluster(monthKey, bucket));
  }
  return sortUnifiedIncidentsNewestFirst(out) as UnifiedIncidentDisplayRow[];
}

/** PDF tabulas rindas — jaunākais mēnesis augšā + mēneša apvienošana. */
export function prepareUnifiedIncidentDisplayRows(rows: UnifiedIncidentRow[]): UnifiedIncidentDisplayRow[] {
  return mergeUnifiedIncidentRowsForPdf(rows);
}

/** Skaitļi zem tabulas — periodi vs neapvienotie avotu ieraksti. */
export function summarizeUnifiedIncidentCounts(
  collected: UnifiedIncidentRow[],
  displayRows: UnifiedIncidentDisplayRow[],
): UnifiedIncidentCountSummary {
  const bySourceMap = new Map<string, { label: string; count: number }>();
  for (const r of collected) {
    const lbl = r.sourceLabel.trim() || "Nezināms avots";
    const key = sourceKey(lbl);
    const prev = bySourceMap.get(key);
    if (prev) prev.count += 1;
    else bySourceMap.set(key, { label: lbl, count: 1 });
  }
  return {
    periodCount: displayRows.length,
    sourceRecordCount: collected.length,
    bySource: [...bySourceMap.values()],
  };
}

export function formatUnifiedIncidentCountSummaryLine(summary: UnifiedIncidentCountSummary): string {
  const bySrc =
    summary.bySource.length > 0
      ? summary.bySource.map((s) => `${s.label}: ${s.count}`).join(", ")
      : "";
  const base = `Negadījumu periodi: ${summary.periodCount} · Ieraksti avotos: ${summary.sourceRecordCount}`;
  return bySrc ? `${base} (${bySrc})` : base;
}
