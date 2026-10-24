import { describe, expect, it } from "vitest";
import { irissOfferSeedFromHit } from "@/lib/iriss-order-offer-from-hit";
import type { IrissOrderRoomHit } from "@/lib/iriss-order-room";

function hit(partial: Partial<IrissOrderRoomHit> & Pick<IrissOrderRoomHit, "id">): IrissOrderRoomHit {
  return {
    platform: "auto1",
    externalId: partial.id,
    detailUrl: "",
    orderIds: ["order-1"],
    title: "Audi A6",
    year: "2014",
    firstRegistration: "2014-05",
    mileageKm: 180000,
    fuel: "diesel",
    transmission: "automatic",
    powerKw: "230",
    color: "melna",
    bodyType: "avant",
    imageUrl: "",
    imageUrls: [],
    imageCount: 0,
    vin: "",
    price: 14900,
    priceStart: null,
    priceMinimal: null,
    priceCurrent: null,
    priceBuyNow: null,
    priceEstimate: null,
    priceTotal: null,
    stockNumber: "",
    auctionId: "",
    auctionStage: "",
    auctionStartAt: "",
    auctionEndAt: "",
    countryCode: "",
    vatNote: "",
    change: "unchanged",
    firstSeenAt: "",
    lastSeenAt: "",
    location: "",
    priceHistory: [],
    ...partial,
  };
}

describe("irissOfferSeedFromHit (j41b - Auto1/Openlane dati, kas jau ir hit objektā)", () => {
  it("passes doorCount through when the listing sync already has it", () => {
    const seed = irissOfferSeedFromHit(hit({ id: "a", doorCount: "5/5" }));
    expect(seed.doorCount).toBe("5/5");
  });

  it("leaves doorCount empty when the listing never had it (no regression)", () => {
    const seed = irissOfferSeedFromHit(hit({ id: "b" }));
    expect(seed.doorCount).toBe("");
  });

  it("still leaves damageGrade/equipmentHighlights empty here - LV translation is async, filled by the caller", () => {
    const seed = irissOfferSeedFromHit(hit({ id: "c", damageRaw: "Rear bumper scratched" }));
    expect(seed.damageGrade).toBe("");
    expect(seed.equipmentHighlights).toBe("");
  });

  it("keeps originCountry from countryCode unchanged (already correct, j41)", () => {
    const seed = irissOfferSeedFromHit(hit({ id: "d", countryCode: "DE", sourceCountry: "NL" }));
    expect(seed.originCountry).toBe("DE");
  });
});
