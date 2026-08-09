/**
 * Vienota negadījumu tabula PDF — AutoDNA, CarVertical, LTAB, Citi avoti (tikai rindas ar aizpildītu „Zaudējumu summu”).
 * PDF attēlojumā dažādu avotu līdzīgi ieraksti (tas pats datums + līdzīga summa) apvienojas ar strīpiņām.
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

/** Tabulas rinda pēc PDF apvienošanas — vairāki avoti vienā „Avots” kolonnā. */
export type UnifiedIncidentDisplayRow = UnifiedIncidentRow & {
  sourceLabels: string[];
};

/** Relatīvā summas starpība (no lielākās) — apvienošanai starp avotiem. */
export const UNIFIED_INCIDENT_MERGE_MAX_REL_DIFF = 0.15;

/** Absolūtā summas starpība (€) — apvienošanai starp avotiem. */
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

/** Jaunākais datums augšā (kā nobraukuma tabulā). */
export function sortUnifiedIncidentsNewestFirst(rows: UnifiedIncidentRow[]): UnifiedIncidentRow[] {
  return [...rows].sort((a, b) => {
    if (a.sortableTime !== b.sortableTime) return b.sortableTime - a.sortableTime;
    return a.sourceOrder - b.sourceOrder;
  });
}

function dateGroupKey(r: UnifiedIncidentRow): string {
  if (r.sortableTime !== Number.NEGATIVE_INFINITY) return `t:${r.sortableTime}`;
  return `d:${r.date.trim().toLowerCase()}`;
}

function sourceKey(label: string): string {
  return label.trim().toLowerCase() || "nezināms avots";
}

/** Vai divas summas uzskatāmas par to pašu notikumu (min(15 %, 250 €)). */
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
  let any = false;
  for (const r of rows) {
    const bounds = parseLossAmountEurBounds(r.lossAmount);
    if (!bounds) continue;
    any = true;
    lo = Math.min(lo, bounds.lo);
    hi = Math.max(hi, bounds.hi);
  }
  if (!any) return rows[0]?.lossAmount ?? "";
  if (lo === hi) return normalizeLossAmountEurDisplay(`${lo} €`) || `${lo} €`;
  return normalizeLossAmountEurDisplay(`${lo} - ${hi} €`) || `${lo} - ${hi} €`;
}

function mergeIncidentCluster(cluster: UnifiedIncidentRow[]): UnifiedIncidentDisplayRow {
  const sorted = sortUnifiedIncidentsNewestFirst(cluster);
  const primary = sorted[0] ?? cluster[0]!;
  const labels = uniqueSourceLabelsOrdered(cluster);
  const countries = [
    ...new Set(cluster.map((r) => r.country.trim()).filter((c) => c && c !== "—")),
  ];
  return {
    ...primary,
    lossAmount: formatMergedLossAmount(cluster),
    country: countries.length <= 1 ? (countries[0] ?? primary.country) : countries.join(" / "),
    sourceOrder: Math.min(...cluster.map((r) => r.sourceOrder)),
    sourceLabel: labels[0] ?? primary.sourceLabel,
    sourceLabels: labels,
  };
}

/**
 * PDF: apvieno dažādu avotu rindas ar to pašu datumu un līdzīgu summu.
 * Viena avota vairāki ieraksti (arī tajā pašā mēnesī / dienā) paliek atsevišķi.
 */
export function mergeUnifiedIncidentRowsForPdf(rows: UnifiedIncidentRow[]): UnifiedIncidentDisplayRow[] {
  const byDate = new Map<string, UnifiedIncidentRow[]>();
  for (const row of rows) {
    const key = dateGroupKey(row);
    const bucket = byDate.get(key) ?? [];
    bucket.push(row);
    byDate.set(key, bucket);
  }

  const out: UnifiedIncidentDisplayRow[] = [];
  for (const bucket of byDate.values()) {
    const clusters: UnifiedIncidentRow[][] = [];
    const ordered = [...bucket].sort((a, b) => a.sourceOrder - b.sourceOrder);

    for (const row of ordered) {
      const amountOk = parseLossAmountEurComparable(row.lossAmount) != null;
      let placed = false;
      if (amountOk) {
        for (const cluster of clusters) {
          if (cluster.some((c) => sourceKey(c.sourceLabel) === sourceKey(row.sourceLabel))) continue;
          if (!cluster.every((c) => areUnifiedIncidentAmountsSimilar(c.lossAmount, row.lossAmount))) {
            continue;
          }
          cluster.push(row);
          placed = true;
          break;
        }
      }
      if (!placed) clusters.push([row]);
    }

    for (const cluster of clusters) {
      out.push(mergeIncidentCluster(cluster));
    }
  }

  return sortUnifiedIncidentsNewestFirst(out) as UnifiedIncidentDisplayRow[];
}

/** PDF tabulas rindas — jaunākais augšā + starpavotu apvienošana. */
export function prepareUnifiedIncidentDisplayRows(rows: UnifiedIncidentRow[]): UnifiedIncidentDisplayRow[] {
  return mergeUnifiedIncidentRowsForPdf(rows);
}
