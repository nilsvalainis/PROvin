/**
 * Īsi, faktiski avota komentāri (PDF imports, Gemini Plan B, ✨ avota komentāri).
 */

export const SOURCE_COMMENT_NO_ISSUES_LV = "Problēmas nav konstatētas.";

/** Gemini sistēmas uzdevumam — obligāts komentāru formāts. */
export const SOURCE_PDF_COMMENT_GEMINI_RULES = `COMMENTS field (mandatory):
- If there are NO anomalies, damage, mileage conflicts, status alerts, or data issues for this source: set comments EXACTLY to "Problēmas nav konstatētas." (nothing else).
- If issues exist: output ONLY a short Latvian bullet list (- prefix per line), raw objective facts, zero conversational fluff, max 4 bullets, max ~350 characters total. Example: "- 07.03.2021 nobraukuma nesakritība: dīlera vēsturē 46k km, sludinājumā 42k km; - Reģistrēts 1 negadījums Latvijā (tāme 500–1500 EUR)"`;

export const SOURCE_BLOCK_COMMENT_GEMINI_RULES = `OUTPUT FORMAT (mandatory):
- If this source block shows NO problems, conflicts, or anomalies vs other portfolio data: output EXACTLY "Problēmas nav konstatētas."
- If problems exist: output ONLY a short bullet list (- per line), objective facts in Latvian, max 4 bullets, max ~350 characters, no introductions or conclusions.`;

/** Lokālie / Gemini komentāri → vienots īss formāts. */
export function formatSourcePdfComments(facts: string[]): string {
  const bullets = facts
    .map((f) => f.trim())
    .filter(Boolean)
    .map((f) => (f.startsWith("-") ? f : `- ${f.replace(/^[-•]\s*/, "")}`))
    .slice(0, 4);
  if (bullets.length === 0) return SOURCE_COMMENT_NO_ISSUES_LV;
  return bullets.join("\n");
}

/** Normalizē Gemini atgriezto komentāru. */
export function normalizeSourcePdfComment(raw: string | undefined | null): string {
  const t = (raw ?? "").trim();
  if (!t) return SOURCE_COMMENT_NO_ISSUES_LV;
  const lower = t.toLowerCase();
  if (
    /problēmas\s+nav\s+konstatētas/i.test(t) ||
    /^nav\s+konstatētas?\s+problēmas/i.test(t) ||
    /^(nē|nav)\s*[-–—]?\s*(problēmu|anomāliju|konstatēts)/i.test(t) ||
    (/^(ok|clean|none|no issues)/i.test(t) && t.length < 60)
  ) {
    return SOURCE_COMMENT_NO_ISSUES_LV;
  }
  if (lower.includes("problēmas nav") && t.length < 120 && !t.includes("-")) {
    return SOURCE_COMMENT_NO_ISSUES_LV;
  }
  if (t.includes("-")) {
    const lines = t
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 4);
    return formatSourcePdfComments(lines.map((l) => l.replace(/^[-•]\s*/, "")));
  }
  if (t.length > 400) return formatSourcePdfComments([t.slice(0, 380) + "…"]);
  return formatSourcePdfComments([t]);
}
