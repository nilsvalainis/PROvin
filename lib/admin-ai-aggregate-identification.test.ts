import { describe, expect, it } from "vitest";
import { emptyCsddFields, mergeSourceBlocksWithDefaults } from "@/lib/admin-source-blocks";
import { buildAggregateIdentificationBrief } from "@/lib/admin-ai-aggregate-identification";

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
    expect(brief).not.toMatch(/LŪKA \/ PANORĀMAS LŪKA/);
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
    expect(brief).toMatch(/LŪKA \/ PANORĀMAS LŪKA datos: Glass roof/);
    expect(brief).toMatch(/grīdas paklāji/);
    expect(brief).not.toMatch(/īpaši Volkswagen/);
  });

  it("flags a VW panoramic roof as a typical clogged-drain inspection item", () => {
    const blocks = mergeSourceBlocksWithDefaults({
      csdd: { ...emptyCsddFields(), makeModel: "VW Tiguan" },
      auto_records: {
        outvinReport: {
          vehicleInfo: { model: "Tiguan" },
          accidentCheck: "",
          stolenCheck: "",
          equipment: [{ code: "4F2", description: "Panoramadach" }],
        },
      },
    });
    const brief = buildAggregateIdentificationBrief({ sourceBlocks: blocks, nowYear: 2026 });
    expect(brief).toMatch(/LŪKA \/ PANORĀMAS LŪKA datos: Panoramadach/);
    expect(brief).toMatch(/īpaši Volkswagen/);
    expect(brief).toMatch(/drenāžas/);
  });

  it("flags a sunroof mentioned only in the listing paste", () => {
    const blocks = mergeSourceBlocksWithDefaults({
      csdd: { ...emptyCsddFields(), makeModel: "VW Golf" },
      listing_analysis: {
        listingPasteRaw: "Pilna aprīkojuma Golf ar panorāmas lūku, ACC un LED.",
      },
    });
    const brief = buildAggregateIdentificationBrief({ sourceBlocks: blocks, nowYear: 2026 });
    expect(brief).toMatch(/LŪKA \/ PANORĀMAS LŪKA datos: sludinājuma apraksts/);
  });

  it("does not flag roof rails as a sunroof", () => {
    const blocks = mergeSourceBlocksWithDefaults({
      csdd: { ...emptyCsddFields(), makeModel: "VW Passat" },
      listing_analysis: { listingPasteRaw: "Jumta relingi, saulessargi, panorāmas kamera." },
    });
    const brief = buildAggregateIdentificationBrief({ sourceBlocks: blocks, nowYear: 2026 });
    expect(brief).not.toMatch(/LŪKA \/ PANORĀMAS LŪKA/);
  });

  it("returns empty text when no vehicle parameters are known", () => {
    expect(buildAggregateIdentificationBrief({ sourceBlocks: mergeSourceBlocksWithDefaults({}) })).toBe(
      "",
    );
  });
});
