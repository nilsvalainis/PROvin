import { describe, expect, it } from "vitest";
import {
  buildPdfRunningFooterLine,
  buildPdfRunningHeaderLine,
  clientReportRunningPageCss,
} from "@/lib/pdf-running-page";

describe("PDF running header and footer", () => {
  it("builds PROVIN.LV · auto · VIN header and VIN · date · Sagatavots footer", () => {
    expect(buildPdfRunningHeaderLine("BMW 525d", "WBAPX51050CU09550")).toBe(
      "PROVIN.LV · BMW 525d · VIN WBAPX51050CU09550",
    );
    expect(
      buildPdfRunningFooterLine({
        vin: "WBAPX51050CU09550",
        dateLabel: "30.09.2026",
        preparedBy: "Jānis B.",
      }),
    ).toBe("WBAPX51050CU09550 · 30.09.2026 · Sagatavots: Jānis B.");
  });

  it("puts page numbers only on the right and nothing in the middle", () => {
    const css = clientReportRunningPageCss({
      header: "PROVIN.LV · BMW 525d · VIN WBAPX51050CU09550",
      footer: "WBAPX51050CU09550 · 30.09.2026 · Sagatavots: Jānis B.",
    });
    expect(css).toContain("margin:16mm 12mm 18mm 12mm");
    expect(css).toContain('@bottom-center{content:none;}');
    expect(css).toContain('content:"Lapa " counter(page) " / " counter(pages)');
    expect(css).toContain("@top-right{content:none;}");
  });
});
