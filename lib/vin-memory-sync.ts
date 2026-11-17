import "server-only";

import { listAllDashboardDraftIndexEntries } from "@/lib/admin-dashboard-draft-index";
import { readIrissListingsLatestView } from "@/lib/iriss-listings-aggregate-store";
import { addVinObservations, isVinMemoryStoreDurable, type VinMemoryWriteResult } from "@/lib/vin-memory-store";
import { observationsFromListings, observationsFromOrders } from "@/lib/vin-memory-feed";

/** Dienas cron: izsoļu ielases auto ar īstu VIN + pasūtījumi -> VIN atmiņa. */
export async function runVinMemorySync(now: Date = new Date()): Promise<VinMemoryWriteResult & { listings: number; orders: number; skippedNoVin: number }> {
  if (!isVinMemoryStoreDurable()) {
    return { ok: false, added: 0, updated: 0, shards: 0, failedShards: [], listings: 0, orders: 0, skippedNoVin: 0 };
  }
  const view = await readIrissListingsLatestView();
  const vehicles = view?.vehicles ?? [];
  const fromListings = observationsFromListings(vehicles);
  const orders = await listAllDashboardDraftIndexEntries();
  const fromOrders = observationsFromOrders(orders);
  const r = await addVinObservations([...fromListings.inputs, ...fromOrders.inputs], now);
  return { ...r, listings: fromListings.inputs.length, orders: fromOrders.inputs.length, skippedNoVin: fromListings.skippedNoVin + fromOrders.skippedNoVin };
}
