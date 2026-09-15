import { describe, expect, it } from "vitest";
import {
  ASV_ONLY_PDF_VISIBILITY,
  DEALER_ONLY_PDF_VISIBILITY,
  defaultPdfVisibilityForOrder,
  mergePdfVisibility,
} from "@/lib/pdf-visibility";

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
    expect(DEALER_ONLY_PDF_VISIBILITY.asv).toBe(false);
  });

  it("ASV-only visibility keeps US history plus unified hubs", () => {
    expect(ASV_ONLY_PDF_VISIBILITY.asv).toBe(true);
    expect(ASV_ONLY_PDF_VISIBILITY.unifiedMileage).toBe(true);
    expect(ASV_ONLY_PDF_VISIBILITY.unifiedIncidents).toBe(true);
    expect(ASV_ONLY_PDF_VISIBILITY.alerts).toBe(true);
    expect(ASV_ONLY_PDF_VISIBILITY.csdd).toBe(false);
    expect(ASV_ONLY_PDF_VISIBILITY.auto_records).toBe(false);
    expect(ASV_ONLY_PDF_VISIBILITY.cc_vin).toBe(false);
  });

  it("turns off paid history vendors for MINI defaults", () => {
    const vis = defaultPdfVisibilityForOrder({ checkoutLine: "mini", amountTotalCents: 3999 });
    expect(vis.autodna).toBe(false);
    expect(vis.carvertical).toBe(false);
    expect(vis.auto_records).toBe(false);
    expect(vis.oneauto).toBe(false);
    expect(vis.asv).toBe(false);
    expect(vis.csdd).toBe(true);
    expect(vis.sludinajums).toBe(true);
  });
});
