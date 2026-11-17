import "server-only";

import { isEcarstradeNoPriceNoBid } from "@/lib/iriss-listing-order-gate";
import { loadIrissListingMatchState } from "@/lib/iriss-listing-match-store";
import { readIrissListingsLatestViewWithMarketplace } from "@/lib/marketplace/view";
import { irissScanBudgetFromFilters } from "@/lib/iriss-scan-filter-table";
import { buildIrissScanFindCards, type IrissScanFindCard } from "@/lib/iriss-scan-finds";
import { countIrissScanNewHitsByScan } from "@/lib/iriss-scan-list-view";
import { listIrissScan, readIrissScanListOrder } from "@/lib/iriss-scan-store";
import type { IrissScanListOrder, IrissScanListRow } from "@/lib/iriss-scan-types";

export type IrissScanPageData = {
  rows: IrissScanListRow[];
  initialListOrder: IrissScanListOrder | null;
  newHitsByScan: Record<string, number>;
  finds: IrissScanFindCard[];
  /** Pēdējā sludinājumu nolasīšana (sinhronizācija), nevis ieraksta labošanas laiks. */
  lastReadAt: string;
};

export async function loadIrissScanPageData(): Promise<IrissScanPageData> {
  const [rows, initialListOrder, match, latest] = await Promise.all([
    listIrissScan(),
    readIrissScanListOrder(),
    loadIrissListingMatchState().catch(() => null),
    readIrissListingsLatestViewWithMarketplace().catch(() => null),
  ]);
  const budgets: Record<string, number | null> = {};
  for (const row of rows) budgets[row.id] = irissScanBudgetFromFilters(row);
  const vehicles = (latest?.vehicles ?? []).filter((v) => !isEcarstradeNoPriceNoBid(v));
  const finds = buildIrissScanFindCards({
    vehicles,
    entries: match?.entries ?? [],
    budgetsByScanId: budgets,
    nowMs: Date.now(),
  });
  return {
    rows,
    initialListOrder,
    newHitsByScan: countIrissScanNewHitsByScan(finds.map((f) => ({ orderId: f.orderId, status: f.status }))),
    finds,
    lastReadAt: latest?.summary.finishedAt ?? "",
  };
}
