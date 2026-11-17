import {
  getIrissListingsStorageState,
  readIrissListingsDismissed,
} from "@/lib/iriss-listings-aggregate-store";
import { readIrissListingsLatestViewWithMarketplace } from "@/lib/marketplace/view";
import { emptyIrissListingsDismissed } from "@/lib/iriss-listings-dismiss";
import { prepareIrissListingMatchWorkspace } from "@/lib/iriss-listing-match-store";
import { gateListingVehiclesForView, isEcarstradeNoPriceNoBid } from "@/lib/iriss-listing-order-gate";
import { irissListingOrderBrief, listingVehicleOrderIds } from "@/lib/iriss-listings-orders";
import { listIrissPasutijumi, readIrissListingOrderOv } from "@/lib/iriss-pasutijumi-store";
import { irissScanOrderBrief, vehicleInListingDataset, type IrissListingDataset } from "@/lib/iriss-scan-listings";
import { listIrissScan } from "@/lib/iriss-scan-store";
import type { IrissListingVehicle } from "@/lib/iriss-listings-types";

export type IrissListingGoneCounts = Record<IrissListingDataset, number>;

/**
 * Pazudušie auto (parasti ~85% no kopas) lapā netiek sūtīti: tos ielādē tikai cilnē „Pazuduši”.
 * Skaitu katram datu kopumam aprēķina serverī ar servera orderOv (klienta lokālās izmaiņas var to nedaudz mainīt).
 */
export function splitGoneListingVehicles<T extends Pick<IrissListingVehicle, "id" | "orderIds" | "change">>(
  vehicles: readonly T[],
  opts: { orderOv: Record<string, string[]>; matchOrderIds: Record<string, string[]> },
): { active: T[]; gone: T[]; goneCounts: IrissListingGoneCounts } {
  const active: T[] = [];
  const gone: T[] = [];
  const goneCounts: IrissListingGoneCounts = { orders: 0, scan: 0 };
  for (const v of vehicles) {
    if (v.change !== "gone") {
      active.push(v);
      continue;
    }
    gone.push(v);
    const ids = [...listingVehicleOrderIds(v.id, v.orderIds, opts.orderOv), ...(opts.matchOrderIds[v.id] ?? [])];
    if (vehicleInListingDataset(ids, "orders")) goneCounts.orders += 1;
    if (vehicleInListingDataset(ids, "scan")) goneCounts.scan += 1;
  }
  return { active, gone, goneCounts };
}

/** Sludinājumu lapas un `/api/admin/iriss-listings/gone` kopīgā ielāde (tie paši filtri un pasūtījumu piesaiste). */
export async function loadIrissSludinajumiPageData() {
  const storage = getIrissListingsStorageState();
  // Abi datu kopumi (klientu pasūtījumi + SCAN) ielādējas paralēli; kļūda vienā neaptur otru.
  const [latest, dismissedView, orders, scanOrders, initialOrderOv] = await Promise.all([
    storage.enabled ? readIrissListingsLatestViewWithMarketplace() : Promise.resolve(null),
    storage.enabled ? readIrissListingsDismissed() : Promise.resolve(emptyIrissListingsDismissed()),
    listIrissPasutijumi().then((rows) => rows.map(irissListingOrderBrief)).catch(() => []),
    listIrissScan().then((rows) => rows.map(irissScanOrderBrief)).catch(() => []),
    readIrissListingOrderOv().catch(() => ({}) as Record<string, string[]>),
  ]);
  const listable = (latest?.vehicles ?? []).filter((v) => !isEcarstradeNoPriceNoBid(v));
  const match = storage.enabled
    ? await prepareIrissListingMatchWorkspace(
        listable,
        orders.map((o) => ({
          id: o.id,
          brandModel: o.brandModel,
          listStatus: o.listStatus,
          clientFirstName: o.clientName,
          productionYears: o.productionYears,
          totalBudget: o.budgetRaw,
          engineType: o.engineType,
          transmission: o.transmission,
        })),
      ).catch(() => null)
    : null;
  const matchOrderIds = match?.orderIdsByListing ?? {};
  const view = latest
    ? { ...latest, vehicles: gateListingVehiclesForView(listable, orders, { orderOv: initialOrderOv, matchOrderIds }) }
    : null;
  return {
    storage,
    view,
    dismissed: dismissedView.entries,
    orders,
    scanOrders,
    initialOrderOv,
    match,
    matchOrderIds,
  };
}
