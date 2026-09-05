import { describe, expect, it } from "vitest";
import { auditCompletedEmailHtml } from "@/lib/email/html-templates";
import { buildPdfDocFooterHtml } from "@/lib/client-report-pdf-footer";
import {
  buildClientReportLegalFooterPlainText,
  buildPdfDocFooterIdentityLine,
  buildPdfDocFooterMetaLine,
  formatPdfDocFooterProductLabel,
  getClientReportLegalFooterBlocks,
} from "@/lib/report-pdf-standards";

describe("client report legal footer", () => {
  it("blocks match shared legal footer constants", () => {
    const b = getClientReportLegalFooterBlocks();
    expect(b.importantTitle).toBe("SVARĪGA INFORMĀCIJA");
    expect(b.disclaimer).toContain("digitāls datu apkopojums");
    expect(b.confidentiality).toContain("kategoriski aizliegts pavairot");
  });

  it("plain text includes key legal phrases", () => {
    const text = buildClientReportLegalFooterPlainText();
    expect(text).toContain("SVARĪGA INFORMĀCIJA");
    expect(text).toContain("digitāls datu apkopojums");
    expect(text).toContain("kategoriski aizliegts pavairot");
  });

  it("PDF colophon identity has product, VIN and date only", () => {
    expect(formatPdfDocFooterProductLabel("PROVIN_AUDITS")).toBe("PROVIN AUDITS");
    expect(formatPdfDocFooterProductLabel("PROVIN_MINI")).toBe("PROVIN MINI");
    expect(formatPdfDocFooterProductLabel("PROVIN_DILERIS")).toBe("OFICIĀLĀ DĪLERA DATI");
    expect(
      buildPdfDocFooterIdentityLine({
        productLabel: "PROVIN AUDITS",
        vin: "WVWZZZ1JZXW000001",
        generatedLabel: "Ģenerēts 23.08.2026",
      }),
    ).toBe("PROVIN AUDITS  ·  VIN WVWZZZ1JZXW000001  ·  Ģenerēts 23.08.2026");
    expect(
      buildPdfDocFooterMetaLine({
        vin: "WVWZZZ1JZXW000001",
        generatedLabel: "Ģenerēts 23.08.2026",
      }),
    ).toBe("VIN WVWZZZ1JZXW000001  ·  Ģenerēts 23.08.2026");
    expect(
      buildPdfDocFooterHtml({
        vin: "WVWZZZ1JZXW000001",
        amountTotalCents: 9999,
        generatedLabel: "Ģenerēts 23.08.2026",
      }),
    ).not.toContain("provin.lv");
  });

  it("PDF footer HTML includes the wordmark and no issuer personal data", () => {
    const html = buildPdfDocFooterHtml({
      vin: "WVWZZZ1JZXW000001",
      amountTotalCents: 9999,
      generatedLabel: "Ģenerēts 23.08.2026",
    });
    expect(html).toContain("pdf-doc-footer__logo");
    expect(html).toContain("PROVIN AUDITS");
    expect(
      buildPdfDocFooterHtml({
        vin: "WVWZZZ1JZXW000001",
        amountTotalCents: 9999,
        generatedLabel: "Ģenerēts 23.08.2026",
        productBrand: "PROVIN_DILERIS",
      }),
    ).toContain("OFICIĀLĀ DĪLERA DATI");
    expect(html).toContain("Atruna");
    expect(html).toContain("Konfidencialitāte");
    expect(html).not.toContain("Nils Valainis");
    expect(html).not.toContain("091187");
    expect(html).not.toContain("Jana iela");
    expect(html).not.toContain("provin.lv");
    expect(html).not.toContain("pdf-doc-footer__accent");
    expect(html).not.toContain("pdf-doc-footer__issuer");
  });

  it("audit completed email HTML includes shared legal footer", () => {
    const html = auditCompletedEmailHtml({
      carVin: "WVWZZZ1JZXW000001",
      attachmentLines: ["PROVIN_atskaite.pdf"],
      siteOrigin: "https://provin.lv",
    });
    expect(html).toContain("SVARĪGA INFORMĀCIJA");
    expect(html).toContain("digitāls datu apkopojums");
    expect(html).toContain("kategoriski aizliegts pavairot");
    expect(html).toContain("lietosanas-noteikumi");
    expect(html).toContain("privatuma-politika");
  });
});
