import { describe, expect, it } from "vitest";
import {
  applyBannedVocabularyReplacements,
  findBannedVocabularyHits,
  findForbiddenPersonaNounHits,
  findInternalClientTermHits,
  stripForbiddenPersonaNouns,
  textHasForbiddenPersonaNoun,
} from "@/lib/provin-banned-vocabulary";

describe("safe vocabulary replacements without retry", () => {
  it("fixes šim automašīnai and tipiski šim agregātam deterministically", () => {
    expect(applyBannedVocabularyReplacements("šim automašīnai raksturīga ķēde")).toMatch(
      /šai automašīnai/,
    );
    expect(applyBannedVocabularyReplacements("tipiski šim agregātam ir eļļas noplūde")).toMatch(
      /šim dzinējam raksturīga/,
    );
  });
});

describe("internal client terms and damper wording", () => {
  it("flags Riska kartē and Dzinēja identifikācija", () => {
    expect(findInternalClientTermHits("Riska kartē ķēde ir iekšā.").some((h) => h.code === "internal_riska_karte")).toBe(
      true,
    );
    expect(
      findInternalClientTermHits("Dzinēja identifikācija paliek iekšēja.").some(
        (h) => h.code === "internal_dzineja_identifikacija",
      ),
    ).toBe(true);
    expect(findBannedVocabularyHits("kloķvārpstas skriemelis (demferis)")).toEqual([]);
    expect(findInternalClientTermHits("Dzinēja kods noteikts pēc jaudas un tilpuma.").some((h) => h.code === "internal_engine_code_guess")).toBe(
      true,
    );
    expect(findInternalClientTermHits("Piedziņa HECK.").some((h) => h.code === "internal_heck")).toBe(true);
    expect(findInternalClientTermHits("AGR-Kühler noplūst.").some((h) => h.code === "internal_agr_kuhler")).toBe(true);
  });
});

describe("forbidden persona nouns", () => {
  it("flags Latvian e-word family and ekspertīze", () => {
    expect(findBannedVocabularyHits("Raksta kā pieredzējis tehniskais eksperts.").some((h) => h.code === "vocabulary_eksperts")).toBe(
      true,
    );
    expect(findBannedVocabularyHits("Foto un apraksta ekspertīze.").some((h) => h.code === "vocabulary_eksperts")).toBe(
      true,
    );
    expect(textHasForbiddenPersonaNoun("eksperta komentārs klientam")).toBe(true);
  });

  it("flags EN/RU/DE and speciālists in generated copy", () => {
    expect(findForbiddenPersonaNounHits("This is an expert opinion.").some((h) => h.code === "vocabulary_expert_en")).toBe(
      true,
    );
    expect(findForbiddenPersonaNounHits("заключение эксперта").some((h) => h.code === "vocabulary_expert_ru")).toBe(
      true,
    );
    expect(findForbiddenPersonaNounHits("laut Experte").some((h) => h.code === "vocabulary_expert_de")).toBe(true);
    expect(findForbiddenPersonaNounHits("auto speciālists klātienē").some((h) => h.code === "vocabulary_specialists")).toBe(
      true,
    );
  });

  it("replaces or drops persona nouns in AI output", () => {
    expect(stripForbiddenPersonaNouns("Raksti kā pieredzējis tehniskais eksperts šo motoru.")).toBe(
      "Raksti kā pieredzējis tehniskā analīze šo motoru.",
    );
    expect(stripForbiddenPersonaNouns("Esošie eksperta komentāri avotu sadaļās.")).toBe(
      "Esošie komentāri avotu sadaļās.",
    );
    expect(stripForbiddenPersonaNouns("Foto un apraksta ekspertīze.")).toBe("Foto un apraksta izvērtējums.");
    expect(stripForbiddenPersonaNouns("senior expert opinion")).toBe("senior opinion");
    expect(stripForbiddenPersonaNouns("CSDD datos automašīna reģistrēta 2016. gadā.")).toBe(
      "CSDD datos automašīna reģistrēta 2016. gadā.",
    );
  });
});
