import { describe, expect, it } from "vitest";
import { DEALER_ONLY_PDF_VISIBILITY, mergePdfVisibility } from "@/lib/pdf-visibility";

describe("mergePdfVisibility", () => {
  it("does not let saved unified flags hide the history hub", () => {
    const vis = mergePdfVisibility({ unifiedMileage: false, unifiedIncidents: false });
    expect(vis.unifiedMileage).toBe(true);
    expect(vis.unifiedIncidents).toBe(true);
  });

  it("dealer-only visibility keeps only official dealer sources", () => {
    expect(DEALER_ONLY_PDF_VISIBILITY.auto_records).toBe(true);
    expect(DEALER_ONLY_PDF_VISIBILITY.oneauto).toBe(true);
    expect(DEALER_ONLY_PDF_VISIBILITY.csdd).toBe(false);
    expect(DEALER_ONLY_PDF_VISIBILITY.ltab).toBe(false);
    expect(DEALER_ONLY_PDF_VISIBILITY.iriss).toBe(false);
    expect(DEALER_ONLY_PDF_VISIBILITY.unifiedMileage).toBe(false);
    expect(DEALER_ONLY_PDF_VISIBILITY.unifiedIncidents).toBe(false);
  });
});
