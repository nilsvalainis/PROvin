import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SAMPLE_REPORTS, sampleReportAnchorId } from "@/lib/samples-catalog";
import { TP5_AUDITS_SAMPLE_REPORT_HREF } from "@/lib/test-pricing-5-ui-copy";

describe("samples catalog", () => {
  it("lists Ford Galaxy and BMW 525 audit PDFs side by side", () => {
    expect(SAMPLE_REPORTS.map((item) => item.id)).toEqual(["fordGalaxy", "bmw525e61"]);
    expect(SAMPLE_REPORTS[0]?.href).toBe(TP5_AUDITS_SAMPLE_REPORT_HREF);
    expect(SAMPLE_REPORTS[1]?.href).toBe("/samples/provin-audits-bmw-525-e61.pdf");
    expect(sampleReportAnchorId("fordGalaxy")).toBe("paraugs-fordGalaxy");
    expect(sampleReportAnchorId("bmw525e61")).toBe("paraugs-bmw525e61");
    for (const item of SAMPLE_REPORTS) {
      const file = join(process.cwd(), "public", item.href.replace(/^\//, ""));
      expect(existsSync(file), file).toBe(true);
    }
  });
});
