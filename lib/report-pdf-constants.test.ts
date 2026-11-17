import { describe, expect, it } from "vitest";
import { isReportPdfPathname, reportPdfPathPrefix, safeReportPdfFilename } from "@/lib/report-pdf-constants";

const SID = "cs_live_a1V0SCabc123";

describe("servera PDF ceļi", () => {
  it("pieņem tikai šī pasūtījuma mapi un pareizo paplašinājumu", () => {
    expect(isReportPdfPathname(SID, `${reportPdfPathPrefix(SID)}1700000000-atskaite.html`, ".html")).toBe(true);
    expect(isReportPdfPathname(SID, `${reportPdfPathPrefix(SID)}1700000000-PROVIN_AUDITS_X.pdf`, ".pdf")).toBe(true);
    expect(isReportPdfPathname(SID, `${reportPdfPathPrefix(SID)}a.pdf`, ".html")).toBe(false);
    expect(isReportPdfPathname(SID, `${reportPdfPathPrefix("cs_live_cits123")}a.html`, ".html")).toBe(false);
    expect(isReportPdfPathname(SID, `${reportPdfPathPrefix(SID)}../x.html`, ".html")).toBe(false);
    expect(isReportPdfPathname(SID, `${reportPdfPathPrefix(SID)}sub/x.html`, ".html")).toBe(false);
    expect(isReportPdfPathname("../etc", `admin-report-pdf/../etc/x.html`, ".html")).toBe(false);
  });

  it("faila nosaukums vienmēr drošs un ar .pdf", () => {
    expect(safeReportPdfFilename("PROVIN_AUDITS_WBA3K31080F656545.pdf")).toBe("PROVIN_AUDITS_WBA3K31080F656545.pdf");
    expect(safeReportPdfFilename('a b"/<x>.html')).toBe("a_b_x_.pdf");
    expect(safeReportPdfFilename("")).toBe("PROVIN_atskaite.pdf");
  });
});
