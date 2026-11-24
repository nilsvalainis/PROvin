import { describe, expect, it } from "vitest";

import { createDefaultSourceBlocks, emptyCsddFields, mergeSourceBlocksWithDefaults } from "@/lib/admin-source-blocks";
import { emptyOutvinDealerReport } from "@/lib/outvin-dealer-types";
import {
  commentContradictsPowertrain,
  commentsNeedPowertrainRegenerate,
  engineCodeMatchesLoaded,
  extractLoadedPowertrainIdentity,
  stampGeneratedAgainstOnBlocks,
  findPowertrainContradictions,
  generatedAgainstIsStale,
  parseGeneratedAgainstPowertrain,
  toGeneratedAgainst,
  type LoadedPowertrainIdentity,
} from "@/lib/comment-powertrain-guard";

const VIVARO_CODE = "(10 DY3M 4074562) DIESEL DW10FE FAP 90KW";

function identity(engineCode: string, fuelKind: LoadedPowertrainIdentity["fuelKind"] = "diesel"): LoadedPowertrainIdentity {
  return { engineCode, fuelKind, fuelRaw: fuelKind === "diesel" ? "Diesel" : "Petrol", source: "dealer" };
}

function engineHits(text: string, code: string, fuel: LoadedPowertrainIdentity["fuelKind"] = "diesel") {
  return findPowertrainContradictions(text, identity(code, fuel)).filter((h) => h.id === "powertrain_engine");
}

describe("dzinēja koda pārbaude - viltus kļūdas (24.11, Opel Vivaro)", () => {
  it("DW10FE tekstā sakrīt ar garo ielādēto vērtību", () => {
    const text =
      "(DW10FE) Intervālu dinamika: dzinēja eļļa mainīta 4 reizes. Dzinējs DW10FE ar FAP filtru prasa regulāru apkopi.";
    expect(engineHits(text, VIVARO_CODE)).toEqual([]);
  });

  it("saimes prefikss (DW10 pret DW10FE) nav kļūda", () => {
    expect(engineHits("Dzinēja saime DW10 ir izplatīta.", VIVARO_CODE)).toEqual([]);
  });

  it("cits kods joprojām ir kļūda", () => {
    const hits = engineHits("Dzinējs DW12RU prasa uzmanību.", VIVARO_CODE);
    expect(hits).toHaveLength(1);
    expect(hits[0]!.message).toContain("DW12RU");
  });

  it("DW10FD pret DW10FE ir kļūda (cits variants)", () => {
    expect(engineHits("Dzinējs DW10FD.", "DW10FE")).toHaveLength(1);
  });

  it("OM651.913 pret ielādēto «OM 651 913»", () => {
    expect(engineHits("Dzinējs OM651.913 ir uzticams.", "OM 651 913")).toEqual([]);
    expect(engineCodeMatchesLoaded("OM651.913", "OM651913")).toBe(true);
  });

  it("jauda ar/bez atstarpes (90kW, 90 kW, 122 ZS, 120 PS, 120hp) nav dzinēja kods", () => {
    for (const text of [
      "Dzinējs 90kW jaudas.",
      "Dzinējs 90 kW jaudas.",
      "Dzinēja jauda 122 ZS.",
      "Dzinējs 120 PS.",
      "Dzinējs 120hp.",
      "Dzinējs KW90 / PS122 / ZS122 / HP120.",
    ]) {
      expect(engineHits(text, VIVARO_CODE), text).toEqual([]);
    }
  });

  it("tilpums 1997 cm³ pret 2,0 l nav dzinēja kods", () => {
    for (const text of ["Dzinēja tilpums 1997 cm³.", "Dzinējs 2,0 l.", "Dzinējs 1997cm3.", "Dzinējs CM1997."]) {
      expect(engineHits(text, VIVARO_CODE), text).toEqual([]);
    }
  });

  it("piedziņas nosaukumi (4MATIC, xDrive30d, sDrive18d, quattro) nav dzinēja kodi", () => {
    for (const text of [
      "Dzinējs ar 4MATIC piedziņu.",
      "Dzinējs xDrive30d versijā.",
      "Motors sDrive18d.",
      "Dzinējs ar quattro.",
    ]) {
      expect(engineHits(text, "B47D20", "diesel"), text).toEqual([]);
    }
  });

  it("emisiju klase un kārbu kodi (EURO6, JF015E, MT82, AF40) nav dzinēja kodi", () => {
    for (const text of [
      "Dzinējs atbilst EURO62 normai.",
      "Dzinējs ar JF015E variatoru.",
      "Dzinējs ar MT82 kārbu.",
      "Dzinējs ar AF40 automātu.",
    ]) {
      expect(engineHits(text, VIVARO_CODE), text).toEqual([]);
    }
  });

  it("garais kods nerada mūžīgu «dati mainīti» paziņojumu (zīmogs 24 rakstzīmes)", () => {
    const current = identity(VIVARO_CODE);
    const stamp = parseGeneratedAgainstPowertrain(toGeneratedAgainst(current));
    expect(generatedAgainstIsStale(stamp, current)).toBe(false);
    expect(generatedAgainstIsStale(stamp, identity("DW12RU"))).toBe(true);
  });
});

describe("powertrain_contradiction (FLASH MAX / ✨ noraidīšana) - Opel Vivaro VXEVFAHKKM7805359", () => {
  const VIN = "VXEVFAHKKM7805359";
  function vivaroBlocks() {
    return mergeSourceBlocksWithDefaults({
      csdd: { ...emptyCsddFields(), makeModel: "Opel Vivaro", fuelType: "Dīzeļdegviela" },
      auto_records: {
        ...createDefaultSourceBlocks().auto_records,
        outvinReport: {
          ...emptyOutvinDealerReport(),
          vehicleInfo: { ...emptyOutvinDealerReport().vehicleInfo, engineCode: VIVARO_CODE, fuel: "Diesel" },
        },
      },
    });
  }

  it("ielādētā identitāte satur garo kodu, bet risku analīzes teksts ar DW10FE nav pretruna", () => {
    const blocks = vivaroBlocks();
    const id = extractLoadedPowertrainIdentity(blocks, { vin: VIN });
    expect(id.engineCode).toContain("DW10FE");
    const risks =
      "Dzinējs DW10FE (2,0 l dīzelis, 90 kW) ar FAP filtru: jāpārbauda DPF/FAP stāvoklis un AdBlue sistēma.";
    expect(commentContradictsPowertrain(risks, id)).toBe(false);
    expect(commentContradictsPowertrain("Dzinējs DW12RU ar FAP.", id)).toBe(true);
  });

  it("pēc ✨ zīmoga paziņojums «dati mainīti» nerādās", () => {
    const stamped = stampGeneratedAgainstOnBlocks(vivaroBlocks(), VIN, "technical_risks");
    expect(
      commentsNeedPowertrainRegenerate({
        sourceBlocks: stamped,
        comments: [{ field: "technical_risks", text: "Dzinējs DW10FE ar FAP filtru." }],
        vin: VIN,
      }),
    ).toBe(false);
  });
});
