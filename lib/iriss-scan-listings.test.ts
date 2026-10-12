import { describe, expect, it } from "vitest";
import { buildIrissListingSources } from "@/lib/iriss-listings-sources";
import { irissScanOrderBrief, irissScanSourceRows, vehicleInListingDataset } from "@/lib/iriss-scan-listings";
import { emptyIrissScanRecord } from "@/lib/iriss-scan-types";

describe("iriss scan listings", () => {
  const rec = { ...emptyIrissScanRecord("11111111-1111-4111-8111-111111111111", "2026-01-01T00:00:00Z"), brandModel: "BMW X5" };
  rec.listingLinkAuto1 = ["https://www.auto1.com/a", "https://www.auto1.com/b"];
  it("builds one source per scan link with scan: prefix", () => {
    const src = buildIrissListingSources(irissScanSourceRows([rec]));
    expect(src).toHaveLength(2);
    expect(src.every((s) => s.orderId === `scan:${rec.id}`)).toBe(true);
  });
  it("brief and dataset filter", () => {
    expect(irissScanOrderBrief(rec).clientName).toBe("BMW X5");
    expect(vehicleInListingDataset([`scan:${rec.id}`], "scan")).toBe(true);
    expect(vehicleInListingDataset([`scan:${rec.id}`], "orders")).toBe(false);
    expect(vehicleInListingDataset([], "orders")).toBe(true);
    expect(vehicleInListingDataset(["abc", `scan:${rec.id}`], "orders")).toBe(true);
  });
});
