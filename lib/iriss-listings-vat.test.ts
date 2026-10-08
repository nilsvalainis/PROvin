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

  it("Openlane IsMargin true / false", () => {
    expect(detectListingTax({ platform: "openline", isMargin: true }).kind).toBe("margin");
    expect(detectListingTax({ platform: "openline", isMargin: false }).kind).toBe("net");
    expect(detectListingTax({ platform: "openline", vatNote: "Margin" }).kind).toBe("margin");
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
