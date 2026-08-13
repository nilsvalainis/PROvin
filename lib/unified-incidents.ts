/**
 * Vienota negadījumu tabula PDF — AutoDNA, CarVertical, LTAB, Citi avoti (tikai rindas ar aizpildītu „Zaudējumu summu”).
 * Loģiskais apkopojums: tas pats CSNg (datums + valsts) no vairākiem avotiem → viena rinda ar vidējo summu.
 */

import type { ClientManualLtabBlockPdf, ClientManualVendorBlockPdf, LtabIncidentRow } from "@/lib/admin-source-blocks";
import { normalizeCountryNameLv } from "@/lib/country-names-lv";
import {
  formatLossEurWholeDisplay,
  normalizeLossAmountEurDisplay,
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

/** Viens loģisks negadījums (pēc apvienošanas starp avotiem). */
export type UnifiedIncidentCluster = {
  date: string;
  country: string;
  displayAmount: string;
  averageEur: number | null;
  minEur: number | null;
  maxEur: number | null;
  averaged: boolean;
  sources: string[];
  sortableTime: number;
};

export type UnifiedIncidentSourceSummary = {
  sourceLabel: string;
  count: number;
  averageEur: number | null;
  displayAverage: string;
};

export type UnifiedIncidentAggregation = {
  clusters: UnifiedIncidentCluster[];
  bySource: UnifiedIncidentSourceSummary[];
  uniqueCount: number;
  rawCount: number;
  totalSumEur: number | null;
  overallAverageEur: number | null;
};

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

function incidentCountryKey(raw: string): string {
  const lv = normalizeCountryNameLv(raw);
  const t = (lv || raw).trim();
  if (!t || t === "—") return "?";
  return t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function incidentClusterKey(row: UnifiedIncidentRow): string {
  const datePart =
    row.sortableTime === Number.NEGATIVE_INFINITY ? `raw:${row.date}` : String(row.sortableTime);
  return `${datePart}|${incidentCountryKey(row.country)}`;
}

function parseIncidentAmountEur(raw: string): number | null {
  const n = parseLossAmountEurComparable(raw);
  if (n != null) return n;
  const collapsed = raw.replace(/EUR|€/gi, "").replace(/[\s\u00a0\u202f]/g, "").trim();
  if (/^\d+$/.test(collapsed)) {
    const v = Number.parseInt(collapsed, 10);
    return Number.isNaN(v) ? null : v;
  }
  return null;
}

function amountsOf(rows: UnifiedIncidentRow[]): number[] {
  const out: number[] = [];
  for (const r of rows) {
    const n = parseIncidentAmountEur(r.lossAmount);
    if (n != null) out.push(n);
  }
  return out;
}

function averageEur(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((s, n) => s + n, 0) / values.length);
}

function uniqueSources(rows: UnifiedIncidentRow[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of rows) {
    if (seen.has(r.sourceLabel)) continue;
    seen.add(r.sourceLabel);
    out.push(r.sourceLabel);
  }
  return out;
}

function clusterFromMembers(members: UnifiedIncidentRow[]): UnifiedIncidentCluster {
  const newest = sortUnifiedIncidentsNewestFirst(members)[0]!;
  const values = amountsOf(members);
  const avg = averageEur(values);
  const min = values.length ? Math.min(...values) : null;
  const max = values.length ? Math.max(...values) : null;
  const averaged = members.length > 1 && avg != null;
  const displayAmount = averaged
    ? formatLossEurWholeDisplay(avg)
    : newest.lossAmount.trim() || (avg != null ? formatLossEurWholeDisplay(avg) : "—");
  const country = normalizeCountryNameLv(newest.country) || newest.country.trim() || "—";
  return {
    date: newest.date,
    country,
    displayAmount,
    averageEur: avg,
    minEur: min,
    maxEur: max,
    averaged,
    sources: uniqueSources(members),
    sortableTime: newest.sortableTime,
  };
}

function sourceSummary(label: string, rows: UnifiedIncidentRow[]): UnifiedIncidentSourceSummary {
  const avg = averageEur(amountsOf(rows));
  return {
    sourceLabel: label,
    count: rows.length,
    averageEur: avg,
    displayAverage: avg != null ? formatLossEurWholeDisplay(avg) : "—",
  };
}

/**
 * Apvieno to pašu CSNg (datums + valsts) no dažādiem avotiem.
 * Ja viens avots tajā pašā dienā/valstī dod vairākas rindas — neatņemam tās (nav droši sapludināt).
 */
export function aggregateUnifiedIncidents(rows: UnifiedIncidentRow[]): UnifiedIncidentAggregation {
  const sorted = sortUnifiedIncidentsNewestFirst(rows);
  const groups = new Map<string, UnifiedIncidentRow[]>();
  for (const row of sorted) {
    const key = incidentClusterKey(row);
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  const clusters: UnifiedIncidentCluster[] = [];
  for (const members of groups.values()) {
    const perSource = new Map<string, number>();
    for (const m of members) perSource.set(m.sourceLabel, (perSource.get(m.sourceLabel) ?? 0) + 1);
    const maxPerSource = Math.max(0, ...perSource.values());
    if (members.length > 1 && maxPerSource <= 1) {
      clusters.push(clusterFromMembers(members));
    } else {
      for (const m of members) clusters.push(clusterFromMembers([m]));
    }
  }
  clusters.sort((a, b) => {
    if (a.sortableTime !== b.sortableTime) return b.sortableTime - a.sortableTime;
    return a.date.localeCompare(b.date, "lv");
  });

  const bySourceMap = new Map<string, UnifiedIncidentRow[]>();
  for (const row of sorted) {
    const list = bySourceMap.get(row.sourceLabel) ?? [];
    list.push(row);
    bySourceMap.set(row.sourceLabel, list);
  }
  const bySource = [...bySourceMap.entries()].map(([label, list]) => sourceSummary(label, list));

  const clusterAmounts = clusters.map((c) => c.averageEur).filter((n): n is number => n != null);
  const totalSumEur = clusterAmounts.length ? clusterAmounts.reduce((s, n) => s + n, 0) : null;
  const overallAverageEur =
    clusterAmounts.length > 0 ? Math.round(totalSumEur! / clusterAmounts.length) : null;

  return {
    clusters,
    bySource,
    uniqueCount: clusters.length,
    rawCount: rows.length,
    totalSumEur,
    overallAverageEur,
  };
}

export function formatUnifiedIncidentCountLabel(n: number): string {
  if (n === 1) return "1 negadījums";
  return `${n} negadījumi`;
}
