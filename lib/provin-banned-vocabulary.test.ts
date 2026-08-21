import { describe, expect, it } from "vitest";
import {
  applyBannedVocabularyReplacements,
  findBannedVocabularyHits,
} from "@/lib/provin-banned-vocabulary";

describe("banned vocabulary hits", () => {
  it("flags vacuum metaphor and damper calque", () => {
    expect(findBannedVocabularyHits("Pirms importa ir datu vakuums.").map((e) => e.code)).toContain(
      "vocabulary_vakuums",
    );
    expect(findBannedVocabularyHits("Vakuums avotos.").map((e) => e.code)).toContain(
      "vocabulary_vakuums",
    );
    expect(
      findBannedVocabularyHits("Jāmaina vibrāciju slāpētājs.").map((e) => e.code),
    ).toContain("vocabulary_vibraciju_slapetajs");
  });

  it("does not flag vacuum pump or a correct pulley name", () => {
    expect(findBannedVocabularyHits("vakuumsūknis tecējums")).toEqual([]);
    expect(findBannedVocabularyHits("kloķvārpstas skriemelis (demferis)")).toEqual([]);
    expect(findBannedVocabularyHits("datu neesamība pirms importa")).toEqual([]);
  });
});

describe("applyBannedVocabularyReplacements", () => {
  it("rewrites metaphor and damper names without touching the pump", () => {
    expect(applyBannedVocabularyReplacements("datu vakuums un vakuumsūknis")).toBe(
      "datu neesamība un vakuumsūknis",
    );
    expect(applyBannedVocabularyReplacements("svārstību slāpētāja maiņa")).toBe(
      "kloķvārpstas skriemelis (demferis) maiņa",
    );
  });
});
