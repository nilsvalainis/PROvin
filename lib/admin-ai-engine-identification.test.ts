import { describe, expect, it } from "vitest";
import { emptyCsddFields, mergeSourceBlocksWithDefaults } from "@/lib/admin-source-blocks";
import { emptyOutvinDealerReport } from "@/lib/outvin-dealer-types";
import { identifyEngineGearboxPlatform } from "@/lib/admin-ai-engine-identification";

function blocksWith(over: {
  makeModel: string;
  year: string;
  kw: string;
  cm3?: string;
  fuel?: string;
  engineCode?: string;
  developmentCode?: string;
  transmission?: string;
}) {
  return mergeSourceBlocksWithDefaults({
    csdd: {
      ...emptyCsddFields(),
      makeModel: over.makeModel,
      firstRegistration: over.year,
      enginePowerKw: over.kw,
      engineDisplacementCm3: over.cm3 ?? "1995",
      fuelType: over.fuel ?? "Dīzeļdegviela",
    },
    auto_records: {
      outvinReport: {
        ...emptyOutvinDealerReport(),
        vehicleInfo: {
          ...emptyOutvinDealerReport().vehicleInfo,
          engineCode: over.engineCode ?? "",
          developmentCode: over.developmentCode ?? "",
          transmission: over.transmission ?? "",
        },
      },
    },
  });
}

describe("identifyEngineGearboxPlatform", () => {
  it("uses a dealer/Outvin engine code as confidence A", () => {
    const id = identifyEngineGearboxPlatform({
      sourceBlocks: blocksWith({
        makeModel: "BMW X1 xDrive20d",
        year: "2013-05-01",
        kw: "135",
        engineCode: "N47D20",
        developmentCode: "E84",
        transmission: "GA8HP45Z",
      }),
    });
    expect(id.engine.value).toBe("N47D20");
    expect(id.engine.confidence).toBe("A");
    expect(id.platform.value).toBe("E84");
    expect(id.platform.confidence).toBe("A");
    expect(id.gearbox.value).toBe("GA8HP45Z");
    expect(id.gearbox.confidence).toBe("A");
  });

  it("resolves BMW X1 xDrive20d 135 kW E84 to N47D20 (B)", () => {
    const id = identifyEngineGearboxPlatform({
      sourceBlocks: blocksWith({
        makeModel: "BMW X1 xDrive20d",
        year: "2014-03-12",
        kw: "135",
      }),
    });
    expect(id.engine.value).toBe("N47D20");
    expect(id.engine.confidence).toBe("B");
    expect(id.platform.value).toBe("E84");
  });

  it("resolves BMW X1 xDrive20d 135 kW F48 to B47D20 (B)", () => {
    const id = identifyEngineGearboxPlatform({
      sourceBlocks: blocksWith({
        makeModel: "BMW X1 xDrive20d",
        year: "2017-06-01",
        kw: "135",
      }),
    });
    expect(id.engine.value).toBe("B47D20");
    expect(id.engine.confidence).toBe("B");
    expect(id.platform.value).toBe("F48");
  });

  it("keeps 2015 X1 135 kW as C with both candidates", () => {
    const id = identifyEngineGearboxPlatform({
      sourceBlocks: blocksWith({
        makeModel: "BMW X1 xDrive20d",
        year: "2015-08-20",
        kw: "135",
      }),
    });
    expect(id.engine.confidence).toBe("C");
    expect(id.engine.candidates).toEqual(["N47D20", "B47D20"]);
    expect(id.platform.candidates).toEqual(["E84", "F48"]);
  });
});
