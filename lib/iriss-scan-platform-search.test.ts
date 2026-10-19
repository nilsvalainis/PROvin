import { describe, expect, it } from "vitest";
import {
  applyGeneratedScanSourceFilter,
  irissScanFilterPlatformForLinkKey,
} from "@/lib/iriss-scan-platform-search";
import { emptyIrissScanRecord } from "@/lib/iriss-scan-types";
import { IRISS_SCAN_SOURCES } from "@/lib/iriss-scan-sources";

function radar(patch: Partial<ReturnType<typeof emptyIrissScanRecord>> = {}) {
  return {
    ...emptyIrissScanRecord("11111111-1111-4111-8111-111111111111", "2026-10-19T00:00:00.000Z"),
    brandModel: "Volvo XC60",
    productionYears: "2018-2022",
    engineType: "dīzelis 140 kW",
    transmission: "automātiskā",
    bodyType: "SUV",
    ...patch,
  };
}

describe("applyGeneratedScanSourceFilter", () => {
  it("builds Auto1 / Autobid / Openlane / eCarsTrade / mobile.de / AutoScout24 from entry criteria", () => {
    const rec = radar();
    const auto1 = applyGeneratedScanSourceFilter(rec, "auto1");
    expect(auto1.url).toContain("manufacturer=VOLVO");
    expect(auto1.record.listingLinkAuto1[0]).toBe(auto1.url);

    const openlane = applyGeneratedScanSourceFilter(auto1.record, "openline");
    expect(openlane.url).toContain("makes=volvo");
    expect(openlane.record.listingLinkOpenline[0]).toBe(openlane.url);

    const autobid = applyGeneratedScanSourceFilter(openlane.record, "autobid");
    expect(autobid.url).toContain("brandId-brand=49");

    const et = applyGeneratedScanSourceFilter(autobid.record, "ecarstrade");
    expect(et.url).toContain("ecarstrade.com");

    const mobile = applyGeneratedScanSourceFilter(et.record, "mobilede");
    expect(mobile.url).toContain("suchen.mobile.de");
    expect(mobile.record.listingLinkMobile[0]).toBe(mobile.url);

    const as24 = applyGeneratedScanSourceFilter(mobile.record, "autoscout24");
    expect(as24.url).toContain("autoscout24.de");
    expect(as24.record.listingLinksOther[0]).toBe(as24.url);
  });

  it("does not duplicate an already appended filter", () => {
    const first = applyGeneratedScanSourceFilter(radar(), "auto1");
    const again = applyGeneratedScanSourceFilter(first.record, "auto1");
    expect(again.record.listingLinkAuto1).toEqual(first.record.listingLinkAuto1);
    expect(again.url).toBe(first.url);
  });

  it("returns null without a make", () => {
    const rec = emptyIrissScanRecord("11111111-1111-4111-8111-111111111111", "2026-10-19T00:00:00.000Z");
    expect(applyGeneratedScanSourceFilter(rec, "auto1").url).toBeNull();
    expect(applyGeneratedScanSourceFilter(rec, "mobilede").url).toBeNull();
  });

  it("maps every Radars source to a filter platform", () => {
    expect(IRISS_SCAN_SOURCES.map((s) => s.filterPlatform)).toEqual([
      "auto1",
      "openline",
      "autobid",
      "ecarstrade",
      "mobilede",
      "autoscout24",
    ]);
    expect(irissScanFilterPlatformForLinkKey("listingLinksOther")).toBe("autoscout24");
  });
});
