import { describe, expect, it } from "vitest";

import { compareVendorPdfModelReads } from "@/lib/vendor-pdf-model-eval";
import { emptyVendorReportExtract, type VendorReportExtract } from "@/lib/vendor-report-extract";

function withMileage(rows: [string, string][]): VendorReportExtract {
  const out = emptyVendorReportExtract("carvertical");
  for (const [date, odometer] of rows) out.mileage.push({ date, odometer, country: "" } as never);
  return out;
}

const ROWS: [string, string][] = [
  ["01.01.2020", "10000"],
  ["01.01.2021", "20000"],
  ["01.01.2022", "30000"],
];

describe("compareVendorPdfModelReads", () => {
  it("Gemini matching Sonnet is not worse", () => {
    const r = compareVendorPdfModelReads({
      local: withMileage(ROWS),
      gemini: { extract: withMileage(ROWS), error: "", ms: 1 },
      sonnet: { extract: withMileage(ROWS), error: "", ms: 1 },
    });
    expect(r.geminiNotWorse).toBe(true);
    expect(r.geminiMileageRecall).toBe(1);
  });

  it("Gemini error is worse", () => {
    const r = compareVendorPdfModelReads({
      local: withMileage(ROWS),
      gemini: { extract: null, error: "missing_gemini_key", ms: 1 },
      sonnet: { extract: withMileage(ROWS), error: "", ms: 1 },
    });
    expect(r.geminiNotWorse).toBe(false);
    expect(r.reasons[0]).toContain("missing_gemini_key");
  });

  it("fewer rows or different rows than Sonnet is worse", () => {
    const fewer = compareVendorPdfModelReads({
      local: withMileage([]),
      gemini: { extract: withMileage(ROWS.slice(0, 2)), error: "", ms: 1 },
      sonnet: { extract: withMileage(ROWS), error: "", ms: 1 },
    });
    expect(fewer.geminiNotWorse).toBe(false);

    const wrong = compareVendorPdfModelReads({
      local: withMileage([]),
      gemini: { extract: withMileage([["01.01.2020", "10000"], ["01.01.2021", "20000"], ["02.02.2022", "31000"]]), error: "", ms: 1 },
      sonnet: { extract: withMileage(ROWS), error: "", ms: 1 },
    });
    expect(wrong.geminiNotWorse).toBe(false);
    expect(wrong.reasons.join()).toMatch(/mileage_recall/);
  });

  it("Gemini working while Sonnet fails is not worse", () => {
    const r = compareVendorPdfModelReads({
      local: withMileage(ROWS),
      gemini: { extract: withMileage(ROWS), error: "", ms: 1 },
      sonnet: { extract: null, error: "529", ms: 1 },
    });
    expect(r.geminiNotWorse).toBe(true);
  });
});
