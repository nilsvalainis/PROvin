import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SAMPLE_REPORTS, sampleReportAnchorId } from "@/lib/samples-catalog";
import { TP5_AUDITS_SAMPLE_REPORT_HREF } from "@/lib/test-pricing-5-ui-copy";

describe("samples catalog", () => {
  it("lists the Ford Galaxy audit PDF used by the hero AUDITS tab", () => {
    expect(SAMPLE_REPORTS).toHaveLength(1);
    expect(SAMPLE_REPORTS[0]?.id).toBe("fordGalaxy");
    expect(SAMPLE_REPORTS[0]?.href).toBe(TP5_AUDITS_SAMPLE_REPORT_HREF);
    expect(SAMPLE_REPORTS[0]?.href).toBe("/samples/provin-audits-piemers.pdf");
    expect(sampleReportAnchorId("fordGalaxy")).toBe("paraugs-fordGalaxy");
    const pdf = join(process.cwd(), "public", "samples", "provin-audits-piemers.pdf");
    expect(existsSync(pdf)).toBe(true);
  });
});
