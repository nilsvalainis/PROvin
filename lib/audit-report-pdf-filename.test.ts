import { describe, expect, it } from "vitest";
import {
  buildAuctionArchivePdfFilename,
  buildReportPdfFilename,
  isProvinReportPdfFilename,
  buildOemDealerPdfFilename,
  buildProvinAsvPdfFilename,
  buildProvinAuditPdfFilename,
  buildProvinBusinessPdfFilename,
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
    expect(resolveProvinAuditPdfProductBrand({ checkoutLine: "audits" })).toBe("PROVIN_AUDITS");
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

  it("builds OEM_DILERA_DATI_<VIN>.pdf for factory-style dealer dumps", () => {
    expect(buildOemDealerPdfFilename("WVWZZZ1JZXW000001")).toBe("OEM_DILERA_DATI_WVWZZZ1JZXW000001.pdf");
    expect(buildOemDealerPdfFilename(null)).toBe("OEM_DILERA_DATI_NAV_VIN.pdf");
  });

  it("builds PROVIN_BUSINESS_<VIN>.pdf for the B2B report", () => {
    expect(buildProvinBusinessPdfFilename("WVWZZZ1JZXW000001")).toBe(
      "PROVIN_BUSINESS_WVWZZZ1JZXW000001.pdf",
    );
    expect(buildProvinBusinessPdfFilename(null)).toBe("PROVIN_BUSINESS_NAV_VIN.pdf");
  });

  it("builds PROVIN_ASV_<VIN>.pdf for US-only reports", () => {
    expect(buildProvinAsvPdfFilename("1HGCM82633A004352")).toBe("PROVIN_ASV_1HGCM82633A004352.pdf");
    expect(buildProvinAsvPdfFilename(null)).toBe("PROVIN_ASV_NAV_VIN.pdf");
  });

  it("sanitizes VIN and uses NAV_VIN when empty", () => {
    expect(buildProvinAuditPdfFilename("  ab-12  ", { brand: "PROVIN_AUDITS" })).toBe(
      "PROVIN_AUDITS_AB12.pdf",
    );
    expect(buildProvinAuditPdfFilename(null, { checkoutLine: "mini" })).toBe("PROVIN_MINI_NAV_VIN.pdf");
  });
});

describe("produkts un valoda serverī (audits 20.11)", () => {
  it("Business un Dīlera dati pēc līnijas", () => {
    expect(resolveProvinAuditPdfProductBrand({ checkoutLine: "business" })).toBe("PROVIN_BUSINESS");
    expect(resolveProvinAuditPdfProductBrand({ checkoutLine: "dealer" })).toBe("PROVIN_DILERIS");
    expect(buildProvinAuditPdfFilename("WVWZZZ1JZXW000001", { checkoutLine: "business" })).toBe("PROVIN_BUSINESS_WVWZZZ1JZXW000001.pdf");
    expect(buildProvinAuditPdfFilename("WVWZZZ1JZXW000001", { checkoutLine: "dealer" })).toBe("OFICIALA_DILERA_DATI_WVWZZZ1JZXW000001.pdf");
  });

  it("valodas galotne kā UI", () => {
    expect(buildProvinAuditPdfFilename("WVWZZZ1JZXW000001", { checkoutLine: "business", lang: "en" })).toBe("PROVIN_BUSINESS_WVWZZZ1JZXW000001_EN.pdf");
    expect(buildProvinAuditPdfFilename("WVWZZZ1JZXW000001", { checkoutLine: "dealer", lang: "ru" })).toBe("OFITSIALNYE_DANNYE_DILERA_WVWZZZ1JZXW000001_RU.pdf");
    expect(buildProvinAuditPdfFilename("WVWZZZ1JZXW000001", { checkoutLine: "audit", lang: "de" })).toBe("PROVIN_AUDIT_WVWZZZ1JZXW000001_DE.pdf");
    expect(buildProvinAuditPdfFilename("WVWZZZ1JZXW000001", { checkoutLine: "mini", lang: "lv" })).toBe("PROVIN_MINI_WVWZZZ1JZXW000001.pdf");
  });
});

