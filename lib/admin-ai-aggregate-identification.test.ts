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
  });

  it("returns empty text when no vehicle parameters are known", () => {
    expect(buildAggregateIdentificationBrief({ sourceBlocks: mergeSourceBlocksWithDefaults({}) })).toBe(
      "",
    );
  });
});
