import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { listingExtrasI, listingFinalPrice, type ListingTaxKind } from "@/lib/iriss-listings-cost";
import {
  computeListingVatHealth,
  detectListingTax,
  EU_VAT,
  listingTaxLabel,
  listingTaxResolved,
  type ListingTaxInput,
} from "@/lib/iriss-listings-vat";
import type { IrissListingVehicle } from "@/lib/iriss-listings-types";

const I = listingExtrasI();
const FIX = path.join(process.cwd(), "lib/__fixtures__/iriss-vat");

type FixtureRow = {
  platform: "auto1" | "openline" | "autobid";
  title?: string;
  mapped: ListingTaxInput & { bid?: number | null };
  expected: { kind: ListingTaxKind; rate: number | null; finalPrice?: number; label?: string };
};

type FixtureFile = {
  listRecords: FixtureRow[];
  staleRecordSample?: { mapped: Omit<ListingTaxInput, "platform">; expected: { kind: ListingTaxKind; basis: string } };
  publicLabelCatalogue?: Array<{ taxInformation: string; expected: { kind: ListingTaxKind; rate: number | null; label: string } }>;
};

function loadFixture(name: string): FixtureFile {
  return JSON.parse(readFileSync(path.join(FIX, name), "utf8")) as FixtureFile;
}

function inputFromMapped(platform: FixtureRow["platform"], mapped: ListingTaxInput): ListingTaxInput {
  return {
    platform,
    vatNote: mapped.vatNote,
    salesVatType: mapped.salesVatType,
    taxDeduction: mapped.taxDeduction,
    isMargin: mapped.isMargin,
    countryCode: mapped.countryCode,
    sourceCountry: mapped.sourceCountry,
    owningCountry: mapped.owningCountry,
    vatRate: mapped.vatRate,
  };
}

describe("EU-27 VAT table", () => {
  it("covers all EU-27 with current rates", () => {
    expect(EU_VAT).toMatchObject({
      AT: 20,
      BE: 21,
      BG: 20,
      HR: 25,
      CY: 19,
      CZ: 21,
      DK: 25,
      EE: 24,
      FI: 25.5,
      FR: 20,
      DE: 19,
      GR: 24,
      HU: 27,
      IE: 23,
      IT: 22,
      LV: 21,
      LT: 21,
      LU: 17,
      MT: 18,
      NL: 21,
      PL: 23,
      PT: 23,
      RO: 21,
      SK: 23,
      SI: 22,
      ES: 21,
      SE: 25,
    });
    expect(Object.keys(EU_VAT)).toHaveLength(27);
  });
});

describe("fixture listRecords", () => {
  it.each(["auto1.json", "openlane.json", "autobid.json"])("%s kind, rate, flag and final price", (file) => {
    const data = loadFixture(file);
    expect(data.listRecords.length).toBeGreaterThan(0);
    for (const rec of data.listRecords) {
      const t = detectListingTax(inputFromMapped(rec.platform, rec.mapped));
      expect(t.kind, rec.title).toBe(rec.expected.kind);
      expect(t.rate, rec.title).toBe(rec.expected.rate);
      expect(t.flag, rec.title).toBeNull();
      expect(listingTaxLabel(t)).not.toBe("PVN ?");
      if (rec.mapped.bid != null && rec.expected.finalPrice != null) {
        expect(listingFinalPrice(t, rec.mapped.bid, I), rec.title).toBe(rec.expected.finalPrice);
      }
    }
  });
});

describe("Autobid publicLabelCatalogue", () => {
  const data = loadFixture("autobid.json");

  it("maps all 9 en/lv/de labels", () => {
    expect(data.publicLabelCatalogue).toHaveLength(9);
    for (const row of data.publicLabelCatalogue ?? []) {
      const t = detectListingTax({ platform: "autobid", vatNote: row.taxInformation });
      expect(t.kind, row.taxInformation).toBe(row.expected.kind);
      expect(t.rate, row.taxInformation).toBe(row.expected.rate);
      expect(listingTaxLabel(t), row.taxInformation).toBe(row.expected.label === "MARGIN" ? "Margin" : row.expected.label);
      expect(t.flag).toBeNull();
    }
  });

  it("empty taxInformation is silent margin; Exportfahrzeug is unrecognised margin", () => {
    const silent = detectListingTax({ platform: "autobid", vatNote: "" });
    expect(silent).toMatchObject({ kind: "margin", basis: "default_silent", flag: null });
    expect(listingTaxLabel(silent)).toBe("Margin");
    const unk = detectListingTax({ platform: "autobid", vatNote: "Exportfahrzeug" });
    expect(unk).toMatchObject({ kind: "margin", basis: "default_unrecognised", flag: "unrecognised_text" });
    expect(listingTaxLabel(unk)).toBe("Margin");
  });

  it("reads Latvian Iesk. 19% PVN and neto", () => {
    const gross = detectListingTax({ platform: "autobid", vatNote: "Iesk. 19% PVN" });
    expect(gross).toMatchObject({ kind: "gross", rate: 19, flag: null });
    expect(listingTaxLabel(gross)).toBe("AR PVN 19 %");
    const net = detectListingTax({ platform: "autobid", vatNote: "neto" });
    expect(net).toMatchObject({ kind: "net", flag: null });
    expect(listingTaxLabel(net)).toBe("NETO");
  });
});

