import type { IrissListingVehicle, IrissListingsLatestView } from "@/lib/iriss-listings-types";
import { collapseMarketplaceListingsByOrder } from "@/lib/marketplace/dedupe";
import { marketplaceListingsToVehicles } from "@/lib/marketplace/to-listing-vehicle";
import type { MarketplaceStoredListing } from "@/lib/marketplace/types";

export function mergeMarketplaceVehicles(
  auctionVehicles: readonly IrissListingVehicle[],
  marketplaceVehicles: readonly IrissListingVehicle[],
): IrissListingVehicle[] {
  const byId = new Map<string, IrissListingVehicle>();
  for (const v of auctionVehicles) byId.set(v.id, v);
  for (const v of marketplaceVehicles) {
    const prev = byId.get(v.id);
    if (!prev) {
      byId.set(v.id, v);
      continue;
    }
    const orderIds = [...new Set([...prev.orderIds, ...v.orderIds])];
    byId.set(v.id, { ...prev, orderIds });
  }
  return [...byId.values()];
}

export function mergeMarketplaceIntoLatestView(
  latest: IrissListingsLatestView | null,
  stored: readonly MarketplaceStoredListing[],
  nowMs = Date.now(),
): IrissListingsLatestView | null {
  const marketplaceVehicles = marketplaceListingsToVehicles(collapseMarketplaceListingsByOrder(stored), nowMs);
  if (!latest) {
    if (marketplaceVehicles.length === 0) return null;
    const now = new Date(nowMs).toISOString();
    return {
      version: 2,
      generatedAt: now,
      summary: {
        startedAt: now,
        finishedAt: now,
        runId: "marketplace-only",
        totalSources: 0,
        okCount: 0,
        loginRequiredCount: 0,
        blockedByWafCount: 0,
        parseFailedCount: 0,
        fetchFailedCount: 0,
        relayNotConfiguredCount: 0,
        skippedCount: 0,
        vehicleCount: marketplaceVehicles.length,
        newCount: marketplaceVehicles.length,
        priceChangedCount: 0,
        goneCount: 0,
      },
      sources: [],
      vehicles: marketplaceVehicles,
    };
  }
  const vehicles = mergeMarketplaceVehicles(latest.vehicles, marketplaceVehicles);
  return { ...latest, vehicles, summary: { ...latest.summary, vehicleCount: vehicles.length } };
}
