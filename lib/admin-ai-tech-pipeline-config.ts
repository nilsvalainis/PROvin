/**
 * Tehnisko risku v2 pipeline (karte → LV teksts → QA → lint). Noklusējumā izslēgts.
 *
 * Modeli izvēlas operators esošajā selektorā (lauka ✨ poga / FLASH MAX rinda) — šeit nekas
 * nav cieti iekodēts. Noklusējuma ceļš ir 100% Gemini:
 * - izvēlēts Gemini līmenis (`gemini` / `gemini-flash`) → VISI soļi lieto to pašu;
 * - izvēlēts Claude līmenis (`lite` / `flash` / `pro`) → tā ir Nila apzināta, manuāla izvēle:
 *   Claude drīkst darīt TIKAI faktu/riska kartes papildinājumu agregātiem, ko operators nosauc
 *   komandā (`Claude: N57, ZF 8HP`); teksts un QA paliek Gemini. Nekad automātiski.
 */
import { isGeminiAdminTier, type AiAdminModelTier } from "@/lib/ai-admin-model-tier";
import { AI_ADMIN_FIELD_DEFAULT_TIER } from "@/lib/ai-admin-field-defaults";

export type PipelineField = "technical_risks" | "inspection" | "summary";

export type TechRiskV2Tiers = {
  /** Kartes (fakti + meklēšana) solis. Vienmēr Gemini. */
  facts: AiAdminModelTier;
  /** Latviešu teksts. Vienmēr Gemini. */
  lv: AiAdminModelTier;
  /** QA. Vienmēr Gemini. */
  qa: AiAdminModelTier;
  /** Manuāls Claude papildinājums agregātiem; null = izslēgts (noklusējums). */
  anthropicComponentsTier: AiAdminModelTier | null;
};

/** Noklusējums = esošais admin iestatījums tehnisko risku laukam. */
export const TECH_RISK_V2_DEFAULT_TIER: AiAdminModelTier = AI_ADMIN_FIELD_DEFAULT_TIER.technical_risks;

export function resolveTechRiskV2Tiers(selected?: AiAdminModelTier | null): TechRiskV2Tiers {
  const fallback = isGeminiAdminTier(TECH_RISK_V2_DEFAULT_TIER) ? TECH_RISK_V2_DEFAULT_TIER : "gemini";
  if (!selected) return { facts: fallback, lv: fallback, qa: fallback, anthropicComponentsTier: null };
  if (isGeminiAdminTier(selected)) {
    return { facts: selected, lv: selected, qa: selected, anthropicComponentsTier: null };
  }
  return { facts: fallback, lv: fallback, qa: fallback, anthropicComponentsTier: selected };
}

/** Operatora komandas rinda `Claude: agregāts1, agregāts2` (arī `Anthropic:`). */
export function parseAnthropicComponentsFromOperatorNotes(notes?: string | null): string[] {
  if (!notes) return [];
  const out: string[] = [];
  for (const line of notes.split(/\r?\n/)) {
    const m = line.match(/^\s*(?:claude|anthropic)\s*:\s*(.+)$/i);
    if (!m?.[1]) continue;
    for (const part of m[1].split(/[,;]/)) {
      const t = part.trim();
      if (t && !out.includes(t)) out.push(t);
    }
  }
  return out.slice(0, 6);
}

/** Meklējumu limits Claude papildinājumam (Gemini grounding limitu nosaka pats modelis). */
export const TECH_RISK_V2_ANTHROPIC_MAX_SEARCHES = 4;

/** @deprecated v2 vairs neizmanto cietos līmeņus; atstāts saderībai. Lieto `resolveTechRiskV2Tiers`. */
export const TECH_PIPELINE: Record<
  PipelineField,
  { facts: AiAdminModelTier; lv: AiAdminModelTier; qa: AiAdminModelTier; maxSearches: number }
> = {
  technical_risks: { facts: "gemini", lv: "gemini", qa: "gemini", maxSearches: 0 },
  inspection: { facts: "gemini", lv: "gemini", qa: "gemini", maxSearches: 0 },
  summary: { facts: "gemini", lv: "gemini", qa: "gemini", maxSearches: 0 },
};

/** Feature flag; noklusējumā izslēgts. */
export function isTechRiskV2Enabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.TECH_RISK_V2 === "1";
}

export const TECH_RISK_V2_ENABLED = isTechRiskV2Enabled();

/** EUR joslas: tikai verificēta KB + datums; šis env ieslēdz ģenerēšanu. */
export function allowCostBands(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.ALLOW_COST_BANDS === "true" || env.ALLOW_COST_BANDS === "1";
}
