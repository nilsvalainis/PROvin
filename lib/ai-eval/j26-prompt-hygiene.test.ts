import { describe, expect, it } from "vitest";

import { unsourcedClaimIssues } from "@/lib/ai-eval/comment-quality";
import { golfBlocks, golfComment } from "@/lib/ai-eval/golf-gte-fixture";
import { buildOtherFieldVerdicts, isNegativeVerdict } from "@/lib/canonical-facts-sheet";
import { applyBannedVocabularyReplacements } from "@/lib/provin-banned-vocabulary";
import { AI_STYLE_CANON_SHARED } from "@/lib/provin-style-canon";

describe("j26 PR5 - teksta pārbaudes un promptu higiēna", () => {
  it("drošās aizstāšanas: oficāl -> oficiāl, protāl -> portāl, locījumi saglabājas", () => {
    expect(applyBannedVocabularyReplacements("oficālā dīlera datos")).toBe("oficiālā dīlera datos");
    expect(applyBannedVocabularyReplacements("Oficālās apkopes")).toBe("Oficiālās apkopes");
    expect(applyBannedVocabularyReplacements("oficiālā")).toBe("oficiālā");
    expect(applyBannedVocabularyReplacements("izsoļu protālu")).toBe("izsoļu portālu");
  });

  it("salīmēti latviski vārdi atdalīti; zīmolu nosaukumi netiek skarti", () => {
    expect(applyBannedVocabularyReplacements("izsoļu protāluZviedrijas reģistrā")).toBe("izsoļu portālu Zviedrijas reģistrā");
    expect(applyBannedVocabularyReplacements("datosSomijas reģistrā")).toBe("datos Somijas reģistrā");
    for (const brand of ["TwinPower", "BlueMotion", "carVertical", "xDrive", "eCall", "iPhone", "AutoDNA", "PureTech", "MultiAir", "eHybrid"]) {
      expect(applyBannedVocabularyReplacements(`${brand} sistēma`)).toBe(`${brand} sistēma`);
    }
  });

  it("garantija / Longlife bez avota -> karodziņš (bez atkārtojuma)", () => {
    expect(unsourcedClaimIssues("Akumulatora garantija ir 8 gadi vai 160 000 km.", "faktu lapa bez tā").map((i) => i.code)).toEqual([
      "unsourced_warranty",
    ]);
    expect(unsourcedClaimIssues("Akumulatora garantija ir 8 gadi.", "Dīleris: Warranty until 2025")).toEqual([]);
    expect(unsourcedClaimIssues("Ražotāja intervāls: 30 000 km / 24 mēn. (Longlife).", "dati").map((i) => i.code)).toEqual([
      "unsourced_oil_policy",
    ]);
    expect(unsourcedClaimIssues("Garantijas statuss jāpārbauda pie dīlera.", "")).toEqual([]);
  });

  it("citu lauku „nav …” teikumi netiek doti tālāk kā verdikti", () => {
    expect(isNegativeVerdict(golfComment("incidents-no-damage").text)).toBe(true);
    expect(isNegativeVerdict("Izsolē fiksēti bojājumi.")).toBe(false);
    const verdicts = buildOtherFieldVerdicts({
      sourceBlocks: golfBlocks(),
      internalComment: golfComment("incidents-no-damage").text,
      mileageComment: "Nobraukums pieaug vienmērīgi līdz 118 900 km.",
    });
    expect(verdicts).toMatch(/118 900 km/);
    expect(verdicts).not.toMatch(/nav fiksētu bojājumu/);
  });

  it("kopīgais stila kanons satur bezavota faktu noteikumu", () => {
    expect(AI_STYLE_CANON_SHARED).toMatch(/BEZ AVOTA NAV FAKTA/);
  });
});
