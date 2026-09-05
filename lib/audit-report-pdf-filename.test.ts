import { describe, expect, it } from "vitest";
import {
  buildProvinAuditPdfFilename,
  buildProvinDilerisPdfFilename,
  resolveProvinAuditPdfProductBrand,
} from "@/lib/audit-report-pdf-filename";

describe("resolveProvinAuditPdfProductBrand", () => {
  it("maps mini checkout lines to PROVIN_MINI", () => {
    expect(resolveProvinAuditPdfProductBrand({ checkoutLine: "mini" })).toBe("PROVIN_MINI");
    expect(resolveProvinAuditPdfProductBrand({ checkoutLine: "plus" })).toBe("PROVIN_MINI");
  });

  it("maps audit/premium to PROVIN_AUDITS", () => {
    expect(resolveProvinAuditPdfProductBrand({ checkoutLine: "audit" })).toBe("PROVIN_AUDITS");
    expect(resolveProvinAuditPdfProductBrand({ checkoutLine: "premium" })).toBe("PROVIN_AUDITS");
  });

  it("falls back to amount when line unknown", () => {
    expect(resolveProvinAuditPdfProductBrand({ amountTotalCents: 3999 })).toBe("PROVIN_MINI");
    expect(resolveProvinAuditPdfProductBrand({ amountTotalCents: 9999 })).toBe("PROVIN_AUDITS");
    expect(resolveProvinAuditPdfProductBrand({})).toBe("PROVIN_AUDITS");
  });
});

describe("buildProvinAuditPdfFilename", () => {
  it("builds PROVIN_AUDITS_<VIN>.pdf by default", () => {
    expect(buildProvinAuditPdfFilename("WVWZZZ1JZXW000001")).toBe("PROVIN_AUDITS_WVWZZZ1JZXW000001.pdf");
  });

  it("builds PROVIN_MINI_<VIN>.pdf for mini orders", () => {
    expect(
      buildProvinAuditPdfFilename("WVWZZZ1JZXW000001", { checkoutLine: "mini" }),
    ).toBe("PROVIN_MINI_WVWZZZ1JZXW000001.pdf");
  });

  it("builds OFICIALA_DILERA_DATI_<VIN>.pdf for dealer-only reports", () => {
    expect(buildProvinDilerisPdfFilename("WVWZZZ1JZXW000001")).toBe(
      "OFICIALA_DILERA_DATI_WVWZZZ1JZXW000001.pdf",
    );
  });

  it("sanitizes VIN and uses NAV_VIN when empty", () => {
    expect(buildProvinAuditPdfFilename("  ab-12  ", { brand: "PROVIN_AUDITS" })).toBe(
      "PROVIN_AUDITS_AB12.pdf",
    );
    expect(buildProvinAuditPdfFilename(null, { checkoutLine: "mini" })).toBe("PROVIN_MINI_NAV_VIN.pdf");
  });
});
