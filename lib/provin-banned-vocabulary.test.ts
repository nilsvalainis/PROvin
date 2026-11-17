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

describe("glosārija aizvietošana ar latviešu burtiem (ņ, ā, ē)", () => {
  it("reālais gadījums: nav „ieplūdes kolektora ieplūdes kolektorsņi (ieplūdes kolektors)”", () => {
    const out = applyBannedVocabularyReplacements("Ieplūdes kolektora virpuļvārstiņi (swirl flaps) ir bojāti.");
    expect(out).toBe("Ieplūdes kolektora vārstiņi ir bojāti.");
    expect(out).not.toMatch(/kolektorsņ|ieplūdes kolektora ieplūdes|virpuļ|swirl/i);
  });

  it("atsevišķs virpuļvārsts / swirl flaps -> ieplūdes kolektora vārsts, galotne saglabājas", () => {
    expect(applyBannedVocabularyReplacements("Virpuļvārsti bieži iesprūst.")).toBe(
      "Ieplūdes kolektora vārsti bieži iesprūst.",
    );
    expect(applyBannedVocabularyReplacements("virpuļvārstu (swirl flap) remonts")).toBe(
      "ieplūdes kolektora vārstu remonts",
    );
    expect(applyBannedVocabularyReplacements("Swirl flaps ir zināma kaite.")).toBe(
      "Ieplūdes kolektora vārsti ir zināma kaite.",
    );
  });

  it("injektor- un integritāt- visos locījumos bez pārpalikušas galotnes", () => {
    expect(applyBannedVocabularyReplacements("Pārbaudiet injektorus un injektorā redzamo.")).toBe(
      "Pārbaudiet iesmidzinātājus un iesmidzinātājā redzamo.",
    );
    expect(applyBannedVocabularyReplacements("Injektori ir oriģināli.")).toBe("Iesmidzinātāji ir oriģināli.");
    expect(applyBannedVocabularyReplacements("Integritātē nav šaubu.")).toBe("Stāvoklis nav šaubu.");
  });

  it("persona vārdi ar „ā” galotni pazūd pilnībā", () => {
    expect(stripForbiddenPersonaNouns("Kā minēts ekspertā atzinumā.")).not.toMatch(/ekspert|\sā\s/);
    expect(stripForbiddenPersonaNouns("мнение эксперта важно")).toBe("мнение важно");
  });

  it("detektē kontūrā / buferā / pakā arī pirms pieturzīmes", () => {
    const codes = (t: string) => [...findBannedVocabularyHits(t), ...findInternalClientTermHits(t)].map((h) => h.code);
    expect(codes("Bojājums kontūrā.")).toContain("vocabulary_kontura");
    expect(codes("Skrāpējums buferā.")).toContain("vocabulary_bufers");
    expect(codes("Viss ir pakā.")).toContain("internal_paka");
    expect(codes("Tas ir labvēlīgā signālā.")).toContain("vocabulary_labveligs_signals");
  });
});
