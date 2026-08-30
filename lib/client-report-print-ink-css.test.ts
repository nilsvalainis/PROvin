import { describe, expect, it } from "vitest";
import {
  clientReportPrintInkCss,
  PROVIN_REPORT_PRINT_INK_CLASS,
} from "@/lib/client-report-print-ink-css";

describe("client report print-ink CSS", () => {
  it("darkens copy without thickening card frames to black", () => {
    const css = clientReportPrintInkCss();
    expect(css).toContain(`html.${PROVIN_REPORT_PRINT_INK_CLASS}`);
    expect(css).toContain("--pdf-line:#C5CDD8");
    expect(css).toContain("color:#334155");
    expect(css).not.toContain("--pdf-line:#111827");
    expect(css).not.toContain("border-width:1.75px");
    expect(css).not.toContain("filter:");
  });
});
