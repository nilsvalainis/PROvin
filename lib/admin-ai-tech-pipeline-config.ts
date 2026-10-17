/**
 * Tehnisko risku v2 pipeline (karte → Gemini 2.5 Pro LV → Flash QA → lint).
 * Noklusējumā izslēgts. Opus nav nevienā solī.
 */
import type { AiAdminModelTier } from "@/lib/ai-admin-model-tier";

export type PipelineField = "technical_risks" | "inspection" | "summary";

export const TECH_PIPELINE: Record<
  PipelineField,
  {
    facts: AiAdminModelTier;
    lv: AiAdminModelTier;
    qa: AiAdminModelTier;
    maxSearches: number;
  }
> = {
  technical_risks: { facts: "lite", lv: "gemini", qa: "gemini-flash", maxSearches: 8 },
  inspection: { facts: "lite", lv: "gemini", qa: "gemini-flash", maxSearches: 0 },
  summary: { facts: "lite", lv: "gemini", qa: "gemini-flash", maxSearches: 0 },
};

/** Operatora "Dziļā analīze": tikai faktu solis uz Sonnet. */
export const TECH_PIPELINE_DEEP_FACTS_TIER: AiAdminModelTier = "flash";

/** Feature flag; noklusējumā izslēgts. */
export function isTechRiskV2Enabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.TECH_RISK_V2 === "1";
}

export const TECH_RISK_V2_ENABLED = isTechRiskV2Enabled();

/** EUR joslas: tikai verificēta KB + datums; šis env ieslēdz ģenerēšanu. */
export function allowCostBands(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.ALLOW_COST_BANDS === "true" || env.ALLOW_COST_BANDS === "1";
}
