import { describe, expect, it } from "vitest";
import { formatIrissNewListingsEmail, newMatchingListings } from "@/lib/iriss-listings-new-notify";
import type { IrissListingVehicle } from "@/lib/iriss-listings-types";

function car(partial: Partial<IrissListingVehicle> & Pick<IrissListingVehicle, "id" | "change">): IrissListingVehicle {
  return {
    platform: "autobid",
    externalId: partial.id,
    detailUrl: "",
    orderIds: ["o1"],
    orderBrandModels: ["Volvo XC60"],
    sourceKeys: ["autobid|https://autobid.de/x"],
    title: partial.id,
    manufacturer: "Volvo",
    year: "2020",
    firstRegistration: "",
    mileageKm: null,
    fuel: "",
    transmission: "",
    powerKw: "",
    location: "",
    countryCode: "",
    imageUrl: "",
    currency: "EUR",
    priceStart: 10000,
    priceMinimal: null,
    priceCurrent: null,
    priceBuyNow: null,
    vatNote: "",
    auctionId: "",
    auctionStartAt: "",
    auctionEndAt: "",
    auctionStage: "",
    firstSeenAt: "",
    lastSeenAt: "",
    missingRuns: 0,
    priceHistory: [],
    ...partial,
  };
}

describe("IRISS new-listing notify", () => {
  it("emails only new non-rejected listings grouped by order", () => {
    const vehicles = newMatchingListings(
      [car({ id: "a", change: "new" }), car({ id: "b", change: "unchanged" }), car({ id: "c", change: "new" })],
      new Set(["c"]),
    );
    expect(vehicles.map((v) => v.id)).toEqual(["a"]);
    const mail = formatIrissNewListingsEmail({
      vehicles,
      orders: [{ id: "o1", clientName: "Anna Bērziņa", brandModel: "Volvo XC60" }],
    });
    expect(mail).not.toBeNull();
    expect(mail!.subject).toContain("1 jauns");
    expect(mail!.text).toContain("Volvo XC60");
    expect(mail!.text).toContain("Anna Bērziņa");
    expect(mail!.text).not.toContain("—");
  });

  it("returns null when there is nothing new", () => {
    expect(formatIrissNewListingsEmail({ vehicles: [], orders: [] })).toBeNull();
  });
});
