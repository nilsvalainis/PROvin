import { describe, expect, it } from "vitest";
import { emptyCsddFields, mergeSourceBlocksWithDefaults } from "@/lib/admin-source-blocks";
import {
  buildAggregateIdentificationBrief,
  isBmw3SeriesChassis,
} from "@/lib/admin-ai-aggregate-identification";

describe("buildAggregateIdentificationBrief", () => {
  it("collects the parameters needed to derive engine, gearbox and mileage band", () => {
    const blocks = mergeSourceBlocksWithDefaults({
      csdd: {
        ...emptyCsddFields(),
        makeModel: "BMW 320D",
        firstRegistration: "2016-04-12",
        fuelType: "Dīzeļdegviela",
        engineDisplacementCm3: "1995",
        enginePowerKw: "140",
        emissionStandard: "EURO 6",
        mileageHistory: [
          { date: "10.05.2020", odometer: "120000", country: "Vācija" },
          { date: "18.03.2026", odometer: "245000", country: "Latvija" },
        ],
      },
    });

    const brief = buildAggregateIdentificationBrief({ sourceBlocks: blocks, nowYear: 2026 });

    expect(brief).toContain("Agregātu identifikācijas dati");
    expect(brief).toContain("BMW 320D");
    expect(brief).toContain("2016");
    expect(brief).toContain("vecums ~10 gadi");
    expect(brief).toContain("1995 cm³");
    expect(brief).toMatch(/140 kW \(~190 zs\)/);
    expect(brief).toContain("EURO 6");
    expect(brief).toMatch(/Jaunākais nobraukuma ieraksts: 245 000 km/);
    expect(brief).toMatch(/~24 500 km\/gadā/);
    expect(brief).toMatch(/1–2 kandidātus/);
    expect(brief).toMatch(/Aprīkojuma SA saraksts: nav/);
    expect(brief).toMatch(/BMW 3\. sērija/);
    expect(brief).not.toMatch(/NAV minēti/);
    expect(brief).not.toMatch(/Active Steering, Dynamic Drive, Soft Close/);
  });

  it("lists dealer equipment and flags expensive age options when present", () => {
    const blocks = mergeSourceBlocksWithDefaults({
      csdd: { ...emptyCsddFields(), makeModel: "BMW 525" },
      auto_records: {
        outvinReport: {
          vehicleInfo: {
            model: "BMW E61",
            modelSeries: "E61",
            vinCode: "",
            vehicleType: "PX61",
            transmission: "AUT",
            steeringSide: "LL",
            engineCode: "M57/T2",
            engineNumber: "",
            body: "TOU",
            drive: "HECK",
            power: "145 kW",
            integrationLevel: "",
            currentILevel: "",
            developmentCode: "E61",
            modelCode: "PX61",
            productionDate: "",
            firstRegistration: "",
            warrantyStartDate: "",
            countryRegion: "",
            color: "",
            colorCode: "",
            interior: "",
            interiorCode: "",
          },
          accidentCheck: "",
          stolenCheck: "",
          equipment: [
            { code: "0205", description: "Automatic transmission" },
            { code: "0255", description: "Sports leather steering wheel" },
            { code: "0217", description: "Active steering" },
            { code: "0677", description: "HiFi Professional DSP" },
            { code: "02BY", description: "BMW LA wheel" },
            { code: "0403", description: "Glass roof" },
          ],
        },
      },
    });
    const brief = buildAggregateIdentificationBrief({ sourceBlocks: blocks, nowYear: 2026 });
    expect(brief).toMatch(/Piedziņa \(dīleris\): HECK \(aizmugures piedziņa\)/);
    expect(brief).toMatch(/Virsbūve \(dīleris\): TOU/);
    expect(brief).toMatch(/0217 — Active steering/);
    expect(brief).toMatch(/Dārgas vecuma pozīcijas sarakstā: Active steering/);
    expect(brief).toMatch(/E60\/E61/);
  });

  it("does not inject the E60 option-absence list onto a 3-series with a long SA list", () => {
    const blocks = mergeSourceBlocksWithDefaults({
      csdd: { ...emptyCsddFields(), makeModel: "BMW 320i" },
      auto_records: {
        outvinReport: {
          vehicleInfo: {
            model: "BMW E90",
            modelSeries: "E90",
            vinCode: "",
            vehicleType: "",
            transmission: "MAN",
            steeringSide: "LL",
            engineCode: "N52",
            engineNumber: "",
            body: "LIM",
            drive: "ALLRAD",
            power: "125 kW",
            integrationLevel: "",
            currentILevel: "",
            developmentCode: "E90",
            modelCode: "",
            productionDate: "",
            firstRegistration: "",
            warrantyStartDate: "",
            countryRegion: "",
            color: "",
            colorCode: "",
            interior: "",
            interiorCode: "",
          },
          accidentCheck: "",
          stolenCheck: "",
          equipment: [
            { code: "03AC", description: "Trailer hitch" },
            { code: "0522", description: "Xenon light" },
            { code: "0524", description: "Adaptive headlights" },
            { code: "0536", description: "Auxiliary heating" },
            { code: "0609", description: "Navigation Professional" },
            { code: "0423", description: "Floor mats velours" },
            { code: "0431", description: "Interior mirror with automatic-dim" },
          ],
        },
      },
    });
    const brief = buildAggregateIdentificationBrief({ sourceBlocks: blocks, nowYear: 2026 });
    expect(brief).toMatch(/BMW 3\. sērija/);
    expect(brief).toMatch(/Ja E90 N52/);
    expect(brief).not.toMatch(/NAV minēti/);
    expect(brief).not.toMatch(/Soft Close, Logic 7, Airmatic/);
    expect(brief).toMatch(/NEKAD neslavē, ka nav Active Steering/);
  });

  it("returns empty text when no vehicle parameters are known", () => {
    expect(buildAggregateIdentificationBrief({ sourceBlocks: mergeSourceBlocksWithDefaults({}) })).toBe(
      "",
    );
  });

  it("recognises BMW 3-series chassis codes and type badges", () => {
    expect(isBmw3SeriesChassis("BMW 320i", "E90")).toBe(true);
    expect(isBmw3SeriesChassis("BMW 320D", "")).toBe(true);
    expect(isBmw3SeriesChassis("BMW 525d", "E61")).toBe(false);
  });
});
