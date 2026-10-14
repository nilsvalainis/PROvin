import { describe, expect, it } from "vitest";
import { emptyIrissScanRecord } from "@/lib/iriss-scan-types";
import { irissScanHasOperatorContent, irissScanVinFromQuery } from "@/lib/iriss-scan-vin";

describe("irissScanVinFromQuery", () => {
  it("accepts a valid VIN and rejects junk", () => {
    expect(irissScanVinFromQuery("WBAZZZ8V0K1237731")).toBe("WBAZZZ8V0K1237731");
    expect(irissScanVinFromQuery("nope")).toBe("");
    expect(irissScanVinFromQuery(undefined)).toBe("");
  });
});

describe("irissScanHasOperatorContent", () => {
  it("treats an empty card as empty and VIN or a link as content", () => {
    const rec = emptyIrissScanRecord("11111111-1111-4111-8111-111111111111", "2026-10-14T10:00:00.000Z");
    expect(irissScanHasOperatorContent(rec)).toBe(false);
    expect(irissScanHasOperatorContent({ ...rec, vin: "WBAZZZ8V0K1237731" })).toBe(true);
    expect(irissScanHasOperatorContent({ ...rec, listingLinkAuto1: ["https://auto1.com/x"] })).toBe(true);
    expect(irissScanHasOperatorContent({ ...rec, listingLinkEcarstrade: ["https://ecarstrade.com/search?mark[]=68"] })).toBe(true);
  });
});
