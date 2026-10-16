/** QA JSON parse / teikumu labojumi (bez server-only, testējams). */

export type TechnicalRiskQaFlag = {
  sentence: string;
  reason: string;
  replacement: string;
};

export type TechnicalRiskQaResult = {
  flagged: TechnicalRiskQaFlag[];
  rewritten_text: string;
};

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export function applySentenceRewrites(text: string, flagged: TechnicalRiskQaFlag[]): string {
  let out = text;
  for (const f of flagged) {
    if (!f.sentence || !f.replacement) continue;
    if (out.includes(f.sentence)) {
      out = out.split(f.sentence).join(f.replacement);
    }
  }
  return out;
}

export function parseTechnicalRiskQaResult(raw: unknown, fallbackText: string): TechnicalRiskQaResult {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const flagged: TechnicalRiskQaFlag[] = [];
  if (Array.isArray(o.flagged)) {
    for (const item of o.flagged) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      const sentence = str(row.sentence);
      if (!sentence) continue;
      flagged.push({
        sentence,
        reason: str(row.reason),
        replacement: str(row.replacement),
      });
    }
  }
  const rewritten = str(o.rewritten_text) || applySentenceRewrites(fallbackText, flagged);
  return { flagged, rewritten_text: rewritten || fallbackText };
}
