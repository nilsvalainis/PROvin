import type { IrissScanListOrder, IrissScanListRow } from "@/lib/iriss-scan-types";

export function orderIrissScanListRows(
  rows: readonly IrissScanListRow[],
  order: IrissScanListOrder | null,
): IrissScanListRow[] {
  const byUpdated = (a: IrissScanListRow, b: IrissScanListRow) =>
    a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0;
  if (!order) return [...rows].sort(byUpdated);
  const map = new Map(rows.map((r) => [r.id, r]));
  const used = new Set<string>();
  const pinned: IrissScanListRow[] = [];
  const unpinned: IrissScanListRow[] = [];
  for (const id of order.pinnedOrder) {
    const row = map.get(id);
    if (!row) continue;
    pinned.push(row);
    used.add(id);
  }
  for (const id of order.unpinnedOrder) {
    const row = map.get(id);
    if (!row) continue;
    unpinned.push(row);
    used.add(id);
  }
  const rest = rows.filter((r) => !used.has(r.id)).sort(byUpdated);
  return [...pinned, ...unpinned, ...rest];
}
