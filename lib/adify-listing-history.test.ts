import { describe, expect, it } from "vitest";
import {
  adifyChronologicalPriceRows,
  adifyDurationDays,
  applyAdifyHistoryToTirgus,
  formatAdifyDurationLabel,
  formatAdifySignedEur,
  normalizeAdifyHistoryItems,
  parseAdifyHistoryUrl,
} from "@/lib/adify-listing-history";
import { createDefaultSourceBlocks, emptyTirgusFields } from "@/lib/admin-source-blocks";

const Q7_URL = "https://www.ss.lv/msg/lv/transport/cars/audi/q7/bcdpnx.html";

describe("parseAdifyHistoryUrl", () => {
  it("reads ss.lv car listing id and kind", () => {
    expect(parseAdifyHistoryUrl(Q7_URL)).toEqual({ source: 0, kind: "car", id: "bcdpnx" });
  });

  it("accepts ss.com", () => {
    expect(parseAdifyHistoryUrl("https://www.ss.com/msg/lv/transport/cars/audi/q7/bcdpnx.html")?.id).toBe(
      "bcdpnx",
    );
  });
});

describe("normalizeAdifyHistoryItems — cenas paraugs", () => {
  const now = new Date(2026, 7, 13);
  const json = [
    [
      { price: 13700, mileage: 364584, year: 2016, created: "2026-08-01T10:00:00" },
      { price: 13700, mileage: 364584, year: 2016, created: "2026-07-25T10:00:00" },
      { price: 13700, mileage: 364584, year: 2016, created: "2026-06-27T10:00:00" },
      { price: 15999, mileage: 364584, year: 2016, created: "2026-06-10T10:00:00" },
      { price: 16500, mileage: 364584, year: 2016, created: "2026-05-26T10:00:00" },
      { price: 17490, mileage: 364584, year: 2016, created: "2026-05-20T10:00:00" },
    ],
  ];

  it("computes 85-day duration, oldest date and total price change", () => {
    const snap = normalizeAdifyHistoryItems(json, now);
    expect(snap.found).toBe(true);
    expect(snap.rows).toHaveLength(6);
    expect(snap.oldestDate).toBe("20.05.2026");
    expect(snap.newestDate).toBe("01.08.2026");
    expect(snap.priceChangeEur).toBe(-3790);
    expect(snap.durationDays).toBe(85);
    expect(formatAdifySignedEur(snap.priceChangeEur)).toBe("€ -3 790");
    expect(snap.rows[2]?.delta).toBe(-2299);
    expect(snap.rows[3]?.delta).toBe(-501);
    expect(snap.rows[4]?.delta).toBe(-990);
    expect(snap.rows[5]?.delta).toBe(0);
  });

  it("fills tirgus fields from Adify snapshot", () => {
    const snap = normalizeAdifyHistoryItems(json, now);
    const next = applyAdifyHistoryToTirgus(emptyTirgusFields(), snap);
    expect(next.listedForSale).toBe("85");
    expect(next.listingCreated).toBe("20.05.2026");
    expect(next.priceDrop).toBe("€ -3 790");
    expect(next.priceHistory).toHaveLength(6);
  });
});

describe("normalizeAdifyHistoryItems — Audi Q7 bcdpnx fixture", () => {
  const now = new Date(2026, 7, 13);
  const json = [
    [
      { price: 23950, mileage: 233000, year: 2015, created: "2026-08-13T15:33:01" },
      { price: 24500, mileage: 233000, year: 2015, created: "2026-07-30T14:57:02" },
      { price: 24900, mileage: 233000, year: 2015, created: "2026-07-16T13:48:01" },
    ],
  ];

  it("maps Q7 snapshots to days, created date and signed drop", () => {
    const snap = normalizeAdifyHistoryItems(json, now);
    expect(snap.durationDays).toBe(28);
    expect(snap.oldestDate).toBe("16.07.2026");
    expect(snap.priceChangeEur).toBe(-950);
    const next = applyAdifyHistoryToTirgus(createDefaultSourceBlocks().tirgus, snap);
    expect(next.listedForSale).toBe("28");
    expect(next.listingCreated).toBe("16.07.2026");
    expect(next.priceDrop).toBe("€ -950");
  });
});

describe("adifyDurationDays", () => {
  it("is at least 1 for a same-day listing", () => {
    expect(adifyDurationDays("2026-08-13T12:00:00", new Date(2026, 7, 13))).toBe(1);
  });
});

describe("formatAdifyDurationLabel", () => {
  it("uses Latvian singular after 21", () => {
    expect(formatAdifyDurationLabel(1)).toBe("1 diena");
    expect(formatAdifyDurationLabel(11)).toBe("11 dienas");
    expect(formatAdifyDurationLabel(21)).toBe("21 diena");
    expect(formatAdifyDurationLabel(85)).toBe("85 dienas");
  });
});

describe("adifyChronologicalPriceRows", () => {
  it("puts the first listing day first", () => {
    const snap = normalizeAdifyHistoryItems(
      [[{ price: 100, created: "2026-08-10" }, { price: 90, created: "2026-08-01" }]],
      new Date(2026, 7, 13),
    );
    const chrono = adifyChronologicalPriceRows(snap.rows);
    expect(chrono[0]?.price).toBe(90);
    expect(chrono[chrono.length - 1]?.price).toBe(100);
  });
});
