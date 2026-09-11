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
    expect(packs.some((p) => p.id === "bmw_n57")).toBe(true);
    expect(packs.some((p) => p.id === "bmw_n47")).toBe(false);
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
    expect(packs.some((p) => p.id === "bmw_n57")).toBe(false);
    expect(packs.some((p) => p.id === "bmw_n47")).toBe(false);
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
    expect(packs.some((p) => p.id === "bmw_n57")).toBe(true);
    expect(packs.some((p) => p.id === "bmw_n47")).toBe(false);
  });

  it("selects BMW N47 pack by kW+cm3 without engine code", () => {
    const blocks = mergeSourceBlocksWithDefaults({
      csdd: {
        makeModel: "BMW 320d",
        fuelType: "Dīzeļdegviela",
        firstRegistration: "01.05.2012",
        engineDisplacementCm3: "1995",
        enginePowerKw: "135",
        emissionStandard: "Euro 5",
      },
    });
    const fp = extractVehicleReportFingerprint(blocks, { vin: null });
    fp.engineCode = "";
    const packs = selectAggregateCasePacks(fp);
    expect(packs.some((p) => p.id === "bmw_n47")).toBe(true);
    expect(packs.some((p) => p.id === "bmw_n57")).toBe(false);
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

  it("selects 2.0 TDI pack for Audi A4 DTPA and excludes 3.0 V6 TDI pack", () => {
    const blocks = mergeSourceBlocksWithDefaults({
      csdd: {
        makeModel: "Audi A4",
        fuelType: "Dīzeļdegviela",
        firstRegistration: "01.06.2020",
        engineDisplacementCm3: "1968",
        enginePowerKw: "150",
        emissionStandard: "Euro 6",
      },
    });
    const fp = extractVehicleReportFingerprint(blocks, { vin: null });
    fp.engineCode = "DTPA";
    const packs = selectAggregateCasePacks(fp);
    expect(packs.some((p) => p.id === "vag_2_0_tdi_dsg")).toBe(true);
    expect(packs.some((p) => p.id === "vag_audi_v6_tdi")).toBe(false);
    const tdi = packs.find((p) => p.id === "vag_2_0_tdi_dsg");
    expect(tdi?.body).toMatch(/zobsiksna/i);
    expect(tdi?.body).toMatch(/ne ķēde/i);
    expect(tdi?.body).toMatch(/termostata stāstu uz šo motoru NEDRĪKST kopēt/i);
  });

  it("selects OM654 pack and excludes OM642/OM651 diesel pack", () => {
    const blocks = mergeSourceBlocksWithDefaults({
      csdd: {
        makeModel: "Mercedes-Benz E 220",
        fuelType: "Dīzeļdegviela",
        firstRegistration: "01.06.2019",
        engineDisplacementCm3: "1950",
        enginePowerKw: "143",
        emissionStandard: "Euro 6",
      },
    });
    const fp = extractVehicleReportFingerprint(blocks, { vin: null });
    fp.engineCode = "OM654";
    const packs = selectAggregateCasePacks(fp);
    expect(packs.some((p) => p.id === "mercedes_om654")).toBe(true);
    expect(packs.some((p) => p.id === "mercedes_diesel")).toBe(false);
    const om = packs.find((p) => p.id === "mercedes_om654");
    expect(om?.body).toMatch(/OM654 ≠ OM651/i);
    expect(om?.body).toMatch(/rokera/i);
  });

  it("selects Volvo biturbo pack for D5244T11 ~158 kW and excludes single-turbo pack", () => {
    const blocks = mergeSourceBlocksWithDefaults({
      csdd: {
        makeModel: "Volvo V70",
        fuelType: "Dīzeļdegviela",
        firstRegistration: "15.03.2012",
        engineDisplacementCm3: "2400",
        enginePowerKw: "158",
        emissionStandard: "Euro 5",
      },
    });
    const fp = extractVehicleReportFingerprint(blocks, { vin: null });
    fp.engineCode = "D5244T11";
    fp.transmission = "manual";
    const packs = selectAggregateCasePacks(fp);
    expect(packs.some((p) => p.id === "volvo_d5_biturbo_block")).toBe(true);
    expect(packs.some((p) => p.id === "volvo_d5244_single_turbo")).toBe(false);
    const bi = packs.find((p) => p.id === "volvo_d5_biturbo_block");
    expect(bi?.body).toMatch(/D5244T11/i);
    expect(bi?.body).toMatch(/158 kW/i);
    expect(bi?.body).toMatch(/biturbo/i);
    expect(bi?.body).toMatch(/bloka plais/i);
    expect(bi?.body).not.toMatch(/viens turbo bez/i);
  });

  it("matches Volvo D5 single-turbo pack by kW+cm3+year without engine code", () => {
    const blocks = mergeSourceBlocksWithDefaults({
      csdd: {
        makeModel: "Volvo XC70",
        fuelType: "Dīzeļdegviela",
        firstRegistration: "01.06.2008",
        engineDisplacementCm3: "2400",
        enginePowerKw: "136",
        emissionStandard: "Euro 4",
      },
    });
    const fp = extractVehicleReportFingerprint(blocks, { vin: null });
    fp.engineCode = "";
    const packs = selectAggregateCasePacks(fp);
    expect(packs.some((p) => p.id === "volvo_d5244_single_turbo")).toBe(true);
    expect(packs.some((p) => p.id === "volvo_d5_biturbo_block")).toBe(false);
  });

  it("selects Volvo single-turbo pack for D5244T5 ~136 kW", () => {
    const blocks = mergeSourceBlocksWithDefaults({
      csdd: {
        makeModel: "Volvo V70",
        fuelType: "Dīzeļdegviela",
        firstRegistration: "01.06.2008",
        engineDisplacementCm3: "2400",
        enginePowerKw: "136",
        emissionStandard: "Euro 4",
      },
    });
    const fp = extractVehicleReportFingerprint(blocks, { vin: null });
    fp.engineCode = "D5244T5";
    const packs = selectAggregateCasePacks(fp);
    expect(packs.some((p) => p.id === "volvo_d5244_single_turbo")).toBe(true);
    expect(packs.some((p) => p.id === "volvo_d5_biturbo_block")).toBe(false);
  });

  it("selects Volvo biturbo block pack for higher-kW D5 without code", () => {
    const blocks = mergeSourceBlocksWithDefaults({
      csdd: {
        makeModel: "Volvo XC60",
        fuelType: "Dīzeļdegviela",
        firstRegistration: "01.04.2012",
        engineDisplacementCm3: "2400",
        enginePowerKw: "158",
        emissionStandard: "Euro 5",
      },
    });
    const fp = extractVehicleReportFingerprint(blocks, { vin: null });
    fp.engineCode = "";
    const packs = selectAggregateCasePacks(fp);
    expect(packs.some((p) => p.id === "volvo_d5_biturbo_block")).toBe(true);
    expect(packs.some((p) => p.id === "volvo_d5244_single_turbo")).toBe(false);
    const bi = packs.find((p) => p.id === "volvo_d5_biturbo_block");
    expect(bi?.body).toMatch(/bloka plais/i);
  });

  it("selects OM642 pack for 3.0 CDI and excludes OM651/OM654", () => {
    const blocks = mergeSourceBlocksWithDefaults({
      csdd: {
        makeModel: "Mercedes-Benz E 350",
        fuelType: "Dīzeļdegviela",
        firstRegistration: "01.06.2012",
        engineDisplacementCm3: "2987",
        enginePowerKw: "195",
        emissionStandard: "Euro 5",
      },
    });
    const fp = extractVehicleReportFingerprint(blocks, { vin: null });
    fp.engineCode = "OM642";
    const packs = selectAggregateCasePacks(fp);
    expect(packs.some((p) => p.id === "mercedes_om642")).toBe(true);
    expect(packs.some((p) => p.id === "mercedes_om651")).toBe(false);
    expect(packs.some((p) => p.id === "mercedes_om654")).toBe(false);
    expect(packs.find((p) => p.id === "mercedes_om642")?.body).toMatch(/7G-Tronic/i);
  });

  it("selects OM651 pack by kW+cm3 without code and excludes OM642", () => {
    const blocks = mergeSourceBlocksWithDefaults({
      csdd: {
        makeModel: "Mercedes-Benz C 220",
        fuelType: "Dīzeļdegviela",
        firstRegistration: "01.03.2013",
        engineDisplacementCm3: "2143",
        enginePowerKw: "125",
        emissionStandard: "Euro 5",
      },
    });
    const fp = extractVehicleReportFingerprint(blocks, { vin: null });
    fp.engineCode = "";
    const packs = selectAggregateCasePacks(fp);
    expect(packs.some((p) => p.id === "mercedes_om651")).toBe(true);
    expect(packs.some((p) => p.id === "mercedes_om642")).toBe(false);
  });

  it("selects EA888 early pack for 2010 TFSI and excludes gen3", () => {
    const blocks = mergeSourceBlocksWithDefaults({
      csdd: {
        makeModel: "Audi A4",
        fuelType: "Benzīns",
        firstRegistration: "01.06.2010",
        engineDisplacementCm3: "1984",
        enginePowerKw: "155",
        emissionStandard: "Euro 5",
      },
    });
    const fp = extractVehicleReportFingerprint(blocks, { vin: null });
    fp.engineCode = "";
    const packs = selectAggregateCasePacks(fp);
    expect(packs.some((p) => p.id === "vag_tfsi_ea888_early")).toBe(true);
    expect(packs.some((p) => p.id === "vag_tfsi_ea888_gen3")).toBe(false);
  });

  it("selects Volvo Drive-E D4 pack for D4204T14", () => {
    const blocks = mergeSourceBlocksWithDefaults({
      csdd: {
        makeModel: "Volvo XC60",
        fuelType: "Dīzeļdegviela",
        firstRegistration: "01.06.2017",
        engineDisplacementCm3: "1969",
        enginePowerKw: "140",
        emissionStandard: "Euro 6",
      },
    });
    const fp = extractVehicleReportFingerprint(blocks, { vin: null });
    fp.engineCode = "D4204T14";
    const packs = selectAggregateCasePacks(fp);
    expect(packs.some((p) => p.id === "volvo_d4_drive_e")).toBe(true);
    expect(packs.some((p) => p.id === "volvo_d5244_single_turbo")).toBe(false);
    expect(packs.some((p) => p.id === "volvo_d5_biturbo_block")).toBe(false);
  });
});
