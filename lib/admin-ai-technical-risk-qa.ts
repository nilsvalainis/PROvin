/**
 * Solis 3: Gemini Flash QA. Pārbauda, ka apgalvojumi ir kartē, un labo tikai atzīmētos teikumus.
 */
import "server-only";

import { adminGenerateExpertText } from "@/lib/admin-ai-dispatch";
import { AI_TECH_RISK_V2_QA_SYSTEM } from "@/lib/admin-ai-tech-risk-v2-prompts";
import { TECH_PIPELINE } from "@/lib/admin-ai-tech-pipeline-config";
import { extractJsonObject, type TechnicalRiskMap } from "@/lib/admin-ai-technical-risk-map-types";
import { parseTechnicalRiskQaResult, type TechnicalRiskQaResult } from "@/lib/admin-ai-technical-risk-qa-parse";

export type { TechnicalRiskQaFlag, TechnicalRiskQaResult } from "@/lib/admin-ai-technical-risk-qa-parse";
export { applySentenceRewrites, parseTechnicalRiskQaResult } from "@/lib/admin-ai-technical-risk-qa-parse";

export async function qaTechnicalRiskText(input: {
  text: string;
  map: TechnicalRiskMap;
  /** OFICIĀLĀ DĪLERA FAKTI ar ID; QA atzīmē teikumus, kas tiem ir pretrunā. */
  dealerFactsBrief?: string;
}): Promise<TechnicalRiskQaResult> {
  const userPrompt = `RISKA KARTE:
${JSON.stringify(input.map)}
${input.dealerFactsBrief?.trim() ? `\n${input.dealerFactsBrief.trim()}\n` : ""}
TEKSTS:
${input.text}

Atzīmē teikumus, kas nav kartē vai satur kalkus/aizliegtas frāzes. Pārraksti tikai tos.`;

  try {
    const raw = await adminGenerateExpertText({
      modelTier: TECH_PIPELINE.technical_risks.qa,
      systemInstruction: AI_TECH_RISK_V2_QA_SYSTEM,
      userPrompt,
      qualityField: "technical_risks",
      temperature: 0.1,
      maxTokens: 8_000,
    });
    return parseTechnicalRiskQaResult(extractJsonObject(raw), input.text);
  } catch {
    return { flagged: [], rewritten_text: input.text };
  }
}
