import { describe, expect, it } from "vitest";
import {
  findBannedVocabularyHits,
  findForbiddenPersonaNounHits,
  stripForbiddenPersonaNouns,
  textHasForbiddenPersonaNoun,
} from "@/lib/provin-banned-vocabulary";

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
