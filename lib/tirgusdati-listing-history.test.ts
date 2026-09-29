import { describe, expect, it } from "vitest";
import {
  extractTirgusDatiHistoryFromHtml,
  looksLikeTirgusDatiCloudflareChallenge,
  tirgusDatiHistoryPageLookupUrl,
  tirgusDatiSupportsListingUrl,
} from "@/lib/tirgusdati-listing-history";

const Q7_URL = "https://www.ss.lv/msg/lv/transport/cars/audi/q7/bcdpnx.html";

// Saīsināts, bet strukturāli identisks reālam tirgusdati.lv/vesture HTML
// fragmentam (audi q7 sludinājums, 5 fiksēti cenu ieraksti).
const FOUND_HTML = `<html><body>
<div class="kpi-value">23 950 EUR</div>
<div class="kpi-value kpi-value--soft">24 900 EUR</div>
<div class="kpi-value down">−950 EUR</div>
<dl class="specs">
  <div><dt>Gads</dt><dd>2015</dd></div>
  <div><dt>Nobraukums</dt><dd class="has-cv">233 000 km<a class="cv-km" href="https://example.com">check</a></dd></div>
  <div><dt>Degviela</dt><dd>diesel</dd></div>
</dl>
<a class="btn" href="https://www.ss.com/msg/lv/transport/cars/audi/q7/bcdpnx.html" target="_blank" rel="nofollow noopener">Atvērt sludinājumu</a>
<table class="history">
  <thead><tr><th>Datums</th><th>Cena</th><th>Izmaiņa</th><th>Piezīme</th></tr></thead>
  <tbody>
    <tr><td>08.09.2026 18:34</td><td>23 950 EUR</td><td class="delta-flat">—</td><td class="muted">bez izmaiņām</td></tr>
    <tr><td>28.08.2026 05:39</td><td>23 950 EUR</td><td class="delta-flat">—</td><td class="muted">bez izmaiņām</td></tr>
    <tr><td>13.08.2026 15:33</td><td>23 950 EUR</td><td class="delta-down">−550 EUR</td><td class="muted">cena pazemināta</td></tr>
    <tr><td>30.07.2026 14:57</td><td>24 500 EUR</td><td class="delta-down">−400 EUR</td><td class="muted">cena pazemināta</td></tr>
    <tr><td>16.07.2026 13:48</td><td>24 900 EUR</td><td class="delta-flat">—</td><td class="muted">Sludinājums pievienots</td></tr>
  </tbody>
</table>
</body></html>`;

// Nezināma / nekad neapmeklēta sludinājuma saite: lapa atgriežas ar HTTP 200,
// bet parāda tikai homepage-veida satura bloku, nekādas <table class="history">.
const NOT_FOUND_HTML = `<html><body>
<section class="block"><h2>Kāpēc skatīties sludinājuma vēsturi</h2></section>
<section class="block"><h2>Nesen meklētie</h2><div class="recent"></div></section>
</body></html>`;

describe("tirgusDatiSupportsListingUrl", () => {
  it("accepts ss.lv and ss.com", () => {
    expect(tirgusDatiSupportsListingUrl(Q7_URL)).toBe(true);
    expect(tirgusDatiSupportsListingUrl("https://www.ss.com/msg/lv/x.html")).toBe(true);
  });

  it("accepts city24.lv", () => {
    expect(tirgusDatiSupportsListingUrl("https://www.city24.lv/real-estate-item/123")).toBe(true);
  });

  it("rejects unsupported hosts", () => {
    expect(tirgusDatiSupportsListingUrl("https://www.cv.lv/msg/lv/x.html")).toBe(false);
    expect(tirgusDatiSupportsListingUrl("not a url")).toBe(false);
  });
});

describe("tirgusDatiHistoryPageLookupUrl", () => {
  it("encodes the listing URL as the vesture page query", () => {
    expect(tirgusDatiHistoryPageLookupUrl(Q7_URL)).toBe(
      "https://tirgusdati.lv/vesture?q=https%3A%2F%2Fwww.ss.lv%2Fmsg%2Flv%2Ftransport%2Fcars%2Faudi%2Fq7%2Fbcdpnx.html",
    );
  });
});

describe("looksLikeTirgusDatiCloudflareChallenge", () => {
  it("detects the Cloudflare interstitial", () => {
    expect(looksLikeTirgusDatiCloudflareChallenge("Performing security verification")).toBe(true);
    expect(looksLikeTirgusDatiCloudflareChallenge("<table class='history'></table>")).toBe(false);
  });
});

describe("extractTirgusDatiHistoryFromHtml", () => {
  it("reads all 5 history rows, mileage/year and the canonical listing URL", () => {
    const { items, listingUrl } = extractTirgusDatiHistoryFromHtml(FOUND_HTML);
    expect(items).toHaveLength(5);
    expect(items[0]).toEqual({ price: 23950, created: "08.09.2026", mileage: 233000, year: 2015 });
    expect(items[4]).toEqual({ price: 24900, created: "16.07.2026", mileage: null, year: 2015 });
    expect(listingUrl).toBe("https://www.ss.com/msg/lv/transport/cars/audi/q7/bcdpnx.html");
  });

  it("parses the live multiline table from tirgusdati.lv/vesture", () => {
    const live = `<table class="history">
            <thead>
              <tr><th>Datums</th><th>Cena</th><th>Izmaiņa</th><th>Piezīme</th></tr>
            </thead>
            <tbody>
                <tr>
                  <td>08.09.2026 18:34</td>
                  <td>23 950 EUR</td>
                  <td class="delta-flat">—</td>
                  <td class="muted">bez izmaiņām</td>
                </tr>
                <tr>
                  <td>16.07.2026 13:48</td>
                  <td>24 900 EUR</td>
                  <td class="delta-flat">—</td>
                  <td class="muted">Sludinājums pievienots</td>
                </tr>
                          </tbody>
          </table>
<dl class="specs">
  <div><dt>Gads</dt><dd>2015</dd></div>
  <div><dt>Nobraukums</dt><dd class="has-cv">233 000 km</dd></div>
</dl>
<a class="btn" href="https://www.ss.lv/msg/lv/transport/cars/audi/q7/bcdpnx.html" target="_blank">Atvērt</a>`;
    const { items, listingUrl } = extractTirgusDatiHistoryFromHtml(live);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ price: 23950, created: "08.09.2026", mileage: 233000, year: 2015 });
    expect(items[1]).toMatchObject({ price: 24900, created: "16.07.2026", year: 2015 });
    expect(listingUrl).toBe("https://www.ss.lv/msg/lv/transport/cars/audi/q7/bcdpnx.html");
  });

  it("returns an empty item list when there is no history table", () => {
    expect(extractTirgusDatiHistoryFromHtml(NOT_FOUND_HTML)).toEqual({ items: [], listingUrl: null });
  });
});
