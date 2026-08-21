import { describe, expect, it } from "vitest";
import { applyAdifyHistoryToTirgus, normalizeAdifyHistoryItems } from "@/lib/adify-listing-history";
import { emptyTirgusFields } from "@/lib/admin-source-blocks";
import {
  applyListingOdometerToTirgus,
  formatListingOdometerKm,
  isSsLvListingUrl,
  LISTING_MILEAGE_SOURCE_GENERIC,
  LISTING_MILEAGE_SOURCE_SSLV,
  LISTING_ODOMETER_COUNTRY_LV,
  resolveListingMileageChartRow,
} from "@/lib/listing-odometer";

const SSLV = "https://www.ss.lv/msg/lv/transport/cars/audi/q7/bcdpnx.html";

describe("isSsLvListingUrl", () => {
  it("accepts ss.lv / m.ss.lv / ss.com", () => {
    expect(isSsLvListingUrl(SSLV)).toBe(true);
    expect(isSsLvListingUrl("https://m.ss.lv/msg/lv/transport/cars/bmw/x.html")).toBe(true);
    expect(isSsLvListingUrl("https://www.ss.com/msg/lv/transport/cars/audi/q7/bcdpnx.html")).toBe(true);
  });

  it("rejects other portals", () => {
    expect(isSsLvListingUrl("https://autoplius.lt/skelbimai/123")).toBe(false);
    expect(isSsLvListingUrl("")).toBe(false);
  });
});

describe("formatListingOdometerKm", () => {
  it("keeps grouped digits from listing text", () => {
    expect(formatListingOdometerKm("233 000 km")).toBe("233 000");
    expect(formatListingOdometerKm("167000")).toBe("167 000");
  });

  it("drops values below 100 km", () => {
    expect(formatListingOdometerKm("12")).toBe("");
  });
});

describe("applyListingOdometerToTirgus — SS.LV", () => {
  const now = new Date(2026, 7, 13);
  const snap = normalizeAdifyHistoryItems(
    [[{ price: 23950, mileage: 233000, year: 2015, created: "2026-07-16T13:48:01" }]],
    now,
  );

  it("uses Adify mileage, first publication date and Latvia", () => {
    const withHistory = applyAdifyHistoryToTirgus(emptyTirgusFields(), snap);
    const next = applyListingOdometerToTirgus(withHistory, { listingUrl: SSLV });
    expect(next.listingCreated).toBe("16.07.2026");
    expect(next.listingMileageDate).toBe("16.07.2026");
    expect(next.listingMileageOdometer).toBe("233 000");
    expect(next.listingMileageCountry).toBe(LISTING_ODOMETER_COUNTRY_LV);
  });

  it("prefers ss.lv scrape km over Adify mileage", () => {
    const withHistory = applyAdifyHistoryToTirgus(emptyTirgusFields(), snap);
    const next = applyListingOdometerToTirgus(withHistory, {
      listingUrl: SSLV,
      scrapeKm: "234 500 km",
      scrapePostedDate: "20.07.2026",
    });
    expect(next.listingMileageOdometer).toBe("234 500");
    expect(next.listingMileageDate).toBe("16.07.2026");
  });

  it("fills first-pub date from scrape when Adify is missing", () => {
    const next = applyListingOdometerToTirgus(emptyTirgusFields(), {
      listingUrl: SSLV,
      scrapeKm: "167 000 km",
      scrapePostedDate: "20.05.2026",
    });
    expect(next.listingCreated).toBe("20.05.2026");
    expect(next.listingMileageDate).toBe("20.05.2026");
    expect(next.listingMileageOdometer).toBe("167 000");
    expect(next.listingMileageCountry).toBe(LISTING_ODOMETER_COUNTRY_LV);
  });
});

describe("resolveListingMileageChartRow", () => {
  it("for SS.LV always uses listingCreated + Latvia even if date/country were edited", () => {
    const row = resolveListingMileageChartRow(
      {
        ...emptyTirgusFields(),
        listingCreated: "16.07.2026",
        listingMileageDate: "01.08.2026",
        listingMileageOdometer: "233 000",
        listingMileageCountry: "Vācija",
      },
      SSLV,
    );
    expect(row).toEqual({
      date: "16.07.2026",
      odometer: "233 000",
      country: LISTING_ODOMETER_COUNTRY_LV,
      sourceLabel: LISTING_MILEAGE_SOURCE_SSLV,
    });
  });

  it("for other portals keeps stored date and country", () => {
    const row = resolveListingMileageChartRow(
      {
        ...emptyTirgusFields(),
        listingCreated: "01.01.2026",
        listingMileageDate: "02.02.2026",
        listingMileageOdometer: "167000",
        listingMileageCountry: "Lietuva",
      },
      "https://autoplius.lt/skelbimai/123",
    );
    expect(row).toEqual({
      date: "02.02.2026",
      odometer: "167 000",
      country: "Lietuva",
      sourceLabel: LISTING_MILEAGE_SOURCE_GENERIC,
    });
  });

  it("returns null without odometer or date", () => {
    expect(resolveListingMileageChartRow(emptyTirgusFields(), SSLV)).toBeNull();
    expect(
      resolveListingMileageChartRow(
        { ...emptyTirgusFields(), listingMileageOdometer: "120000" },
        SSLV,
      ),
    ).toBeNull();
  });
});
