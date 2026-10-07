import { describe, expect, it } from "vitest";
import {
  auctionCountdown,
  listingCardPrices,
  parseListingSort,
  sortListingVehicles,
  type ListingSort,
} from "@/lib/iriss-listings-list-view";
import type { IrissListingVehicle } from "@/lib/iriss-listings-types";

const NOW = Date.parse("2026-10-07T12:00:00.000Z");

function car(partial: Partial<IrissListingVehicle> & { id: string }): IrissListingVehicle {
  return {
    platform: "autobid",
    externalId: partial.id,
    detailUrl: "",
    orderIds: ["o1"],
    orderBrandModels: ["Volvo"],
    title: partial.id,
    manufacturer: "",
    year: "",
    firstRegistration: "",
    mileageKm: null,
    fuel: "",
    transmission: "",
    powerKw: "",
    location: "",
    countryCode: "",
    imageUrl: "",
    currency: "EUR",
    priceStart: null,
    priceMinimal: null,
    priceCurrent: null,
    priceBuyNow: null,
    vatNote: "",
    auctionId: "",
    auctionStartAt: "",
    auctionEndAt: "",
    auctionStage: "",
    firstSeenAt: "2026-10-01T00:00:00.000Z",
    lastSeenAt: "2026-10-07T00:00:00.000Z",
    missingRuns: 0,
    change: "unchanged",
    priceHistory: [],
    ...partial,
  };
}

describe("parseListingSort", () => {
  it("defaults to newest and keeps known ids", () => {
    expect(parseListingSort(null)).toBe("newest");
    expect(parseListingSort("")).toBe("newest");
    expect(parseListingSort("nope")).toBe("newest");
    expect(parseListingSort("ending")).toBe("ending");
    expect(parseListingSort("price-desc")).toBe("price-desc");
  });
});

describe("sortListingVehicles", () => {
  const rows = [
    car({ id: "old-start", auctionStartAt: "2026-10-05T08:00:00.000Z", firstSeenAt: "2026-10-07T10:00:00.000Z", manufacturer: "Volvo", title: "XC60", priceCurrent: 20000, auctionEndAt: "2026-10-08T12:00:00.000Z" }),
    car({ id: "new-seen", firstSeenAt: "2026-10-07T11:00:00.000Z", manufacturer: "Audi", title: "A4", priceStart: 10000, auctionEndAt: "2026-10-07T12:30:00.000Z" }),
    car({ id: "no-price", manufacturer: "BMW", title: "X3", auctionEndAt: "2026-10-06T12:00:00.000Z" }),
    car({ id: "no-end", manufacturer: "Audi", title: "A6", priceBuyNow: 30000, auctionStartAt: "2026-10-09T08:00:00.000Z" }),
  ];

  function ids(sort: ListingSort): string[] {
    return sortListingVehicles(rows, sort, NOW).map((v) => v.id);
  }

  it("newest uses auction start when present, otherwise first seen, latest first", () => {
    expect(ids("newest")).toEqual(["no-end", "new-seen", "old-start", "no-price"]);
  });

  it("ending soon puts upcoming ends first, then ended, then unknown", () => {
    expect(ids("ending")).toEqual(["new-seen", "old-start", "no-price", "no-end"]);
  });

  it("sorts brand A-Z and prices with unknowns last", () => {
    expect(ids("brand")).toEqual(["new-seen", "no-end", "no-price", "old-start"]);
    expect(ids("price-asc")).toEqual(["new-seen", "old-start", "no-end", "no-price"]);
    expect(ids("price-desc")).toEqual(["no-end", "old-start", "new-seen", "no-price"]);
  });
});

describe("listingCardPrices", () => {
  it("prefers current and buy now, then start and valuation", () => {
    expect(listingCardPrices(car({ id: "a", priceCurrent: 10, priceStart: 8, priceBuyNow: 12, priceMinimal: 9 }))).toEqual([
      { label: "Pašreizējā", amount: 10 },
      { label: "Pirkt tūlīt", amount: 12 },
    ]);
    expect(listingCardPrices(car({ id: "b", priceStart: 8, priceMinimal: 9 }))).toEqual([
      { label: "Sākuma", amount: 8 },
      { label: "Novērtējums", amount: 9 },
    ]);
    expect(listingCardPrices(car({ id: "c" }))).toEqual([
      { label: "Sākuma", amount: null },
      { label: "Novērtējums", amount: null },
    ]);
  });
});

describe("auctionCountdown", () => {
  it("formats days and clock, and colors by remaining time", () => {
    expect(auctionCountdown("", NOW)).toEqual({ text: "Beigu laiks nav zināms", tone: "unknown" });
    expect(auctionCountdown("2026-10-07T11:00:00.000Z", NOW)).toEqual({ text: "Beigusies", tone: "ended" });
    expect(auctionCountdown("2026-10-07T12:40:00.000Z", NOW)).toEqual({ text: "00:40:00", tone: "urgent" });
    expect(auctionCountdown("2026-10-08T10:00:00.000Z", NOW)).toEqual({ text: "22:00:00", tone: "soon" });
    expect(auctionCountdown("2026-10-09T16:13:27.000Z", NOW)).toEqual({ text: "2 d 04:13:27", tone: "calm" });
  });
});
