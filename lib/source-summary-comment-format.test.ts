import { describe, expect, it } from "vitest";
import {
  applyProvinReportCopyVocabulary,
  dropTechnicalRisksSectionTitle,
  finalizeProvinExpertAiComment,
  normalizeExpertSourcePdfComment,
  normalizeProvinExpertAiComment,
  replaceCrankshaftDamperWording,
  splitDealerCommentRoleHeadings,
  stripInternalClientLeaks,
  stripLeakedAiPlanningPreamble,
  toExpertHeadingBodyPlain,
} from "@/lib/source-summary-comment-format";

describe("applyProvinReportCopyVocabulary", () => {
  it("replaces automobīlis forms with automašīna", () => {
    expect(applyProvinReportCopyVocabulary("Šis automobīlis ir labs.")).toBe("Šis automašīna ir labs.");
    expect(applyProvinReportCopyVocabulary("Automobīļa vēsture.")).toBe("Automašīnas vēsture.");
    expect(applyProvinReportCopyVocabulary("Automobiļa pārbaudes papildu apjoms")).toBe(
      "Automašīnas pārbaudes papildu apjoms",
    );
  });

  it("replaces em and en dashes with ASCII hyphen", () => {
    expect(applyProvinReportCopyVocabulary("Labs auto — kopts.")).toBe("Labs auto - kopts.");
    expect(applyProvinReportCopyVocabulary("2007–2015, 300–400 €")).toBe("2007-2015, 300-400 €");
    expect(applyProvinReportCopyVocabulary("1500–3000")).toBe("1500-3000");
    expect(applyProvinReportCopyVocabulary("mums—labprāt")).toBe("mums - labprāt");
  });

  it("rewrites pie X km and Statuss paid/unpaid", () => {
    expect(applyProvinReportCopyVocabulary("Darbs pie 120000 km.")).toBe("Darbs ar nobraukumu 120000 km.");
    expect(applyProvinReportCopyVocabulary("pie šī nobraukuma bieži")).toBe("ar šo nobraukumu bieži");
    expect(applyProvinReportCopyVocabulary("Statuss paid")).toBe("Statuss: apmaksāts");
    expect(applyProvinReportCopyVocabulary("Statuss unpaid")).toBe("Statuss: nav apmaksāts");
  });

  it("replaces kancelejisku labvēlīgs-signāls wording", () => {
    expect(applyProvinReportCopyVocabulary("Salons ir kopts, tas ir labvēlīgs signāls.")).toBe(
      "Salons ir kopts, tas ir labs rādījums datos.",
    );
    expect(applyProvinReportCopyVocabulary("labvēlīgs faktors")).toBe("tas palīdz");
  });

  it("simplifies AI template cost framing and documentary wording", () => {
    expect(applyProvinReportCopyVocabulary("jālūdz dokumentāri pierādījumi")).toBe(
      "jālūdz dokumenti",
    );
    expect(applyProvinReportCopyVocabulary("tas ir tuvākā laika ieguldījums")).toBe(
      "tas ir aktuālais mezgls",
    );
    expect(applyProvinReportCopyVocabulary("uzrāda divējādu ainu")).toBe(
      "datos redzama šāda aina",
    );
  });

  it("replaces vacuum-metaphor and crankshaft damper wording, keeps vakuumsūknis", () => {
    expect(applyProvinReportCopyVocabulary("datos ir vakuums")).toBe("datos ir trūkums");
    expect(applyProvinReportCopyVocabulary("datu vakuums pēdējos gados")).toBe(
      "datu neesamība pēdējos gados",
    );
    expect(applyProvinReportCopyVocabulary("vakuumsūknis ir mainīts")).toBe("vakuumsūknis ir mainīts");
    expect(applyProvinReportCopyVocabulary("kloķvārpstas svārstību slāpētājs (skriemelis)")).toBe(
      "kloķvārpstas skriemelis (demferis)",
    );
    expect(applyProvinReportCopyVocabulary("kloķvārpstas skriemelis (demferis)")).toBe(
      "kloķvārpstas skriemelis (demferis)",
    );
    expect(replaceCrankshaftDamperWording("kloķvārpstas svārstību slāpētājs (demferis)")).toBe(
      "kloķvārpstas skriemelis (demferis)",
    );
    expect(replaceCrankshaftDamperWording("kloķvārpstas skriemelis (demferis)")).toBe(
      "kloķvārpstas skriemelis (demferis)",
    );
    expect(applyProvinReportCopyVocabulary("Riska kartē ķēde ir iekšā.")).toBe("Datos ķēde ir iekšā.");
    expect(applyProvinReportCopyVocabulary("Dzinēja identifikācija paliek iekšēja.")).toBe(
      "Dzinēja kods paliek iekšēja.",
    );
    expect(applyProvinReportCopyVocabulary("Foto un apraksta ekspertīze.")).toBe(
      "Foto un apraksta izvērtējums.",
    );
    expect(applyProvinReportCopyVocabulary("Esošie eksperta komentāri paliek.")).toBe(
      "Esošie komentāri paliek.",
    );
    expect(applyProvinReportCopyVocabulary("a senior expert opinion")).not.toMatch(/\bexperts?\b/i);
  });
});

