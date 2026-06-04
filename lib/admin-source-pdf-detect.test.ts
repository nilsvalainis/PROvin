import { describe, expect, it } from "vitest";
import { detectSourcePdfIngestTarget } from "@/lib/admin-source-pdf-detect";

describe("detectSourcePdfIngestTarget", () => {
  it("detects CarVertical from filename", () => {
    expect(detectSourcePdfIngestTarget("report_carvertical_2024.pdf", "")).toBe("carvertical");
  });

  it("detects AutoDNA from text", () => {
    expect(detectSourcePdfIngestTarget("history.pdf", "AutoDNA vehicle history report")).toBe("autodna");
  });

  it("detects LTAB from filename", () => {
    expect(detectSourcePdfIngestTarget("LTAB_OCTA_abc.pdf", "")).toBe("ltab");
  });

  it("detects CSDD from text", () => {
    expect(detectSourcePdfIngestTarget("report.pdf", "CSDD reģistrācijas dati e.csdd.lv")).toBe("csdd");
  });

  it("returns null for unknown without vendor hints", () => {
    expect(detectSourcePdfIngestTarget("random.pdf", "some generic text")).toBeNull();
  });
});
