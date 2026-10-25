import "server-only";

import { findListingForAuctionLink, type IrissAuctionLink } from "@/lib/iriss-auction-link";
import { buildIrissOrderRoomHits, type IrissOrderRoomHit } from "@/lib/iriss-order-room";
import { readIrissListingsLatestViewWithMarketplace } from "@/lib/marketplace/view";

/** Tikai jau saglabātais IRISS sarakstu kešs (bez sync, bez releja). */
export async function findIrissOrderRoomHitForAuctionLink(link: IrissAuctionLink): Promise<IrissOrderRoomHit | null> {
  const latest = await readIrissListingsLatestViewWithMarketplace();
  const vehicle = findListingForAuctionLink(latest?.vehicles ?? [], link);
  if (!vehicle) return null;
  // Pasūtījuma piesaiste šeit nav svarīga: saite ir tieša lietotāja izvēle.
  const hit = buildIrissOrderRoomHits([vehicle], "", {}, new Set([vehicle.id]))[0];
  return hit ? { ...hit, orderIds: hit.orderIds.filter(Boolean) } : null;
}
