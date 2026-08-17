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
    expect(packs.some((p) => p.id === "bmw_m57_e60_e61")).toBe(false);
  });

  it("selects M57 E60/E61 pack and excludes N47/N57 chain pack", () => {
    const blocks = mergeSourceBlocksWithDefaults({
      csdd: {
        makeModel: "BMW 525",
        fuelType: "Dīzeļdegviela",
        firstRegistration: "29.07.2008",
        engineDisplacementCm3: "2993",
        enginePowerKw: "145",
        emissionStandard: "Euro 4",
      },
    });
    const fp = extractVehicleReportFingerprint(blocks, { vin: "WBAPX51050CU09550" });
    fp.engineCode = "M57/T2";
    fp.typeCode = "PX61";
    const packs = selectAggregateCasePacks(fp);
    expect(packs.some((p) => p.id === "bmw_m57_e60_e61")).toBe(true);
    expect(packs.some((p) => p.id === "bmw_diesel_chains")).toBe(false);
    const m57 = packs.find((p) => p.id === "bmw_m57_e60_e61");
    expect(m57?.body).toMatch(/ķēde dzinēja priekšpusē/i);
    expect(m57?.body).toMatch(/Active Steering/);
    expect(m57?.body).toMatch(/hidromufte/);
  });

  it("does not select M57 pack for F10-era N57 530d", () => {
    const blocks = mergeSourceBlocksWithDefaults({
      csdd: {
        makeModel: "BMW 530d",
        fuelType: "Dīzeļdegviela",
        firstRegistration: "01.06.2012",
        engineDisplacementCm3: "2993",
        enginePowerKw: "190",
        emissionStandard: "Euro 5",
      },
    });
    const fp = extractVehicleReportFingerprint(blocks, { vin: null });
    fp.engineCode = "N57";
    const packs = selectAggregateCasePacks(fp);
    expect(packs.some((p) => p.id === "bmw_m57_e60_e61")).toBe(false);
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
