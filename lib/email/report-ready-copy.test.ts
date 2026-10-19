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

  it("builds dealer subject without a consumer discount", () => {
    expect(buildReportReadySubject("dealer", "WAUZZZF44LA062962")).toBe(
      "PROVIN: oficiālā dīlera dati ir gatavi",
    );
    const text = buildReportReadyPlainText({
      kind: "dealer",
      vin: "WAUZZZF44LA062962",
      attachmentLines: ["OFICIALA_DILERA_DATI.pdf"],
    });
    expect(text).toContain("oficiālā dīlera dati");
    expect(text).toContain("OFICIALA_DILERA_DATI.pdf");
    expect(text).not.toContain("20%");
    expect(text).not.toContain("79,99");
    expect(text).not.toContain("PROVIN AUDITS");
    expect(text).toContain("Nils");
    expect(text).toContain("PROVIN.LV");
    expect(text).not.toContain("PROVIN.LV komanda");
    expect(text).not.toContain("g.page");
    expect(text).not.toMatch(/—/);
  });

  it("builds mini and audits bodies", () => {
    expect(buildReportReadySubject("mini", "ABC")).toBe("PROVIN MINI atskaite ir gatava");
    expect(buildReportReadyPlainText({ kind: "mini", vin: "ABC", attachmentLines: [] })).toContain(
      "PROVIN MINI atskaite",
    );
    expect(buildReportReadyPlainText({ kind: "audits", vin: "ABC", attachmentLines: [] })).toContain(
      "Kopsavilkuma PDF atskaiti",
    );
  });

  it("dealer HTML does not offer a consumer discount", () => {
    const html = auditCompletedEmailHtml({
      carVin: "WAUZZZF44LA062962",
      attachmentLines: ["dileris.pdf"],
      productKind: "dealer",
    });
    expect(html).toContain("oficiālā dīlera");
    expect(html).not.toContain("Pasūtīt PROVIN AUDITS");
    expect(html).not.toContain("20%");
    expect(html).not.toContain("79,99");
    expect(html).toContain("Nils");
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
    expect(on).toContain("būšu pateicīgs par īsu atsauksmi");
    expect(on).toContain("https://g.page/r/CamRaT51IPQ_EBM/review");
  });

  it("rebrands B2B client report-ready mail to PROVIN without Nils or IRISS", () => {
    const text = buildReportReadyPlainText({
      kind: "audits",
      vin: "WVWZZZ3HZHE703058",
      attachmentLines: ["PROVIN_atskaite.pdf"],
      includeGoogleReview: true,
      b2bClient: true,
    });
    expect(text).toContain("PROVIN AUDITS atskaite");
    expect(text).toContain("Ar cieņu,\nPROVIN");
    expect(text).not.toContain("Nils");
    expect(text).not.toContain("IRISS");
    expect(text).not.toContain("PROVIN.LV");
    expect(text).not.toContain("g.page");
    expect(text).not.toMatch(/[–—]/);

    const html = auditCompletedEmailHtml({
      carVin: "WVWZZZ3HZHE703058",
      attachmentLines: ["PROVIN_atskaite.pdf"],
      productKind: "audits",
      includeGoogleReview: true,
      b2bClient: true,
    });
    expect(html).toContain("#0061D2");
    expect(html).toContain("Ar cieņu,<br/><span style=\"color:#0061D2;font-weight:600;\">PROVIN</span>");
    expect(html).not.toContain("Nils / IRISS");
    expect(html).not.toContain("PROVIN.LV");
    expect(html).not.toContain("g.page");
    expect(html).not.toMatch(/[–—]/);

    const retail = auditCompletedEmailHtml({
      carVin: "WVWZZZ3HZHE703058",
      attachmentLines: ["PROVIN_atskaite.pdf"],
      productKind: "audits",
    });
    expect(retail).toContain("Nils");
    expect(retail).toContain("PROVIN.LV");
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
    expect(on).toContain("būšu pateicīgs par īsu atsauksmi");
    expect(on).toContain("https://g.page/r/CamRaT51IPQ_EBM/review");
    expect(on).toContain("Nils");
    expect(on.indexOf("g.page")).toBeLessThan(on.indexOf("Nils"));
  });
});
