import { describe, expect, it } from "vitest";
import { pickListingPriceHistory } from "@/lib/listing-price-history";
import type { AdifyListingHistorySnapshot } from "@/lib/adify-listing-history";

function snap(partial: Partial<AdifyListingHistorySnapshot>): AdifyListingHistorySnapshot {
  return {
    found: false,
    message: "",
    rows: [],
    durationDays: 0,
    oldestDate: "",
    newestDate: "",
    priceChangeEur: 0,
    listingUrl: null,
    ...partial,
  };
}

describe("pickListingPriceHistory", () => {
  it("keeps Adify when it found history", () => {
    const adify = snap({ found: true, message: "Adify", source: "adify", durationDays: 10 });
    const td = snap({ found: true, message: "TD", source: "tirgusdati", durationDays: 12 });
    expect(pickListingPriceHistory(adify, td).source).toBe("adify");
  });

  it("falls back to Tirgus Dati when Adify missed", () => {
    const adify = snap({ found: false, message: "Adify neatbildēja (HTTP 403)" });
    const td = snap({ found: true, message: "TD", source: "tirgusdati", durationDays: 12 });
    const picked = pickListingPriceHistory(adify, td);
    expect(picked.found).toBe(true);
    expect(picked.source).toBe("tirgusdati");
  });

  it("joins both error messages when neither found data", () => {
    const adify = snap({ found: false, message: "Adify neatbildēja (HTTP 403)" });
    const td = snap({ found: false, message: "Tirgus Dati neatbildēja (HTTP 403)" });
    expect(pickListingPriceHistory(adify, td).message).toBe(
      "Adify neatbildēja (HTTP 403) · Tirgus Dati: Tirgus Dati neatbildēja (HTTP 403)",
    );
  });

  it("returns Adify unchanged when Tirgus Dati is not applicable", () => {
    const adify = snap({ found: false, message: "Neatpazīta sludinājuma saite (ss.lv / ss.com)" });
    expect(pickListingPriceHistory(adify, null).message).toBe(
      "Neatpazīta sludinājuma saite (ss.lv / ss.com)",
    );
  });
});
