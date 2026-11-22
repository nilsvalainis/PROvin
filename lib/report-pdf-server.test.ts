import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { REPORT_PDF_RENDER_CSP, isAllowedReportPdfRequestUrl, withReportPdfRenderCsp } from "@/lib/report-pdf-server";

describe("servera PDF renderis - resursu ierobežojums", () => {
  it("atļauj tikai iegultus resursus", () => {
    expect(isAllowedReportPdfRequestUrl("data:image/png;base64,AAAA")).toBe(true);
    expect(isAllowedReportPdfRequestUrl("data:font/woff2;base64,AAAA")).toBe(true);
    expect(isAllowedReportPdfRequestUrl("about:blank")).toBe(true);
    expect(isAllowedReportPdfRequestUrl("blob:null/1")).toBe(true);
  });

  it("bloķē tīklu un vietējos failus", () => {
    for (const url of [
      "https://example.com/a.js",
      "http://169.254.169.254/latest/meta-data/",
      "http://localhost:3000/api/admin/orders",
      "file:///etc/passwd",
      "ws://example.com/",
      "//example.com/a.png",
      "ftp://example.com/a",
    ]) {
      expect(isAllowedReportPdfRequestUrl(url), url).toBe(false);
    }
  });

  it("satura politika tiek ielikta head sākumā", () => {
    const html = withReportPdfRenderCsp('<!DOCTYPE html><html lang="lv"><head><meta charset="utf-8"/></head><body></body></html>');
    expect(html).toContain(`<head><meta http-equiv="Content-Security-Policy" content="${REPORT_PDF_RENDER_CSP}"/><meta charset`);
    expect(REPORT_PDF_RENDER_CSP).toContain("default-src 'none'");
    expect(REPORT_PDF_RENDER_CSP).toContain("connect-src 'none'");
    expect(REPORT_PDF_RENDER_CSP).toContain("frame-src 'none'");
  });

  it("bez head politika ir dokumenta sākumā", () => {
    expect(withReportPdfRenderCsp("<p>x</p>").startsWith("<meta http-equiv")).toBe(true);
  });
});
