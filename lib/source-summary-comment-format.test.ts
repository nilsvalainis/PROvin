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
  });

  it("replaces em and en dashes with ASCII hyphen", () => {
    expect(applyProvinReportCopyVocabulary("Labs auto — kopts.")).toBe("Labs auto - kopts.");
    expect(applyProvinReportCopyVocabulary("2007–2015, 300–400 €")).toBe("2007-2015, 300-400 €");
  });

  it("replaces injektori/inžektori with iesmidzinātājs (sprausla)", () => {
    expect(applyProvinReportCopyVocabulary("Jāpārbauda injektori un vara gredzeni.")).toBe(
      "Jāpārbauda iesmidzinātāji (sprauslas) un vara gredzeni.",
    );
    expect(applyProvinReportCopyVocabulary("Inžektoru nolietojums.")).toBe(
      "Iesmidzinātāju (sprauslu) nolietojums.",
    );
    expect(applyProvinReportCopyVocabulary("injektoriem jāveic stenda tests.")).toBe(
      "iesmidzinātājiem (sprauslām) jāveic stenda tests.",
    );
    expect(applyProvinReportCopyVocabulary("ķēde/injektori/dzesēšana")).toBe(
      "ķēde/iesmidzinātāji (sprauslas)/dzesēšana",
    );
  });
});

describe("normalizeProvinExpertAiComment", () => {
  it("strips leading dash from paragraph openers and keeps bold hooks", () => {
    const raw = `- **Nobraukums.** Automašīna ar **120 000 km**.\n\n- Otrā rindkopa bez treknraksta.`;
    const out = normalizeProvinExpertAiComment(raw);
    expect(out).toContain("**Nobraukums.**");
    expect(out).not.toMatch(/^-\s/m);
    expect(out).not.toMatch(/\n\n-\s/);
  });

  it("replaces automobīlis inside normalized paragraphs", () => {
    const out = normalizeProvinExpertAiComment("**Tests.** Šis automobīlis ir ok — 2007–2015.");
    expect(out).toContain("automašīna");
    expect(out).not.toContain("automobīlis");
    expect(out).not.toMatch(/[\u2013\u2014]/);
    expect(out).toContain("ok - 2007-2015");
  });

  it("keeps more than 8 paragraphs for expert comments", () => {
    const paras = Array.from({ length: 12 }, (_, i) => `**Sadaļa ${i + 1}.** Teksts par punktu ${i + 1}.`);
    const out = normalizeProvinExpertAiComment(paras.join("\n\n"));
    expect(out.split(/\n\n+/).length).toBe(12);
  });

  it("does not clip a long expert comment", () => {
    const long = Array.from({ length: 20 }, (_, i) => `**P${i}.** ${"vārds ".repeat(80)}`).join("\n\n");
    const out = normalizeProvinExpertAiComment(long);
    expect(out).not.toMatch(/…$/);
    expect(out.split(/\n\n+/).length).toBe(20);
    expect(out).toContain("**P0.**");
    expect(out).toContain("**P19.**");
  });
});

describe("normalizeExpertSourcePdfComment", () => {
  it("caps PDF extract comments at 8 paragraphs", () => {
    const paras = Array.from({ length: 12 }, (_, i) => `Rindkopa ${i + 1}.`);
    const out = normalizeExpertSourcePdfComment(paras.join("\n\n"));
    expect(out.split(/\n\n+/).length).toBe(8);
  });
});
