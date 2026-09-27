import { describe, expect, it } from "vitest";
import { auditCompletedEmailHtml } from "@/lib/email/html-templates";
import {
  buildReportReadyPlainText,
  buildReportReadySubject,
  resolveReportReadyProductKind,
} from "@/lib/email/report-ready-copy";

describe("report-ready product emails", () => {
  it("resolves dealer mini and audits from checkout line", () => {
    expect(resolveReportReadyProductKind({ checkoutLine: "dealer" })).toBe("dealer");
    expect(resolveReportReadyProductKind({ checkoutLine: "mini" })).toBe("mini");
    expect(resolveReportReadyProductKind({ checkoutLine: "premium" })).toBe("audits");
  });

  it("builds dealer subject and offer copy", () => {
    expect(buildReportReadySubject("dealer", "WAUZZZF44LA062962")).toBe(
      "PROVIN servisa vēstures atskaite (WAUZZZF44LA062962)",
    );
    const text = buildReportReadyPlainText({
      kind: "dealer",
      vin: "WAUZZZF44LA062962",
      attachmentLines: ["OFICIALA_DILERA_DATI.pdf"],
      offerAuditDiscount: true,
    });
    expect(text).toContain("oficiālā dīlera servisa vēstures dati");
    expect(text).toContain("OFICIALA_DILERA_DATI.pdf");
    expect(text).toContain("20% atlaidi");
    expect(text).toContain("79,99 €");
    expect(text).toContain("Nils / IRISS");
    expect(text).toContain("PROVIN.LV");
    expect(text).not.toContain("PROVIN.LV komanda");
    expect(text).not.toContain("g.page");
    expect(text).not.toMatch(/—/);
  });

  it("omits the dealer offer unless asked", () => {
    const text = buildReportReadyPlainText({
      kind: "dealer",
      vin: "WAUZZZF44LA062962",
      attachmentLines: ["a.pdf"],
      offerAuditDiscount: false,
    });
    expect(text).not.toContain("20%");
    expect(text).not.toContain("PROVIN AUDITS");
  });

  it("builds mini and audits bodies", () => {
    expect(buildReportReadySubject("mini", "ABC")).toBe("PROVIN MINI atskaite (ABC)");
    expect(buildReportReadyPlainText({ kind: "mini", vin: "ABC", attachmentLines: [] })).toContain(
      "PROVIN MINI atskaite",
    );
    expect(buildReportReadyPlainText({ kind: "audits", vin: "ABC", attachmentLines: [] })).toContain(
      "Kopsavilkuma PDF atskaiti",
    );
  });

  it("dealer HTML includes CTA only with the offer flag", () => {
    const off = auditCompletedEmailHtml({
      carVin: "WAUZZZF44LA062962",
      attachmentLines: ["dileris.pdf"],
      productKind: "dealer",
    });
    expect(off).toContain("oficiālā dīlera");
    expect(off).not.toContain("Pasūtīt PROVIN AUDITS");

    const on = auditCompletedEmailHtml({
      carVin: "WAUZZZF44LA062962",
      attachmentLines: ["dileris.pdf"],
      productKind: "dealer",
      offerAuditDiscount: true,
    });
    expect(on).toContain("Pasūtīt PROVIN AUDITS par 79,99 €");
    expect(on).toContain('href="https://provin.lv"');
    expect(on).toContain("20% atlaidi");
    expect(on).toContain("Nils / IRISS");
  });

  it("adds Google review HTML only when asked", () => {
    const off = auditCompletedEmailHtml({
      carVin: "ABC",
      attachmentLines: [],
      productKind: "audits",
    });
    expect(off).not.toContain("g.page");

    const on = auditCompletedEmailHtml({
      carVin: "ABC",
      attachmentLines: [],
      productKind: "audits",
      includeGoogleReview: true,
    });
    expect(on).toContain("atvēlēsiet īsu brīdi");
    expect(on).toContain("https://g.page/r/CamRaT51IPQ_EBM/review");
  });

  it("adds Google review only when asked", () => {
    const off = buildReportReadyPlainText({
      kind: "mini",
      vin: "ABC",
      attachmentLines: [],
    });
    expect(off).not.toContain("g.page");

    const on = buildReportReadyPlainText({
      kind: "mini",
      vin: "ABC",
      attachmentLines: [],
      includeGoogleReview: true,
    });
    expect(on).toContain("atvēlēsiet īsu brīdi");
    expect(on).toContain("https://g.page/r/CamRaT51IPQ_EBM/review");
    expect(on).toContain("Nils / IRISS");
    expect(on.indexOf("g.page")).toBeLessThan(on.indexOf("Nils / IRISS"));
  });
});
