import { listingCopyId } from "@/lib/iriss-listings-detail-url";
import { listingCardGallery } from "@/lib/iriss-listings-card";
import {
  listingBidPrice,
  listingCardPriceLabel,
  listingExtrasI,
  listingFinalPrice,
  listingMaxBid,
  listingRealCost,
  type ListingPriceFields,
} from "@/lib/iriss-listings-cost";
import { listingCostsFor, type IrissListPrefs } from "@/lib/iriss-listings-operator-prefs";
import { listingTaxCostArgs, listingTaxResolved } from "@/lib/iriss-listings-vat";
import type { IrissOrderRoomHit } from "@/lib/iriss-order-room";

export function orderRoomHitStockNo(hit: IrissOrderRoomHit): string {
  return listingCopyId({
    platform: hit.platform,
    externalId: hit.externalId,
    stockNumber: hit.stockNumber,
    auctionId: hit.auctionId,
  });
}

export function orderRoomHitPriceFields(hit: IrissOrderRoomHit): ListingPriceFields {
  return {
    platform: hit.platform,
    priceCurrent: hit.priceCurrent,
    priceStart: hit.priceStart,
    priceMinimal: hit.priceMinimal,
    priceBuyNow: hit.priceBuyNow,
    priceEstimate: hit.priceEstimate,
    auctionStage: hit.auctionStage,
  };
}

export function orderRoomHitGallery(hit: IrissOrderRoomHit) {
  return listingCardGallery({ imageUrl: hit.imageUrl, imageUrls: hit.imageUrls });
}

export function orderRoomHitPricing(hit: IrissOrderRoomHit, prefs: IrissListPrefs, budget: number | null) {
  const priceFields = orderRoomHitPriceFields(hit);
  const tax = listingTaxResolved(hit, prefs.taxOv[hit.id]);
  const extras = listingExtrasI(listingCostsFor(prefs, hit.id));
  const bid = listingBidPrice(priceFields);
  const priceLabel = listingCardPriceLabel(priceFields);
  const taxArgs = listingTaxCostArgs(tax);
  const real = bid == null ? null : listingRealCost(taxArgs.kind, taxArgs.foreignVatPct, bid, extras);
  const gala = bid == null ? null : listingFinalPrice(tax, bid, extras);
  const mb = budget != null ? listingMaxBid(taxArgs.kind, taxArgs.foreignVatPct, budget, extras) : null;
  const room = mb != null && bid != null ? mb - bid : null;
  return { tax, bid, priceLabel, real, gala, mb, room, extras };
}
