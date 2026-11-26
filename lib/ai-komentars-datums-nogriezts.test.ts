/**
 * 25.11.2026 regresija: dīlera AI komentārā rindkopas sākās teikuma vidū
 * („2024 ar nobraukumu 99 893 km …”) - teikuma sākums ar datumu kļuva par virsrakstu.
 * Teksti izdomāti (repo ir publisks).
 */
import { describe, expect, it } from "vitest";
import { isRealSentencePunctuation, splitIntoSentences } from "@/lib/lv-sentences";
import {
  keepSourceCommentAfterExpansionStrip,
  normalizeProvinExpertAiComment,
  toExpertHeadingBodyPlain,
} from "@/lib/source-summary-comment-format";
import { adminRichHtmlToPlainText, aiExpertSourceCommentToRichHtml } from "@/lib/admin-rich-comment-html";

const DATES = ["12.03.2012", "12.03. 2012", "12. 03. 2012"];

function pipeline(raw: string): { plain: string; html: string } {
  const server = keepSourceCommentAfterExpansionStrip(normalizeProvinExpertAiComment(raw));
  const html = aiExpertSourceCommentToRichHtml(server);
  return { plain: adminRichHtmlToPlainText(html), html };
}

describe("AI komentārs: datumi DD.MM.GGGG un km netiek griezti", () => {
  for (const d of DATES) {
    it(`pirmā/pēdējā ieraksta teikumi paliek veseli (${d})`, () => {
      const raw = [
        `Pirmais ieraksts fiksēts ${d} ar nobraukumu 20 927 km. Darbi pie lielajiem mezgliem (dzinējs, ātrumkārba, sajūgs, ritošā daļa) nav fiksēti.`,
        "",
        `Pēdējais dīlera ieraksts ${d.replace("2012", "2024").replace("12", "17").replace("03", "07")} ar nobraukumu 99 893 km (lielā apkope). Garākais periods bez ierakstiem datu vēsturē ir 54 mēneši (41 338 km).`,
      ].join("\n");
      const { plain, html } = pipeline(raw);
      expect(plain).toContain(`Pirmais ieraksts fiksēts ${d} ar nobraukumu 20 927 km.`);
      expect(plain).toMatch(/Pēdējais dīlera ieraksts [\d. ]+2024 ar nobraukumu 99 893 km \(lielā apkope\)\. Garākais/);
      expect(plain).not.toMatch(/(^|\n)\s*20(12|24) ar nobraukumu/);
      // Fakta teikums nav trekns virsraksts.
      expect(html).not.toMatch(/<strong>[^<]*(Pirmais|Pēdējais)[^<]*<\/strong>/);
    });
  }

  it("virsraksts + rindkopa ar datumu paliek nemainīta", () => {
    const raw = "Servisa vēsture\nPirmais ieraksts fiksēts 12.03. 2012 ar nobraukumu 20 927 km. Citi darbi nav fiksēti.";
    expect(toExpertHeadingBodyPlain(raw)).toBe(raw);
  });

  it("īss „Virsraksts. Teksts” bez datuma joprojām kļūst par virsrakstu", () => {
    expect(toExpertHeadingBodyPlain("Servisa vēsture. Dati ir pilnīgi.")).toBe("Servisa vēsture\nDati ir pilnīgi.");
  });

  it("teikumu dalītājs nesadala datumu ar atstarpēm, bet punkts aiz gada beidz teikumu", () => {
    const t = "Ieraksts 12.03. 2012 ar 20 927 km. Nākamais 17. 07. 2024. Vēl viens.";
    expect(splitIntoSentences(t)).toEqual([
      "Ieraksts 12.03. 2012 ar 20 927 km. ",
      "Nākamais 17. 07. 2024. ",
      "Vēl viens.",
    ]);
    expect(isRealSentencePunctuation("fiksēts 12.03. 2012 ar", 12)).toBe(false);
  });
});
