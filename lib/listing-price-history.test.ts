import { describe, expect, it } from "vitest";
import { pickListingPriceHistory, snapshotFromVendorHistoryHtml } from "@/lib/listing-price-history";
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

describe("snapshotFromVendorHistoryHtml", () => {
  const now = new Date(2026, 8, 29);

  it("reads Tirgus Dati history table HTML", () => {
    const html = `<table class="history">
      <tbody>
        <tr><td>08.09.2026 18:34</td><td>23 950 EUR</td></tr>
        <tr><td>16.07.2026 13:48</td><td>24 900 EUR</td></tr>
      </tbody>
    </table>`;
    const snap = snapshotFromVendorHistoryHtml(html, now);
    expect(snap.found).toBe(true);
    expect(snap.source).toBe("tirgusdati");
    expect(snap.rows).toHaveLength(2);
    expect(snap.priceChangeEur).toBe(-950);
    expect(snap.oldestDate).toBe("16.07.2026");
  });

  it("reads Adify __NEXT_DATA__ HTML", () => {
    const items = [
      { price: 23950, created: "2026-09-08T18:34:00" },
      { price: 24900, created: "2026-07-16T13:48:00" },
    ];
    const html = `<script id="__NEXT_DATA__">${JSON.stringify({
      props: { pageProps: { items } },
    })}</script>`;
    const snap = snapshotFromVendorHistoryHtml(html, now);
    expect(snap.found).toBe(true);
    expect(snap.source).toBe("adify");
    expect(snap.priceChangeEur).toBe(-950);
  });

  it("rejects a Cloudflare interstitial", () => {
    const snap = snapshotFromVendorHistoryHtml("Performing security verification");
    expect(snap.found).toBe(false);
    expect(snap.message).toMatch(/Cloudflare/i);
  });
});
