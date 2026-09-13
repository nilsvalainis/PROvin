import { describe, expect, it } from "vitest";
import {
  collectListingPriceLifecyclePoints,
  formatListingPriceDelta,
  formatListingPriceEur,
} from "@/lib/listing-price-lifecycle";

describe("collectListingPriceLifecyclePoints", () => {
  it("keeps the first date+price and only later price changes", () => {
    const points = collectListingPriceLifecyclePoints({
      priceHistory: [
        { date: "10.03.2026", price: 9500, mileage: 190000, year: 2012, delta: 0 },
        { date: "01.02.2026", price: 10000, mileage: 185000, year: 2012, delta: -500 },
        { date: "15.01.2026", price: 10000, mileage: 180000, year: 2012, delta: 0 },
      ],
    });
    expect(points).toEqual([
      { date: "15.01.2026", price: 10000, mileageKm: 180000, delta: 0 },
      { date: "10.03.2026", price: 9500, mileageKm: 190000, delta: -500 },
    ]);
  });

  it("uses an earlier listingCreated date with the first known price", () => {
    const points = collectListingPriceLifecyclePoints({
      listingCreated: "01.12.2025",
      priceHistory: [{ date: "15.01.2026", price: 8000, mileage: 120000, year: 2014, delta: 0 }],
    });
    expect(points).toEqual([
      { date: "01.12.2025", price: 8000, mileageKm: 120000, delta: 0 },
    ]);
  });

  it("formats price and ASCII deltas", () => {
    expect(formatListingPriceEur(8500)).toBe("8 500 €");
    expect(formatListingPriceDelta(500)).toBe("+500");
    expect(formatListingPriceDelta(-1000)).toBe("-1 000");
  });
});
