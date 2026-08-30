import { describe, expect, it } from "vitest";
import {
  clientReportPrintInkCss,
  PROVIN_REPORT_PRINT_INK_CLASS,
} from "@/lib/client-report-print-ink-css";

describe("client report print-ink CSS", () => {
  it("scopes darker tokens to the print-ink html class", () => {
    const css = clientReportPrintInkCss();
    expect(css).toContain(`html.${PROVIN_REPORT_PRINT_INK_CLASS}`);
    expect(css).toContain("--pdf-line:#111827");
    expect(css).toContain("-webkit-font-smoothing:none");
    expect(css).not.toContain("filter:");
  });
});
