import { describe, expect, it } from "vitest";
import { extractVehicleReportFingerprint } from "@/lib/admin-vehicle-report-fingerprint";
import { mergeSourceBlocksWithDefaults } from "@/lib/admin-source-blocks";
import { fingerprintLearningKey, selectAggregateCasePacks } from "@/lib/provin-aggregate-case-rules";

describe("provin-aggregate-case-rules", () => {
  it("selects BMW diesel chain pack for BMW dīzelis", () => {
    const blocks = mergeSourceBlocksWithDefaults({
      csdd: {
        makeModel: "BMW 520d",
        fuelType: "Dīzeļdegviela",
        firstRegistration: "01.01.2015",
        engineDisplacementCm3: "1995",
        enginePowerKw: "140",
        emissionStandard: "Euro 6",
      },
    });
    const fp = extractVehicleReportFingerprint(blocks, { vin: null });
    fp.engineCode = "N57";
    const packs = selectAggregateCasePacks(fp);
    expect(packs.some((p) => p.id === "bmw_diesel_chains")).toBe(true);
  });

  it("builds stable learning key from fingerprint", () => {
    const blocks = mergeSourceBlocksWithDefaults({
      csdd: { makeModel: "Audi A6", fuelType: "Dīzeļdegviela", firstRegistration: "2012" },
    });
    const fp = extractVehicleReportFingerprint(blocks, {});
    fp.engineCode = "CGLC";
    const k1 = fingerprintLearningKey(fp);
    const k2 = fingerprintLearningKey(fp);
    expect(k1).toBe(k2);
    expect(k1.length).toBeGreaterThan(3);
  });
});
