import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseLogisticsListingHtml } from "@/lib/iriss-logistics-listing-parse";

const client = readFileSync("lib/iriss-logistics-listing-parse-server.ts", "utf8");

describe("free listing parse (no Apify)", () => {
  it("does not import paid scrapers", () => {
    expect(client).not.toMatch(/from ["']@\/lib\/marketplace/);
    expect(client).not.toMatch(/APIFY_/);
    expect(client).toMatch(/fetchListingHtmlViaJina/);
  });

  it("reads JSON-LD Vehicle + VIN + km", () => {
    const html = `<html><head>
      <script type="application/ld+json">${JSON.stringify({
        "@type": "Car",
        name: "VW Golf Variant 1.5 TSI",
        brand: { name: "Volkswagen" },
        model: "Golf Variant 1.5 TSI",
        vehicleIdentificationNumber: "WVWZZZCD2MW000000",
        mileageFromOdometer: { value: 86400 },
        offers: { price: 14900, priceCurrency: "EUR" },
        address: { streetAddress: "Musterweg 7", postalCode: "21000", addressLocality: "Lüneburg", addressCountry: "DE" },
      })}</script>
      </head><body></body></html>`;
    const parsed = parseLogisticsListingHtml(html, "https://suchen.mobile.de/fahrzeuge/details.html?id=1");
    expect(parsed.ok).toBe(true);
    expect(parsed.source).toBe("mobile.de");
    expect(parsed.make).toMatch(/Volkswagen|VW/i);
    expect(parsed.model).toMatch(/Golf/i);
    expect(parsed.vin).toBe("WVWZZZCD2MW000000");
    expect(parsed.priceEur).toBe(14900);
    expect(parsed.mileageKm).toBe(86400);
    expect(parsed.address).toMatch(/Lüneburg/);
  });

  it("falls back to og:title and km in text", () => {
    const html = `<html><head><meta property="og:title" content="Audi A6 Avant 3.0 TDI" /></head>
      <body><p>Preis 21.900 €</p><p>Kilometerstand 128000 km</p></body></html>`;
    const parsed = parseLogisticsListingHtml(html, "https://www.autoscout24.de/angebote/x");
    expect(parsed.ok).toBe(true);
    expect(parsed.make).toMatch(/Audi/i);
    expect(parsed.mileageKm).toBe(128000);
    expect(parsed.priceEur).toBe(21900);
  });
});
