import { describe, expect, it } from "vitest";
import { formatIrissListingsForGemini, pickIrissListingComps } from "@/lib/iriss-listings-gemini-filter";
import type { IrissListingAggregateItem } from "@/lib/iriss-listings-types";

function item(partial: Partial<IrissListingAggregateItem> & Pick<IrissListingAggregateItem, "title">): IrissListingAggregateItem {
  return {
    id: "1",
    aggregatedAt: "2026-01-01T00:00:00Z",
    sourcePlatform: "mobile",
    sourceUrl: "https://mobile.de/x",
    sourceDomain: "mobile.de",
    orderId: "o1",
    orderBrandModel: "BMW 520",
    title: partial.title,
    year: "2018",
    imageUrl: "",
    pricePrimary: { value: "18900", currency: "EUR" },
    priceSecondary: null,
    rawSnapshotRef: "",
    status: "ok",
    statusNote: "",
    ...partial,
  };
}

describe("pickIrissListingComps", () => {
  it("prefers matching brand/model", () => {
    const items = [
      item({ title: "Audi A4" }),
      item({ title: "BMW 520d xDrive" }),
      item({ title: "BMW 520 Touring" }),
    ];
    const picked = pickIrissListingComps(items, "BMW 520");
    expect(picked.filter((i) => i.title.includes("BMW")).length).toBeGreaterThanOrEqual(2);
  });
});

describe("formatIrissListingsForGemini", () => {
  it("includes platform labels", () => {
    const text = formatIrissListingsForGemini([item({ title: "Test", sourcePlatform: "autobid" })]);
    expect(text).toContain("Autobid");
    expect(text).toContain("18900");
  });
});
