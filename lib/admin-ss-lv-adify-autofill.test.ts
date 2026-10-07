import { describe, expect, it } from "vitest";
import { normalizeAdifyHistoryItems } from "@/lib/adify-listing-history";
import { applySsLvAdifyAutofill, shouldAutofillListing } from "@/lib/admin-ss-lv-adify-autofill";
import { emptyTirgusFields } from "@/lib/admin-source-blocks";

const SSLV = "https://www.ss.lv/msg/lv/transport/cars/audi/q7/bcdpnx.html";
const MOBILE = "https://m.ss.lv/msg/lv/transport/cars/audi/q7/bcdpnx.html";

describe("shouldAutofillListing", () => {
  it("accepts ss.lv, m.ss.lv and other listing paths when tirgus is empty", () => {
    expect(shouldAutofillListing(SSLV, emptyTirgusFields())).toBe(true);
    expect(shouldAutofillListing(MOBILE, emptyTirgusFields())).toBe(true);
    expect(shouldAutofillListing("https://autoplius.lt/skelbimai/audi-q7-123", emptyTirgusFields())).toBe(true);
    expect(shouldAutofillListing("https://autoplius.lt", emptyTirgusFields())).toBe(false);
  });

  it("does not overwrite an already filled listing", () => {
    const filled = { ...emptyTirgusFields(), listingCreated: "16.07.2026" };
    expect(shouldAutofillListing(SSLV, filled)).toBe(false);
  });
});

describe("applySsLvAdifyAutofill", () => {
  it("writes Adify history and scrape odometer into tirgus", () => {
    const snap = normalizeAdifyHistoryItems(
      [
        [
          { price: 23950, mileage: 233000, year: 2015, created: "2026-08-13T15:33:01" },
          { price: 24500, mileage: 233000, year: 2015, created: "2026-07-16T13:48:01" },
        ],
      ],
      new Date(2026, 7, 13),
    );
    const next = applySsLvAdifyAutofill(emptyTirgusFields(), SSLV, snap, {
      ok: true,
      currentKm: "233000",
      postedDateRaw: "16.07.2026",
    });
    expect(next?.listingCreated).toBe("16.07.2026");
    expect(next?.listingMileageOdometer).toMatch(/233/);
    expect(next?.listingMileageCountry).toBe("Latvija");
    expect(next?.priceHistory.length).toBeGreaterThan(0);
  });

  it("returns null when nothing changed", () => {
    expect(applySsLvAdifyAutofill(emptyTirgusFields(), SSLV, null, null)).toBeNull();
  });
});