describe("viena funkcija PDF nosaukumam visās valodās (Nils 25.11)", () => {
  const V = "WAUZZZ4M4MD007799";
  it("produkta vārds klienta valodā, RU latīņu burtiem", () => {
    expect(buildReportPdfFilename({ kind: "dealer", vin: V, lang: "lv" })).toBe(`OFICIALA_DILERA_DATI_${V}.pdf`);
    expect(buildReportPdfFilename({ kind: "dealer", vin: V, lang: "en" })).toBe(`OFFICIAL_DEALER_DATA_${V}_EN.pdf`);
    expect(buildReportPdfFilename({ kind: "dealer", vin: V, lang: "de" })).toBe(`OFFIZIELLE_HAENDLERDATEN_${V}_DE.pdf`);
    expect(buildReportPdfFilename({ kind: "dealer", vin: V, lang: "ru" })).toBe(`OFITSIALNYE_DANNYE_DILERA_${V}_RU.pdf`);
    expect(buildReportPdfFilename({ kind: "audits", vin: V, lang: "lv" })).toBe(`PROVIN_AUDITS_${V}.pdf`);
    expect(buildReportPdfFilename({ kind: "audits", vin: V, lang: "en" })).toBe(`PROVIN_AUDIT_${V}_EN.pdf`);
    expect(buildReportPdfFilename({ kind: "asv", vin: V, lang: "ru" })).toBe(`PROVIN_SSHA_${V}_RU.pdf`);
    expect(buildReportPdfFilename({ kind: "oem_dealer", vin: V, lang: "de" })).toBe(`OEM_HAENDLERDATEN_${V}_DE.pdf`);
    expect(buildAuctionArchivePdfFilename(V)).toBe(`IZSOLU_ARHIVS_${V}.pdf`);
    expect(buildAuctionArchivePdfFilename(V, "de")).toBe(`AUKTIONSARCHIV_${V}_DE.pdf`);
  });

  it("«Izvilkums» un druka tulkoti", () => {
    expect(buildReportPdfFilename({ kind: "audits", vin: V, extract: true })).toBe(`PROVIN_AUDITS_IZVILKUMS_${V}.pdf`);
    expect(buildReportPdfFilename({ kind: "audits", vin: V, lang: "en", extract: true })).toBe(`PROVIN_AUDIT_EXTRACT_${V}_EN.pdf`);
    expect(buildReportPdfFilename({ kind: "business", vin: V, lang: "de", extract: true })).toBe(`PROVIN_BUSINESS_AUSZUG_${V}_DE.pdf`);
    expect(buildReportPdfFilename({ kind: "audits", vin: V, lang: "ru", extract: true, print: true })).toBe(`PROVIN_AUDIT_VYPISKA_${V}_RU_PECHAT.pdf`);
    expect(buildReportPdfFilename({ kind: "audits", vin: V, print: true })).toBe(`PROVIN_AUDITS_${V}_DRUKAI.pdf`);
  });

  it("tikai droši simboli (bez diakritikas un kirilicas) visām kombinācijām", () => {
    const kinds = ["audits", "mini", "business", "dealer", "oem_dealer", "asv", "auction_archive"] as const;
    for (const kind of kinds) {
      for (const lang of ["lv", "en", "ru", "de"] as const) {
        for (const extract of [false, true]) {
          const name = buildReportPdfFilename({ kind, vin: V, lang, extract, print: extract });
          expect(name).toMatch(/^[A-Z0-9_]+\.pdf$/);
          expect(name).toContain(V);
          expect(isProvinReportPdfFilename(name)).toBe(true);
          expect(isProvinReportPdfFilename(`v2-${name}`)).toBe(true);
        }
      }
    }
    expect(isProvinReportPdfFilename("rekins.pdf")).toBe(false);
  });

  it("vecās funkcijas lieto to pašu shēmu", () => {
    expect(buildProvinDilerisPdfFilename(V, "de")).toBe(`OFFIZIELLE_HAENDLERDATEN_${V}_DE.pdf`);
    expect(buildProvinDilerisPdfFilename(V, "lv", { variant: "DZA" })).toBe(`OFICIALA_DILERA_DATI_${V}_DZA.pdf`);
    expect(buildProvinAuditPdfFilename(V, { checkoutLine: "audit", lang: "en", extract: true })).toBe(`PROVIN_AUDIT_EXTRACT_${V}_EN.pdf`);
    expect(buildProvinBusinessPdfFilename(V, "ru")).toBe(`PROVIN_BUSINESS_${V}_RU.pdf`);
    expect(buildProvinAsvPdfFilename(V, "en")).toBe(`PROVIN_USA_${V}_EN.pdf`);
    expect(buildOemDealerPdfFilename(V, "en")).toBe(`OEM_DEALER_DATA_${V}_EN.pdf`);
  });
});
