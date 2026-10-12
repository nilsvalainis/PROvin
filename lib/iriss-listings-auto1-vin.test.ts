import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { applyAuto1VinHints, auto1HitsFromRawPages, auto1VinHintsFromRaw } from "@/lib/iriss-listings-auto1-vin";
import type { IrissFetchedVehicle } from "@/lib/iriss-listings-reconcile";

const VIN = "WBAZZZ8V0K1237731";

function vehicle(over: Partial<IrissFetchedVehicle> = {}): IrissFetchedVehicle {
  return {
    id: "auto1|987654",
    platform: "auto1",
    externalId: "987654",
    detailUrl: "https://www.auto1.com/en/app/merchant/car/BW03512",
    orderId: "o1",
    orderBrandModel: "BMW 320d",
    title: "BMW 320d",
    manufacturer: "BMW",
    year: "2010",
    firstRegistration: "2010-01-01",
    mileageKm: 84500,
    fuel: "Diesel",
    transmission: "Automatic",
    powerKw: "140",
    location: "Berlin, DE",
    countryCode: "DE",
    imageUrl: "https://img-pa.auto1.com/img/hero.jpg",
    imageUrls: ["https://img-pa.auto1.com/img/hero.jpg"],
    currency: "EUR",
    priceStart: 4000,
    priceMinimal: 4500,
    priceCurrent: null,
    priceBuyNow: 8900,
    vatNote: "",
    auctionId: "auc-1",
    auctionStartAt: "2026-10-08T08:00:00.000Z",
    auctionEndAt: "2026-10-08T16:00:00.000Z",
    auctionStage: "IN_AUCTION",
    stockNumber: "BW03512",
    ...over,
  };
}

describe("Auto1 raw VIN hints", () => {
  it("finds nested hits in the stored auto1-xhr blob", () => {
    const raw = {
      kind: "auto1-xhr",
      pages: [
        {
          url: "https://www.auto1.com/v1/car-search/cars/search/abc",
          json: {
            totalHits: 1,
            hits: [
              {
                id: 987654,
                stockNumber: "BW03512",
                vin: VIN,
                images: [
                  { fullUrl: "https://img-pa.auto1.com/img/hero.jpg", type: "EXTERIOR" },
                  { fullUrl: "https://img-pa.auto1.com/img/schein.jpg", type: "DOCUMENT" },
                ],
              },
            ],
          },
        },
      ],
    };
    expect(auto1HitsFromRawPages(raw)).toHaveLength(1);
    const hints = auto1VinHintsFromRaw(raw);
    expect(hints.get("987654")?.vin).toBe(VIN);
    expect(hints.get("BW03512")?.documentImageUrls).toEqual(["https://img-pa.auto1.com/img/schein.jpg"]);
  });

  it("fills a mapped item that omitted vin from the raw hit", () => {
    const raw = JSON.stringify({
      kind: "auto1-xhr",
      pages: [{ json: { hits: [{ id: 987654, stockNumber: "BW03512", vehicleIdentificationNumber: VIN }] } }],
    });
    const out = applyAuto1VinHints([vehicle()], raw);
    expect(out[0]?.vin).toBe(VIN);
    expect(out[0]?.vinSource).toBe("source");
  });

  it("leaves VIN empty when the captured hit has none", () => {
    const raw = { kind: "auto1-xhr", pages: [{ json: { hits: [{ id: 987654, stockNumber: "BW03512", km: 1 }] } }] };
    expect(applyAuto1VinHints([vehicle()], raw)[0]?.vin).toBeUndefined();
  });

  it("2026-10-09 Auto1 VAT fixture raw hits have no VIN fields", () => {
    const fixture = JSON.parse(readFileSync("lib/__fixtures__/iriss-vat/auto1.json", "utf8")) as {
      listRecords: Array<{ raw: Record<string, unknown> }>;
    };
    const keys = new Set<string>();
    for (const rec of fixture.listRecords) {
      for (const k of Object.keys(rec.raw ?? {})) keys.add(k);
      expect(rec.raw.vin ?? rec.raw.vinNumber ?? rec.raw.vehicleIdentificationNumber).toBeUndefined();
    }
    expect(keys.has("vin")).toBe(false);
    expect(keys.has("salesVatType")).toBe(true);
  });
});
