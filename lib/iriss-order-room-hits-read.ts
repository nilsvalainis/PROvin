import "server-only";

import { isEcarstradeNoPriceNoBid } from "@/lib/iriss-listing-order-gate";
import { orderRoomMatchProps, prepareIrissListingMatchWorkspace } from "@/lib/iriss-listing-match-store";
import { buildIrissOrderRoomHits, type IrissOrderRoomHit } from "@/lib/iriss-order-room";
import { readIrissListingOrderOv, readIrissPasutijums } from "@/lib/iriss-pasutijumi-store";
import { readIrissListingsLatestViewWithMarketplace } from "@/lib/marketplace/view";

export async function readIrissOrderRoomHitsForOrder(orderId: string): Promise<IrissOrderRoomHit[]> {
  const rec = await readIrissPasutijums(orderId);
  if (!rec) return [];
  const latest = await readIrissListingsLatestViewWithMarketplace();
  const listable = (latest?.vehicles ?? []).filter((v) => !isEcarstradeNoPriceNoBid(v));
  const orderOv = await readIrissListingOrderOv().catch(() => ({}));
  const match = await prepareIrissListingMatchWorkspace(listable, []).catch(() => null);
  const roomMatch = match ? orderRoomMatchProps(match.state, orderId, match.duplicatesByListing) : null;
  return buildIrissOrderRoomHits(
    listable,
    orderId,
    orderOv,
    roomMatch ? new Set(roomMatch.extraListingIds) : undefined,
    rec.brandModel ?? "",
  );
}
