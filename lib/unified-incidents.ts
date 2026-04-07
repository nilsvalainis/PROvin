/**
 * Vienota negadījumu tabula PDF — AutoDNA, CarVertical, LTAB, Citi avoti (tikai rindas ar aizpildītu „Zaudējumu summu”).
 */

import type { ClientManualLtabBlockPdf, ClientManualVendorBlockPdf, LtabIncidentRow } from "@/lib/admin-source-blocks";
import { parseMileageDateForSort } from "@/lib/unified-mileage";

export type UnifiedIncidentRow = {
  date: string;
  lossAmount: string;
  country: string;
  sortableTime: number;
  sourceOrder: number;
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
  const push = (r: LtabIncidentRow) => {
    if (!incidentRowHasLossAmount(r)) return;
    const d = r.csngDate.trim();
    out.push({
      date: d || "—",
      lossAmount: r.lossAmount.trim(),
      country: r.incidentNo.trim() || "—",
      sortableTime: parseMileageDateForSort(d),
      sourceOrder: sourceOrder++,
    });
  };
  for (const b of args.manualVendorBlocks ?? []) {
    if (omitTitles?.has(b.title)) continue;
    for (const r of b.incidentRows) push(r);
  }
  if (!args.options?.omitLtab) {
    for (const r of args.manualLtabBlock?.rows ?? []) push(r);
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
