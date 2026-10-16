import { describe, expect, it } from "vitest";
import { defaultIrissListPrefs } from "@/lib/iriss-listings-operator-prefs";
import { orderRoomHitStockNo, orderRoomHitPricing } from "@/lib/iriss-order-room-hit-pricing";
import type { IrissOrderRoomHit } from "@/lib/iriss-order-room";

function hit(partial: Partial<IrissOrderRoomHit> & Pick<IrissOrderRoomHit, "id">): IrissOrderRoomHit {
  return {
    platform: "ecarstrade",
    externalId: "7708275",
    detailUrl: "",
    orderIds: ["order-1"],
    title: "Skoda Superb",
    year: "2021",
    firstRegistration: "2021-08",
    mileageKm: 241856,
    fuel: "Petrol",
    transmission: "Manual",
    powerKw: "110",
    color: "",
    bodyType: "",
    imageUrl: "",
    imageUrls: [],
    imageCount: 0,
    vin: "",
    price: 8600,
    priceStart: null,
    priceMinimal: null,
    priceCurrent: 8600,
    priceBuyNow: null,
    priceEstimate: null,
    priceTotal: null,
    stockNumber: "",
    auctionId: "",
    auctionStage: "",
    auctionStartAt: "",
    auctionEndAt: "",
    countryCode: "DE",
    vatNote: "",
    change: "unchanged",
    firstSeenAt: "",
    lastSeenAt: "",
    location: "Berlin, DE",
    ...partial,
  };
}

describe("orderRoomHitPricing", () => {
  it("exposes stock no and cost breakdown fields", () => {
    expect(orderRoomHitStockNo(hit({ id: "x", externalId: "7708275" }))).toBe("7708275");
    const p = orderRoomHitPricing(hit({ id: "x" }), defaultIrissListPrefs(), 15500);
    expect(p.bid).toBe(8600);
    expect(p.real?.total).toBeGreaterThan(8600);
    expect(p.mb).toBeGreaterThan(p.bid ?? 0);
  });
});
