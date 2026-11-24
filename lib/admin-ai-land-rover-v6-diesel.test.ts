import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/admin-ai-historical-context", () => ({ buildHistoricalReportsAiContext: async () => "" }));
vi.mock("@/lib/admin-ai-aggregate-knowledge", () => ({ buildAggregateKnowledgeAiContext: async () => "" }));
vi.mock("@/lib/admin-ai-style-corpus", () => ({ buildStyleCorpusAiContext: () => "" }));

import {
  buildLandRoverV6DieselBrief,
  detectLandRoverV6Diesel,
  detectLandRoverV6DieselFromBlocks,
} from "@/lib/admin-ai-land-rover-v6-diesel";
import { mergeSourceBlocksWithDefaults } from "@/lib/admin-source-blocks";
import { extractVehicleReportFingerprint } from "@/lib/admin-vehicle-report-fingerprint";
import {
  formatAggregateCasePacksForAi,
  selectAggregateCasePacks,
} from "@/lib/provin-aggregate-case-rules";
import { buildAiCommentGenerationContext, buildAiOrderContextText } from "@/lib/admin-ai-order-context";

const D = "Dīzeļdegviela";

function lrBlocks(csdd: Record<string, string>, engineCode = "") {
  const blocks = mergeSourceBlocksWithDefaults({ csdd: csdd as never });
  if (engineCode) {
    blocks.auto_records = {
      ...blocks.auto_records,
      outvinReport: {
        ...(blocks.auto_records.outvinReport ?? ({} as never)),
        vehicleInfo: {
          ...(blocks.auto_records.outvinReport?.vehicleInfo ?? ({} as never)),
          engineCode,
        },
      } as never,
    };
  }
  return blocks;
}

describe("Land Rover V6 dīzelis - identifikācija (pozitīvi)", () => {
  it("306DT kods", () => {
    const m = detectLandRoverV6Diesel({ makeModel: "LAND ROVER DISCOVERY", engineCode: "306DT", fuel: D, displacementCm3: 2993, year: 2014 });
    expect(m?.variant).toBe("3.0");
    expect(m?.ladderFrame).toBe(true);
  });

  it("«3.0 TDV6» un «SDV6» apzīmējumi", () => {
    expect(detectLandRoverV6Diesel({ makeModel: "LAND ROVER RANGE ROVER SPORT 3.0 TDV6" })?.variant).toBe("3.0");
    expect(detectLandRoverV6Diesel({ makeModel: "RANGE ROVER", extraIdentityText: "SDV6 Vogue", fuel: D })?.variant).toBe("3.0");
  });

  it("bez koda: Discovery dīzelis 2993 cm³", () => {
    expect(detectLandRoverV6Diesel({ makeModel: "LAND ROVER DISCOVERY", fuel: D, displacementCm3: 2993, year: 2015 })?.variant).toBe("3.0");
  });

  it("Velar D300 V6 2018 (2993 cm³) - Lion, nesošā virsbūve", () => {
    const m = detectLandRoverV6Diesel({ makeModel: "LAND ROVER RANGE ROVER VELAR D300", fuel: D, displacementCm3: 2993, year: 2018 });
    expect(m?.variant).toBe("3.0");
    expect(m?.ladderFrame).toBe(false);
  });

  it("2.7 TDV6 (276DT) - Discovery 3", () => {
    expect(detectLandRoverV6Diesel({ makeModel: "LAND ROVER DISCOVERY 3", fuel: D, displacementCm3: 2720, year: 2007 })?.variant).toBe("2.7");
    expect(detectLandRoverV6Diesel({ makeModel: "LAND ROVER", engineCode: "276DT" })?.variant).toBe("2.7");
  });

  it("Jaguar ar to pašu 306DT (XF 3.0d V6)", () => {
    const m = detectLandRoverV6Diesel({ makeModel: "JAGUAR XF", fuel: D, displacementCm3: 2993, year: 2015 });
    expect(m?.brand).toBe("Jaguar");
    expect(m?.variant).toBe("3.0");
  });
});

