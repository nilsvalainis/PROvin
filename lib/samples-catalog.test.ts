import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SAMPLE_REPORTS, sampleReportAnchorId } from "@/lib/samples-catalog";

describe("samples catalog", () => {
  it("lists the BMW 525 LCI e61 audit PDF in public/samples", () => {
    expect(SAMPLE_REPORTS).toHaveLength(1);
    expect(SAMPLE_REPORTS[0]?.id).toBe("bmw525e61");
    expect(SAMPLE_REPORTS[0]?.href).toBe("/samples/provin-audits-bmw-525-e61.pdf");
    expect(sampleReportAnchorId("bmw525e61")).toBe("paraugs-bmw525e61");
    const pdf = join(process.cwd(), "public", "samples", "provin-audits-bmw-525-e61.pdf");
    expect(existsSync(pdf)).toBe(true);
  });
});
