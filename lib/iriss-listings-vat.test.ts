import { describe, expect, it } from "vitest";
import { detectListingTax, listingTaxLabel, listingTaxResolved } from "@/lib/iriss-listings-vat";

describe("detectListingTax", () => {
  it("Auto1 1054 + DE -> AR PVN 19 %", () => {
    const t = detectListingTax({ platform: "auto1", salesVatType: 1054, taxDeduction: true, countryCode: "DE" });
    expect(t.kind).toBe("gross");
    expect(t.rate).toBe(19);
    expect(listingTaxLabel(t)).toBe("AR PVN 19 %");
  });

  it("Auto1 1053 -> MARŽA", () => {
    const t = detectListingTax({ platform: "auto1", salesVatType: 1053, taxDeduction: false, countryCode: "DE" });
    expect(t.kind).toBe("margin");
  });

  it("Auto1 1054 + BE without vatRate -> AR PVN 21 %", () => {
    const t = detectListingTax({ platform: "auto1", salesVatType: 1054, taxDeduction: true, vatRate: null, countryCode: "BE" });
    expect(t.kind).toBe("gross");
    expect(t.rate).toBe(21);
    expect(listingTaxLabel(t)).toBe("AR PVN 21 %");
  });

  it("Openlane IsMargin true / false", () => {
    expect(detectListingTax({ platform: "openline", isMargin: true }).kind).toBe("margin");
    expect(detectListingTax({ platform: "openline", isMargin: false }).kind).toBe("net");
    expect(detectListingTax({ platform: "openline", vatNote: "Margin" }).kind).toBe("margin");
    expect(listingTaxLabel(detectListingTax({ platform: "openline", isMargin: true, vatNote: "С НДС" }))).toBe("MARŽA");
    expect(listingTaxLabel(detectListingTax({ platform: "openline", isMargin: false }))).toBe("NETO");
  });

  it("Openlane RU and EN card labels", () => {
    expect(detectListingTax({ platform: "openline", vatNote: "Маржа" }).kind).toBe("margin");
    expect(detectListingTax({ platform: "openline", vatNote: "Без НДС" }).kind).toBe("net");
    expect(listingTaxLabel(detectListingTax({ platform: "openline", vatNote: "Без НДС" }))).toBe("NETO");
    const ruGross = detectListingTax({ platform: "openline", vatNote: "С НДС", countryCode: "DE" });
    expect(ruGross.kind).toBe("gross");
    expect(ruGross.rate).toBe(19);
    expect(listingTaxLabel(ruGross)).toBe("AR PVN 19 %");

    expect(detectListingTax({ platform: "openline", vatNote: "margin" }).kind).toBe("margin");
    expect(detectListingTax({ platform: "openline", vatNote: "VAT excluded" }).kind).toBe("net");
    const enGross = detectListingTax({ platform: "openline", vatNote: "VAT included", countryCode: "BE" });
    expect(enGross.kind).toBe("gross");
    expect(enGross.rate).toBe(21);
    expect(listingTaxLabel(enGross)).toBe("AR PVN 21 %");
    const enPct = detectListingTax({ platform: "openline", vatNote: "VAT included 19%" });
    expect(enPct.kind).toBe("gross");
    expect(enPct.rate).toBe(19);
  });

  it("Openlane DE labels and IsMargin known never stays unknown", () => {
    expect(detectListingTax({ platform: "openline", vatNote: "Differenzbesteuert" }).kind).toBe("margin");
    expect(detectListingTax({ platform: "openline", vatNote: "zzgl. MwSt" }).kind).toBe("net");
    const deInkl = detectListingTax({ platform: "openline", vatNote: "inkl. MwSt", countryCode: "DE" });
    expect(deInkl.kind).toBe("gross");
    expect(deInkl.rate).toBe(19);
    expect(detectListingTax({ platform: "openline", isMargin: true, vatNote: "" }).kind).not.toBe("unknown");
    expect(detectListingTax({ platform: "openline", isMargin: false, vatNote: "" }).kind).not.toBe("unknown");
  });

  it("Autobid Including 19% VAT reads the rate from text", () => {
    const t = detectListingTax({ platform: "autobid", vatNote: "Including 19% VAT" });
    expect(t.kind).toBe("gross");
    expect(t.rate).toBe(19);
  });

  it("Autobid Tax on difference is margin; unknown stays yellow", () => {
    expect(detectListingTax({ platform: "autobid", vatNote: "Tax on difference" }).kind).toBe("margin");
    const u = detectListingTax({ platform: "autobid", vatNote: "Exportfahrzeug" });
    expect(u.kind).toBe("unknown");
    expect(listingTaxLabel(u)).toBe("PVN ?");
  });

  it("manual override keeps the source field in tooltip raw", () => {
    const v = { platform: "autobid" as const, vatNote: "Exportfahrzeug", countryCode: "DE" };
    const t = listingTaxResolved(v, { kind: "gross", rate: 19 });
    expect(t.kind).toBe("gross");
    expect(t.rate).toBe(19);
    expect(t.raw).toMatch(/Exportfahrzeug/);
  });
});