describe("Land Rover V6 dīzelis - identifikācija (negatīvi)", () => {
  it("3.0 I6 Ingenium D300 MHEV (2997 cm³, 2022)", () => {
    expect(detectLandRoverV6Diesel({ makeModel: "LAND ROVER RANGE ROVER SPORT D300", fuel: D, displacementCm3: 2997, year: 2022 })).toBeNull();
    expect(detectLandRoverV6Diesel({ makeModel: "LAND ROVER DEFENDER", extraIdentityText: "D300 MHEV", fuel: D, displacementCm3: 2997, year: 2021 })).toBeNull();
    expect(detectLandRoverV6Diesel({ makeModel: "LAND ROVER RANGE ROVER", engineCode: "DT306", fuel: D, year: 2022 })).toBeNull();
    expect(detectLandRoverV6Diesel({ makeModel: "LAND ROVER RANGE ROVER", extraIdentityText: "Ingenium", fuel: D, displacementCm3: 2993, year: 2020 })).toBeNull();
  });

  it("D300 bez tilpuma un koda netrāpa", () => {
    expect(detectLandRoverV6Diesel({ makeModel: "LAND ROVER RANGE ROVER VELAR D300", fuel: D, year: 2022 })).toBeNull();
  });

  it("2.0 Ingenium, 2.2 SD4, 4.4 SDV8", () => {
    expect(detectLandRoverV6Diesel({ makeModel: "LAND ROVER DISCOVERY SPORT", engineCode: "204DTD", fuel: D, displacementCm3: 1999, year: 2019 })).toBeNull();
    expect(detectLandRoverV6Diesel({ makeModel: "LAND ROVER RANGE ROVER EVOQUE SD4", fuel: D, displacementCm3: 2179, year: 2014 })).toBeNull();
    expect(detectLandRoverV6Diesel({ makeModel: "LAND ROVER RANGE ROVER 4.4 SDV8", fuel: D, displacementCm3: 4367, year: 2015 })).toBeNull();
    expect(detectLandRoverV6Diesel({ makeModel: "LAND ROVER RANGE ROVER", engineCode: "448DT", fuel: D, displacementCm3: 4367 })).toBeNull();
  });

  it("benzīna 3.0 V6 S/C", () => {
    expect(detectLandRoverV6Diesel({ makeModel: "LAND ROVER RANGE ROVER SPORT", fuel: "Benzīns", displacementCm3: 2995, year: 2016 })).toBeNull();
    expect(detectLandRoverV6Diesel({ makeModel: "JAGUAR F-PACE", engineCode: "306PS", fuel: "Benzīns", displacementCm3: 2995, year: 2017 })).toBeNull();
  });

  it("cita marka ar 3.0 dīzeli (BMW 530d, Audi 3.0 TDI)", () => {
    expect(detectLandRoverV6Diesel({ makeModel: "BMW 530D", fuel: D, displacementCm3: 2993, year: 2014 })).toBeNull();
    expect(detectLandRoverV6Diesel({ makeModel: "AUDI A6", fuel: D, displacementCm3: 2967, year: 2014 })).toBeNull();
  });
});

describe("Land Rover V6 dīzelis - likums nonāk ✨ kontekstā", () => {
  const discovery = () =>
    lrBlocks(
      {
        makeModel: "LAND ROVER DISCOVERY",
        fuelType: D,
        firstRegistration: "15.05.2014",
        engineDisplacementCm3: "2993",
        enginePowerKw: "190",
      },
      "306DT",
    );

  it("brīfs ar PROVIN viedokli, tipiskajām kaitēm un bez EUR", () => {
    const brief = buildLandRoverV6DieselBrief(discovery(), { vin: null });
    expect(detectLandRoverV6DieselFromBlocks(discovery())?.variant).toBe("3.0");
    expect(brief).toMatch(/mūsu vērtējumā šis dzinējs ir riskants/i);
    expect(brief).toMatch(/kloķvārpstas lūzums/);
    expect(brief).toMatch(/eļļas sūkņa/);
    expect(brief).toMatch(/turbokompresori/);
    expect(brief).toMatch(/EGR/);
    expect(brief).toMatch(/DPF/);
    expect(brief).toMatch(/zobsiksn/);
    expect(brief).toMatch(/dzinēja maiņa/);
    expect(brief).toMatch(/kopsavilkumā/);
    expect(brief).toMatch(/virsbūves nocelšanu no rāmja/);
    expect(brief).not.toMatch(/\d\s*€|EUR\s*\d|\d\s*EUR/);
    expect(brief).not.toMatch(/eksperts|kritisk|anomālij/i);
  });

  it("Ingenium D300 brīfu nedod", () => {
    const blocks = lrBlocks({
      makeModel: "LAND ROVER RANGE ROVER SPORT",
      fuelType: D,
      firstRegistration: "01.03.2022",
      engineDisplacementCm3: "2997",
    });
    expect(buildLandRoverV6DieselBrief(blocks)).toBe("");
  });

  it("statiskā agregātu paka tiek izvēlēta pirmā un satur nostāju", () => {
    const fp = extractVehicleReportFingerprint(discovery(), { vin: null });
    const packs = selectAggregateCasePacks(fp, { maxPacks: 3 });
    expect(packs[0]?.id).toBe("land_rover_v6_diesel_lion");
    expect(formatAggregateCasePacksForAi(packs)).toMatch(/PROVIN NOSTĀJA[\s\S]*riskants dzinējs/);
  });

  it("paka netrāpa BMW un Ingenium", () => {
    const bmw = extractVehicleReportFingerprint(
      mergeSourceBlocksWithDefaults({ csdd: { makeModel: "BMW 530d", fuelType: D, engineDisplacementCm3: "2993", firstRegistration: "01.01.2014" } as never }),
      { vin: null },
    );
    expect(selectAggregateCasePacks(bmw).some((p) => p.id === "land_rover_v6_diesel_lion")).toBe(false);
    const ing = extractVehicleReportFingerprint(
      mergeSourceBlocksWithDefaults({ csdd: { makeModel: "LAND ROVER DEFENDER", fuelType: D, engineDisplacementCm3: "2997", firstRegistration: "01.01.2022" } as never }),
      { vin: null },
    );
    expect(selectAggregateCasePacks(ing).some((p) => p.id === "land_rover_v6_diesel_lion")).toBe(false);
  });

  it("brīfs ir pasūtījuma kontekstā un kopsavilkuma ✨ kontekstā", async () => {
    const input = { sessionId: "cs_test", vin: null, sourceBlocks: discovery() } as never;
    expect(buildAiOrderContextText(input)).toMatch(/Land Rover V6 dīzelis - PROVIN nostāja/);
    const summaryCtx = await buildAiCommentGenerationContext(input, "summary");
    expect(summaryCtx).toMatch(/Land Rover V6 dīzelis - PROVIN nostāja/);
    expect(summaryCtx).toMatch(/OBLIGĀTI kopsavilkumā/);
  });
});