describe("normalizeProvinExpertAiComment", () => {
  it("converts markdown bold hooks to heading-on-own-line and strips leftover asterisks", () => {
    const raw = `- **Nobraukums.** Automašīna ar **120 000 km**.\n\n- Otrā rindkopa bez treknraksta.`;
    const out = normalizeProvinExpertAiComment(raw);
    expect(out).toContain("Nobraukums\nAutomašīna ar 120 000 km.");
    expect(out).not.toMatch(/\*/);
    expect(out).not.toMatch(/^-\s/m);
    expect(out).not.toMatch(/\n\n-\s/);
  });

  it("strips Gemini leftover ** prefixes", () => {
    const out = normalizeProvinExpertAiComment(
      "** Šī automašīna ir koptāka.\n\n** Tuvākais rēķins ir piekare.",
    );
    expect(out).not.toMatch(/\*/);
    expect(out).toContain("Šī automašīna ir koptāka.");
    expect(out).toContain("Tuvākais rēķins ir piekare.");
  });

  it("replaces automobīlis inside normalized paragraphs", () => {
    const out = normalizeProvinExpertAiComment("**Tests.** Šis automobīlis ir ok — 2007–2015.");
    expect(out).toContain("automašīna");
    expect(out).not.toContain("automobīlis");
    expect(out).not.toMatch(/[\u2013\u2014]/);
    expect(out).toContain("ok - 2007-2015");
    expect(out).not.toMatch(/\*/);
  });

  it("keeps more than 8 paragraphs for expert comments", () => {
    const paras = Array.from({ length: 12 }, (_, i) => `**Sadaļa ${i + 1}.** Teksts par punktu ${i + 1}.`);
    const out = normalizeProvinExpertAiComment(paras.join("\n\n"));
    expect(out.split(/\n\n+/).length).toBe(12);
  });

  it("keeps a year at the start of a paragraph and does not turn it into a heading", () => {
    const out = normalizeProvinExpertAiComment(
      "2019. gada augustā Berlīnē fiksēts nobraukums 189 858 km. Tas saskan ar dīlera datiem.",
    );
    expect(out).toContain("2019. gada augustā");
    expect(out).not.toMatch(/^2019\n/);
    expect(out).not.toMatch(/^gada augustā/);
  });

  it("keeps a day-month opener like 13. novembrī", () => {
    const out = normalizeProvinExpertAiComment(
      "13. novembrī 2012. gadā dīleris fiksē atslēgas nolasījumu. Nākamais ieraksts ir 2015. gadā.",
    );
    expect(out).toContain("13. novembrī 2012. gadā");
    expect(out).not.toMatch(/^13\n/);
    expect(out).not.toMatch(/^novembrī/);
  });

  it("still turns a title sentence plus body into heading-then-paragraph", () => {
    const out = normalizeProvinExpertAiComment(
      "Virsbūves pārbaude ar krāsas mērītāju. Jāmēra šuves un paneļu simetrija.",
    );
    expect(out).toBe(
      "Virsbūves pārbaude ar krāsas mērītāju\nJāmēra šuves un paneļu simetrija.",
    );
  });

  it("does not clip a long expert comment", () => {
    const long = Array.from({ length: 20 }, (_, i) => `**P${i}.** ${"vārds ".repeat(80)}`).join("\n\n");
    const out = normalizeProvinExpertAiComment(long);
    expect(out).not.toMatch(/…$/);
    expect(out.split(/\n\n+/).length).toBe(20);
    expect(out).toContain("P0\n");
    expect(out).toContain("P19\n");
    expect(out).not.toMatch(/\*/);
  });
});

