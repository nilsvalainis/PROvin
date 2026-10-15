import { describe, expect, it } from "vitest";
import { formatPdfPreparedByName, pdfCustomerNameLooksLikeCompany } from "@/lib/pdf-prepared-by-name";

describe("formatPdfPreparedByName", () => {
  it("shortens a private person to first name and last initial", () => {
    expect(formatPdfPreparedByName("Jānis Bērziņš")).toBe("Jānis B.");
    expect(pdfCustomerNameLooksLikeCompany("Jānis Bērziņš")).toBe(false);
  });

  it("keeps a company name in full", () => {
    expect(formatPdfPreparedByName("DZINTARZEME AUTO")).toBe("DZINTARZEME AUTO");
    expect(formatPdfPreparedByName("SIA Demo Auto")).toBe("SIA Demo Auto");
    expect(pdfCustomerNameLooksLikeCompany("DZINTARZEME AUTO")).toBe(true);
  });
});