describe("defaults and flags", () => {
  it("Auto1 staleRecordSample is Margin with missing_fields, never PVN ?", () => {
    const sample = loadFixture("auto1.json").staleRecordSample!;
    const t = detectListingTax({ platform: "auto1", ...sample.mapped });
    expect(t.kind).toBe("margin");
    expect(t.flag).toBe("missing_fields");
    expect(t.basis).toBe("default_missing_fields");
    expect(listingTaxLabel(t)).toBe("Margin");
    const stale = detectListingTax({ platform: "auto1", ...sample.mapped, lastSeenAt: "2026-10-01T12:00:00.000Z" });
    expect(stale.flag).toBe("stale");
    expect(listingTaxLabel(stale)).toBe("Margin");
  });

  it("Auto1 conflict 1054 + taxDeduction false uses taxDeduction", () => {
    const t = detectListingTax({ platform: "auto1", salesVatType: 1054, taxDeduction: false, countryCode: "DE" });
    expect(t).toMatchObject({ kind: "margin", flag: "conflict" });
  });

  it("Auto1 1054 + country XX is gross with rate_missing", () => {
    const t = detectListingTax({ platform: "auto1", salesVatType: 1054, taxDeduction: true, countryCode: "XX" });
    expect(t).toMatchObject({ kind: "gross", rate: null, flag: "rate_missing" });
    expect(listingTaxLabel(t)).toBe("AR PVN ? %");
    expect(listingFinalPrice(t, 10_000, I)).toBe(listingFinalPrice({ kind: "net", rate: null }, 10_000, I));
  });

  it("Openlane IsMargin null is margin with missing_fields", () => {
    const t = detectListingTax({ platform: "openline", isMargin: null, vatNote: "VAT excluded" });
    expect(t).toMatchObject({ kind: "margin", flag: "missing_fields", basis: "default_missing_fields" });
    expect(listingTaxLabel(t)).toBe("Margin");
  });

  it("Openlane ignores vatNote when IsMargin is present", () => {
    expect(detectListingTax({ platform: "openline", isMargin: true, vatNote: "С НДС" }).kind).toBe("margin");
    expect(detectListingTax({ platform: "openline", isMargin: false, vatNote: "Margin" }).kind).toBe("net");
  });

  it("manual override is marked and does not hide later detection in tooltip raw", () => {
    const v = { platform: "autobid" as const, vatNote: "Exportfahrzeug", countryCode: "DE", lastSeenAt: "" };
    const t = listingTaxResolved(v, { kind: "gross", rate: 19 });
    expect(t.kind).toBe("gross");
    expect(t.rate).toBe(19);
    expect(t.manual).toBe(true);
    expect(t.raw).toMatch(/Exportfahrzeug/);
  });
});

describe("vat health", () => {
  it("red-flags stale and unrecognised; amber when one regime dominates", () => {
    const base = {
      id: "x",
      platform: "auto1" as const,
      externalId: "1",
      detailUrl: "",
      orderIds: ["o"],
      orderBrandModels: ["x"],
      title: "x",
      manufacturer: "",
      year: "",
      firstRegistration: "",
      mileageKm: null,
      fuel: "",
      transmission: "",
      powerKw: "",
      location: "",
      countryCode: "DE",
      imageUrl: "",
      currency: "EUR",
      priceStart: 1000,
      priceMinimal: 1000,
      priceCurrent: null,
      priceBuyNow: null,
      vatNote: "",
      auctionId: "",
      auctionStartAt: "",
      auctionEndAt: "",
      auctionStage: "",
      firstSeenAt: "2026-10-01T00:00:00.000Z",
      lastSeenAt: "2026-10-01T00:00:00.000Z",
      missingRuns: 0,
      change: "unchanged" as const,
      priceHistory: [],
      salesVatType: null,
      taxDeduction: null,
    } satisfies Partial<IrissListingVehicle> as IrissListingVehicle;
    const health = computeListingVatHealth([base]);
    expect(health.auto1.stale).toBe(1);
    expect(health.auto1.level).toBe("red");
  });
});
