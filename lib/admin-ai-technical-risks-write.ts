import type { AiAdminModelTier } from "@/lib/ai-admin-model-tier";
import { isGeminiAdminTier } from "@/lib/ai-admin-model-tier";

/** Flagship floor — same as `comment-quality` technical_risks min chars. */
export const TECHNICAL_RISKS_MIN_CLIENT_CHARS = 1800;
const REWRITE_LENGTH_RATIO = 0.62;

export function countExpertCommentParagraphs(text: string): number {
  return text
    .trim()
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean).length;
}

/**
 * Claude Sonnet/Opus analizē; Gemini Flash raksta klienta LV.
 * Ja operators jau izvēlējies Gemini pogu — ķēde nav vajadzīga (Gemini jau raksta).
 */
export function shouldChainClaudeTechnicalRisksToGeminiWrite(
  modelTier: AiAdminModelTier | null | undefined,
  hasGeminiKey: boolean,
): boolean {
  return Boolean(hasGeminiKey) && !isGeminiAdminTier(modelTier);
}

/**
 * Gemini nedrīkst „pārstāstīt īsumā” Claude analīzi — tad paliek ne šis, ne tas.
 */
export function isTechnicalRisksClientRewriteTooThin(source: string, rewritten: string): boolean {
  const src = source.trim();
  const out = rewritten.trim();
  if (!out) return true;
  if (src.length >= TECHNICAL_RISKS_MIN_CLIENT_CHARS && out.length < TECHNICAL_RISKS_MIN_CLIENT_CHARS) {
    return true;
  }
  if (src.length >= 2500 && out.length < Math.floor(src.length * REWRITE_LENGTH_RATIO)) {
    return true;
  }
  const srcParas = countExpertCommentParagraphs(src);
  const outParas = countExpertCommentParagraphs(out);
  if (srcParas >= 8 && outParas < Math.min(7, srcParas - 2)) return true;
  return false;
}

export const TECHNICAL_RISKS_ANALYST_THEN_WRITER_NOTE = `Šis teksts NAV galīgā klienta kopija — to pārrakstīs Gemini Flash vieglā darbnīcas latviešu valodā. Tava vērtība ir TEHNISKĀ ANALĪZE: agregātu identifikācija, prioritāte, kas NAV risks, mezgli, kalibrācija pret km/vecumu, web sintēze. Neupurē detalizāciju un 8–12 rindkopu latiņu valodas dēļ. Raksti pilnu analīzi ar visiem faktiem; kalkas klienta slānī labos rakstītājs.`;
