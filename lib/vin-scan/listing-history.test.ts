import { describe, expect, it } from "vitest";

import { vinScanParseFromListingHistory } from "@/lib/vin-scan/listing-history";

describe("vinScanParseFromListingHistory", () => {
  it("kartē Adify rindas uz strukturētiem laukiem", () => {
    const parsed = vinScanParseFromListingHistory({
      found: true,
      message: "ok",
      rows: [
        { date: "2026-09-08", price: 23950, mileage: 198000, year: 2013, delta: -950 },
        { date: "2026-07-16", price: 24900, mileage: 191000, year: 2013, delta: 0 },
      ],
      durationDays: 54,
      oldestDate: "16.07.2026",
      newestDate: "08.09.2026",
      priceChangeEur: -950,
      listingUrl: "https://www.ss.lv/msg/lv/transport/cars/vw/sharan/x.html",
      source: "adify",
    });
    expect(parsed.status).toBe("found");
    expect(parsed.listings).toHaveLength(2);
    expect(parsed.listings?.[0]).toMatchObject({ price: "€ 23 950", odometer: "198 000 km" });
    expect(parsed.vehicle?.year).toBe("2013");
    expect(parsed.openUrl).toContain("adify.lv/history?url=");
  });

  it("nav datu", () => {
    expect(
      vinScanParseFromListingHistory({
        found: false,
        message: "nav",
        rows: [],
        durationDays: 0,
        oldestDate: "",
        newestDate: "",
        priceChangeEur: 0,
        listingUrl: null,
      }).status,
    ).toBe("none");
  });
});