describe("normalizeExpertSourcePdfComment", () => {
  it("caps PDF extract comments at 8 paragraphs", () => {
    const paras = Array.from({ length: 12 }, (_, i) => `Rindkopa ${i + 1}.`);
    const out = normalizeExpertSourcePdfComment(paras.join("\n\n"));
    expect(out.split(/\n\n+/).length).toBe(8);
  });
});

const MASHED_DEALER_COMMENT =
  "Agregātu un aprīkojuma identifikācija Pēc VIN koda identificēts Mercedes-Benz C-klases (W204) modelis ar dīzeļdzinēju un automātisko pārnesumkārbu. Dīlera dati apstiprina automašīnas izcelsmi Vācijas tirgū, kur veikta arī lielākā daļa fiksēto apkopes darbu. Servisa un remontu vēsture Digitālajā servisa žurnālā fiksētas regulāras dzinēja eļļas un filtru maiņas Mercedes-Benz autorizētajā servisā Magdeburgā periodā no 2013. līdz 2017. gadam. Papildus standarta apkopēm 73 744 km atzīmē fiksēta degvielas filtra un bremžu šķidruma maiņa, bet pie 123 927 km - priekšējo bremžu kluču nomaiņa. Pēdējais ieraksts 2024. gada februārī (240 627 km) veikts specializētā transmisiju servisā Frankfurtē, kur veikta automātiskās pārnesumkārbas eļļas un filtra maiņa, kā arī eļļas maiņa aizmugurējā tiltā. Nobraukuma un datu saskaņa Dīlera fiksētie nobraukuma punkti veido lineāru un pārskatāmu vēsturi, kas sakrīt ar citu avotu sniegto informāciju. Septiņu gadu pārrāvums oficiālajos ierakstos starp 2017. un 2024. gadu norāda uz apkopēm ārpus autorizētā tīkla, taču pēdējais fiksētais rādītājs Frankfurtē loģiski turpina iepriekšējo gadu tendenci. Eļļas maiņas intervāli Dzinēja eļļas maiņas periodā no 2013. līdz 2017. gadam veiktas ar vidējo intervālu 24 000-25 000 km vai reizi 10-12 mēnešos, kas atbilst ražotāja Long-life standartam.";

describe("splitDealerCommentRoleHeadings", () => {
  it("splits Gemini mashed dealer roles into heading-then-paragraph blocks", () => {
    const out = splitDealerCommentRoleHeadings(MASHED_DEALER_COMMENT);
    const blocks = out.split(/\n\n+/);
    expect(blocks).toHaveLength(4);
    expect(blocks[0]).toMatch(/^Agregātu un aprīkojuma identifikācija\nPēc VIN/);
    expect(blocks[1]).toMatch(/^Servisa un remontu vēsture\nDigitālajā/);
    expect(blocks[2]).toMatch(/^Nobraukuma un datu saskaņa\nDīlera fiksētie/);
    expect(blocks[3]).toMatch(/^Eļļas maiņas intervāli\nDzinēja eļļas/);
  });

  it("does not restack an already spaced dealer comment", () => {
    const spaced = [
      "Agregātu un aprīkojuma identifikācija",
      "Pēc VIN koda identificēts Mercedes-Benz C-klases (W204) modelis.",
      "",
      "Servisa un remontu vēsture",
      "Digitālajā servisa žurnālā fiksētas regulāras eļļas maiņas.",
    ].join("\n");
    const out = toExpertHeadingBodyPlain(spaced);
    expect(out).toBe(
      [
        "Agregātu un aprīkojuma identifikācija",
        "Pēc VIN koda identificēts Mercedes-Benz C-klases (W204) modelis.",
        "",
        "Servisa un remontu vēsture",
        "Digitālajā servisa žurnālā fiksētas regulāras eļļas maiņas.",
      ].join("\n"),
    );
  });

  it("leaves a CSDD comment without dealer role titles unchanged", () => {
    const csdd = "Pirmā reģistrācija Latvijā\nCSDD datos automašīna Latvijā reģistrēta 2016. gadā.";
    expect(toExpertHeadingBodyPlain(csdd)).toBe(csdd);
  });

  it("does not split a heading mid-word (eļļas maiņas intervāliem)", () => {
    const raw =
      "Pilsētas režīmā jāskatās eļļas maiņas intervāliem. Nākamais teikums paliek.";
    const out = splitDealerCommentRoleHeadings(raw);
    expect(out).toContain("eļļas maiņas intervāliem");
    expect(out).not.toMatch(/Eļļas maiņas intervāli\nem/i);
    expect(out).not.toMatch(/^Eļļas maiņas intervāli$/m);
  });

  it("skips dealer role headings for the technical-risks field", () => {
    const raw =
      "Sadales ķēde\nPilsētas režīmā jāskatās eļļas maiņas intervāliem. Klātienē klausies startu.";
    expect(toExpertHeadingBodyPlain(raw, { splitDealerRoleHeadings: false })).toBe(raw);
    expect(normalizeProvinExpertAiComment(raw, { splitDealerRoleHeadings: false })).toContain(
      "eļļas maiņas intervāliem",
    );
  });
});

