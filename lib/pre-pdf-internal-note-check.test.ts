import { describe, expect, it } from "vitest";
import { emptyCsddFields } from "@/lib/admin-source-blocks";
import { mergeSourceBlocksWithDefaults } from "@/lib/admin-source-blocks";
import { collectPrePdfClientTextFields, openErrorFactCheckFlags } from "@/lib/admin-fact-check-client";
import { checkPrePdfContradictions } from "@/lib/pre-pdf-contradiction-check";
import { checkInternalNoteLeaks, findInternalNoteHits } from "@/lib/pre-pdf-internal-note-check";

describe("findInternalNoteHits (C10)", () => {
  it.each([
    ["Ignorēt šo avotu, dati dublējas.", "ignore_instruction"],
    ["Servisa vēsture (ignorēt) ir nepilnīga.", "ignore_instruction"],
    ["Avots: IGNORĒT", "ignore_caps"],
    ["Lorem ipsum dolor sit amet", "lorem_ipsum"],
    ["carVertical nav pirkts.", "nav_pirkts"],
    ["Pilnā vēsture ir aiz maksas.", "aiz_maksas"],
    ["TODO pārbaudīt nobraukumu", "todo"],
    ["Īpašnieku skaits XXX", "todo"],
    ["Cena TBD", "todo"],
    ["fixme: datums", "fixme"],
    ["Nobraukums 2019. gadā ???", "question_marks"],
    ["Šo rindu nedrukāt.", "nedrukat"],
    ["Piezīme sev: piezvanīt dīlerim", "piezime_sev"],
    ["Demonstrācijas dati", "demo_data"],
    ["Esmu pabeidzis pārbaudi un secinu, ka...", "ai_first_person"],
    ["Esmu rūpīgi izvērtējis visus avotus.", "ai_first_person"],
    ["Esmu izskatījis CSDD datus.", "ai_first_person"],
    ["Sveiki,\nautomašīnai ir 2 īpašnieki.", "ai_greeting"],
    ["Labdien! Dati ir pilnīgi.", "ai_greeting"],
    ["Pirmā rinda.\nSveiks, šeit ir kopsavilkums.", "ai_greeting"],
  ])("flags %j as %s", (text, id) => {
    expect(findInternalNoteHits(text).map((h) => h.patternId)).toContain(id);
  });

  it.each([
    "Dzinēja vadības blokā ir ignorēts kļūdas kods P0420, kas jāpārbauda.",
    "Šo brīdinājumu nevajadzētu ignorēt.",
    "VIN WVWZZZ1KZXXX12345 atbilst CSDD datiem.",
    "Numurzīme AB-XXX paslēpta sludinājumā.",
    "Vai pirms pirkuma ir veikta diagnostika?",
    "Automašīna ir pirkta 2019. gadā Vācijā.",
    "Klients sveicināja dīleri, labdien teica pārdevējs.",
    "Pārbaudīts arī apdrošināšanas (OCTA) reģistrs.",
    "Ipsumbergas iela nav šeit, lorems arī ne.",
  ])("does not flag legit client text: %s", (text) => {
    expect(findInternalNoteHits(text)).toEqual([]);
  });

  it("flag names the field and quotes the hit", () => {
    const flags = checkInternalNoteLeaks([{ label: "AutoDNA", text: "Bojājumu nav.\ncarVertical nav pirkts, ignorēt." }]);
    expect(flags).toHaveLength(1);
    expect(flags[0]).toMatchObject({ id: "c10_internal_note", level: "E", kind: "leak_phrase" });
    expect(flags[0].message).toContain("„AutoDNA”");
    expect(flags[0].message).toContain("nav pirkts");
    expect(flags[0].message).not.toMatch(/[\u2014\u2013]/);
  });
});

describe("checkPrePdfContradictions C10", () => {
  it("raises an open error flag for every printed field with internal notes", () => {
    const sourceBlocks = mergeSourceBlocksWithDefaults({});
    sourceBlocks.autodna.comments = "<p>Bojājumi nav fiksēti.</p><p>TODO pārbaudīt</p>";
    sourceBlocks.citi_avoti.sections[0] = {
      ...sourceBlocks.citi_avoti.sections[0],
      label: "Dīleris (nedrukāt)",
      comments: "<p>Servisa ieraksti sakrīt.</p>",
    };
    const clientTextFields = collectPrePdfClientTextFields({
      tehniskoRiskuAnalize: "<p>Sveiki,</p><p>Esmu pabeidzis analīzi.</p>",
      iriss: "",
      apskatesPlāns: "",
      mileageComment: "Nobraukums 2019 ???",
      incidentsComment: "Lorem ipsum",
      sourcesComparisonComment: "",
      sourceBlocks,
    });
    const flags = checkPrePdfContradictions({ summaryInput: { csddForm: emptyCsddFields() }, clientTextFields });
    const c10 = openErrorFactCheckFlags(flags, []).filter((f) => f.id === "c10_internal_note");
    const text = c10.map((f) => f.message).join("\n");
    expect(text).toMatch(/TODO/);
    expect(text).toMatch(/nedrukāt/);
    expect(text).toMatch(/Sveiki/);
    expect(text).toMatch(/Esmu pabeidzis/);
    expect(text).toMatch(/\?\?\?/);
    expect(text).toMatch(/Lorem/);
  });

  it("clean fields produce no C10 flag", () => {
    const flags = checkPrePdfContradictions({
      summaryInput: { csddForm: emptyCsddFields() },
      clientTextFields: [{ label: "Kopsavilkums", text: "Automašīnai ir 2 īpašnieki, bojājumi nav fiksēti." }],
    });
    expect(flags.some((f) => f.id === "c10_internal_note")).toBe(false);
  });
});
