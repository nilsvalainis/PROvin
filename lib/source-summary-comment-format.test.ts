import { describe, expect, it } from "vitest";
import {
  applyProvinReportCopyVocabulary,
  normalizeExpertSourcePdfComment,
  normalizeProvinExpertAiComment,
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
