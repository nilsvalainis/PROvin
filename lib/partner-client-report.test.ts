import { describe, expect, it } from "vitest";
import { emailsMatchForPartnerArchive, pickClientReportPdfAttachment } from "@/lib/partner-client-report";

describe("pickClientReportPdfAttachment", () => {
  it("prefers the PROVIN report over other PDFs", () => {
    const picked = pickClientReportPdfAttachment([
      { filename: "servisa-izraksts.pdf", contentType: "application/pdf" },
      { filename: "PROVIN_AUDITS_WVWZZZ3CZWE123456.pdf", contentType: "application/pdf" },
      { filename: "foto.jpg", contentType: "image/jpeg" },
    ]);
    expect(picked?.filename).toBe("PROVIN_AUDITS_WVWZZZ3CZWE123456.pdf");
  });

  it("falls back to the first PDF when the report name is generic", () => {
    const picked = pickClientReportPdfAttachment([
      { filename: "atskaite.pdf", contentType: "application/pdf" },
      { filename: "pielikums.pdf", contentType: "application/pdf" },
    ]);
    expect(picked?.filename).toBe("atskaite.pdf");
  });

  it("returns null when there is no PDF", () => {
    expect(
      pickClientReportPdfAttachment([{ filename: "foto.jpg", contentType: "image/jpeg" }]),
    ).toBeNull();
  });
});

describe("emailsMatchForPartnerArchive", () => {
  it("matches emails case-insensitively", () => {
    expect(emailsMatchForPartnerArchive("Demo@PROvin.lv", "demo@provin.lv")).toBe(true);
    expect(emailsMatchForPartnerArchive("a@b.lv", "c@d.lv")).toBe(false);
    expect(emailsMatchForPartnerArchive("", "a@b.lv")).toBe(false);
  });
});