describe("dropTechnicalRisksSectionTitle", () => {
  it("drops the first line when it is the section title", () => {
    expect(
      dropTechnicalRisksSectionTitle("Tehnisko risku analīze\nSadales ķēde\nN47 paliek pirkuma punkts."),
    ).toBe("Sadales ķēde\nN47 paliek pirkuma punkts.");
    expect(dropTechnicalRisksSectionTitle("1. Tehnisko risku analīze\nĶēde\nTeksts.")).toBe(
      "Ķēde\nTeksts.",
    );
  });
});

describe("finalizeProvinExpertAiComment", () => {
  it("keeps paid text when paragraph normalize would empty markdown-only output", () => {
    expect(finalizeProvinExpertAiComment("***")).toBe("***");
    expect(finalizeProvinExpertAiComment("  ")).toBe("");
  });

  it("drops an English planning preamble glued to the Latvian flagship comment", () => {
    const leaked = [
      "I have analyzed the provided data for the BMW 120D XDRIVE (F20) and will now generate the technical risk analysis.",
      "",
      "Internal Analysis & Plan:",
      "",
      "Aggregate Identification: Engine N47 D20 C. Risk Prioritization #1 Critical Risk: timing chain.",
      "Web Search & Knowledge Integration: Search results confirm the chain is at the rear.",
      "Final Review: Check for banned words. This plan ensures a comprehensive analysis that meets all the specified requirements.Sadales ķēdes resurss",
      "",
      "Šī automašīna ir aprīkota ar N47 sērijas dīzeļdzinēju, kura galvenais riska punkts ir sadales ķēde. Pie nobraukuma virs 200 000 km, ja nav dokumentu par maiņu, šis mezgls ir galvenais pirkuma risks.",
    ].join("\n");
    const cut = stripLeakedAiPlanningPreamble(leaked);
    expect(cut).toMatch(/^Sadales ķēdes resurss/);
    expect(cut).not.toMatch(/I have analyzed|Internal Analysis|This plan ensures/);
    const finalized = finalizeProvinExpertAiComment(leaked);
    expect(finalized).toMatch(/^Sadales ķēdes resurss/);
    expect(finalized).toMatch(/N47/);
    expect(finalized).not.toMatch(/I have analyzed/);
  });

  it("strips forbidden persona nouns from generated comment text", () => {
    const out = finalizeProvinExpertAiComment(
      "Tehniskais eksperts uzskata, ka motors datos izskatās kārtībā.",
    );
    expect(out).not.toMatch(/ekspert/i);
    expect(out).toMatch(/motors datos izskatās kārtībā/);
  });

  it("strips QA kartē instructions, D-markers, HECK/AGR-Kühler and engine-code template", () => {
    const leaked = [
      "Atzīmē teikumus, kas nav kartē vai satur kalkus. Pārraksti tikai tos.",
      "Dzinēja kods noteikts pēc jaudas un tilpuma; to apstiprina marķējums uz bloka.",
      "Piedziņa HECK, dzesētājs AGR-Kühler, kods PR-7L6.",
      "D12 15.03.2020 120000 km: eļļas maiņa. N47 D20 C paliek.",
    ].join(" ");
    const out = stripInternalClientLeaks(leaked);
    expect(out).not.toMatch(/Atzīmē teikumus|Pārraksti tikai|kartē/i);
    expect(out).not.toMatch(/Dzinēja kods noteikts pēc jaudas/);
    expect(out).not.toMatch(/\bHECK\b/);
    expect(out).toMatch(/aizmugurējā piedziņa/);
    expect(out).toMatch(/EGR dzesētājs/);
    expect(out).not.toMatch(/PR-7L6/);
    expect(out).toMatch(/N47 D20 C/);
    expect(finalizeProvinExpertAiComment("operatora norādes šajā auditā. Ķēde ir aizmugurē.")).not.toMatch(
      /operatora norād|šajā auditā/i,
    );
  });
});
