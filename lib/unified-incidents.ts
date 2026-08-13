/**
 * Vienota negadījumu tabula PDF — AutoDNA, CarVertical, LTAB, Citi avoti (tikai rindas ar aizpildītu „Zaudējumu summu”).
 * Loģiskais apkopojums: tas pats mēnesis + valsts (arī starp avotiem) → viens negadījums ar vidējo summu
 * un katra avota novērtējumu.
 */

import type { ClientManualLtabBlockPdf, ClientManualVendorBlockPdf, LtabIncidentRow } from "@/lib/admin-source-blocks";
import { formatAutoRecordsDateForOutput } from "@/lib/auto-records-paste-parse";
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

export type UnifiedIncidentSourceValuation = {
  sourceLabel: string;
  displayAmount: string;
  amountEur: number | null;
};

/** Viens loģisks negadījums (pēc apvienošanas starp avotiem tajā pašā mēnesī). */
export type UnifiedIncidentCluster = {
  date: string;
  country: string;
  displayAmount: string;
  averageEur: number | null;
  averaged: boolean;
  sourceValuations: UnifiedIncidentSourceValuation[];
  sortableTime: number;
};

export type UnifiedIncidentAggregation = {
  clusters: UnifiedIncidentCluster[];
  uniqueCount: number;
  rawCount: number;
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

/** `2021-06` vai null, ja mēnesi nevar nolasīt. */
export function incidentYearMonthKey(row: Pick<UnifiedIncidentRow, "date" | "sortableTime">): string | null {
  if (row.sortableTime !== Number.NEGATIVE_INFINITY) {
    const d = new Date(row.sortableTime);
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    if (y >= 1900 && y <= 2100 && m >= 1 && m <= 12) {
      return `${y}-${String(m).padStart(2, "0")}`;
    }
  }
  const t = row.date.trim();
  const monthYear = t.match(/^(\d{1,2})\.(\d{4})$/);
  if (monthYear) {
    const m = Number(monthYear[1]);
    const y = Number(monthYear[2]);
    if (m >= 1 && m <= 12 && y >= 1900 && y <= 2100) return `${y}-${String(m).padStart(2, "0")}`;
  }
  return null;
}

function incidentClusterKey(row: UnifiedIncidentRow): string {
  const ym = incidentYearMonthKey(row);
  const country = incidentCountryKey(row.country);
  if (!ym) return `unique:${row.sourceOrder}`;
  return `${ym}|${country}`;
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

function formatMonthYearDisplay(ym: string): string {
  const [y, m] = ym.split("-");
  if (!y || !m) return ym;
  return `${m}.${y}`;
}

function clusterDisplayDate(members: UnifiedIncidentRow[], ym: string | null): string {
  const dayDates = new Set<string>();
  for (const m of members) {
    if (m.sortableTime === Number.NEGATIVE_INFINITY) continue;
    const lv = formatAutoRecordsDateForOutput(m.date) || m.date.trim();
    if (/^\d{2}\.\d{2}\.\d{4}$/.test(lv)) dayDates.add(lv);
  }
  if (dayDates.size === 1) return [...dayDates][0]!;
  if (ym) return formatMonthYearDisplay(ym);
  return sortUnifiedIncidentsNewestFirst(members)[0]?.date.trim() || "—";
}

function sourceValuation(label: string, rows: UnifiedIncidentRow[]): UnifiedIncidentSourceValuation {
  const values = amountsOf(rows);
  const avg = averageEur(values);
  if (rows.length === 1) {
    return {
      sourceLabel: label,
      displayAmount: rows[0]!.lossAmount.trim() || (avg != null ? formatLossEurWholeDisplay(avg) : "—"),
      amountEur: avg,
    };
  }
  return {
    sourceLabel: label,
    displayAmount: avg != null ? formatLossEurWholeDisplay(avg) : "—",
    amountEur: avg,
  };
}

function clusterFromMembers(members: UnifiedIncidentRow[]): UnifiedIncidentCluster {
  const newest = sortUnifiedIncidentsNewestFirst(members)[0]!;
  const bySource = new Map<string, UnifiedIncidentRow[]>();
  for (const m of members) {
    const list = bySource.get(m.sourceLabel) ?? [];
    list.push(m);
    bySource.set(m.sourceLabel, list);
  }
  const sourceValuations = [...bySource.entries()].map(([label, list]) => sourceValuation(label, list));
  const sourceAmounts = sourceValuations.map((s) => s.amountEur).filter((n): n is number => n != null);
  const avg = averageEur(sourceAmounts);
  const averaged = sourceValuations.length > 1 && avg != null;
  const displayAmount = averaged
    ? formatLossEurWholeDisplay(avg)
    : sourceValuations[0]?.displayAmount || newest.lossAmount.trim() || "—";
  const country = normalizeCountryNameLv(newest.country) || newest.country.trim() || "—";
  const ym = incidentYearMonthKey(newest) ?? incidentYearMonthKey(members[0]!);
  return {
    date: clusterDisplayDate(members, ym),
    country,
    displayAmount,
    averageEur: avg,
    averaged,
    sourceValuations,
    sortableTime: newest.sortableTime,
  };
}

/**
 * Apvieno to pašu mēnesi + valsti no visiem avotiem par vienu negadījumu.
 * Vidējā summa = vidējais no katra avota novērtējuma (nevis visu rindu aritmētiskais, lai AutoDNA
 * vairākas rindas par to pašu CSNg nepārsvarotu LTAB).
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

  const clusters = [...groups.values()].map(clusterFromMembers);
  clusters.sort((a, b) => {
    if (a.sortableTime !== b.sortableTime) return b.sortableTime - a.sortableTime;
    return a.date.localeCompare(b.date, "lv");
  });

  return {
    clusters,
    uniqueCount: clusters.length,
    rawCount: rows.length,
  };
}

export function formatUnifiedIncidentCountLabel(n: number): string {
  if (n === 1) return "1 negadījums";
  return `${n} negadījumi`;
}

export function formatIncidentSourceValuationsLine(c: UnifiedIncidentCluster): string {
  if (c.sourceValuations.length <= 1) return "";
  return c.sourceValuations.map((s) => `${s.sourceLabel} ${s.displayAmount}`).join(" · ");
}
