/**
 * Admin ✨ kvalitātes līmenis (UI: Smart un PRO).
 * `gemini-flash` → Gemini 3.8 Flash (Smart, noklusējums visiem laukiem),
 * `pro` → Claude Opus 5.5 (PRO, tikai kad operators nospiež),
 * `flash` / `lite` / `gemini` paliek kodā failover / PDF extract, UI tās nerāda.
 */
export type AiAdminModelTier = "pro" | "flash" | "lite" | "gemini" | "gemini-flash";

/** Globālais fallback, ja lauks nav norādīts: Smart, ne Opus. */
export const AI_ADMIN_MODEL_TIER_DEFAULT: AiAdminModelTier = "gemini-flash";

export function parseAiModelTier(raw: unknown): AiAdminModelTier {
  const v = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (v === "gemini-flash" || v === "gflash" || v === "gemini_flash" || v === "smart") {
    return "gemini-flash";
  }
  if (v === "gemini" || v === "gemini-pro" || v === "gpro" || v === "gemini_pro") return "gemini";
  if (v === "lite" || v === "haiku" || v === "cheap" || v === "eco") return "lite";
  if (v === "flash" || v === "free" || v === "fast" || v === "sonnet") return "flash";
  if (v === "pro" || v === "opus") return "pro";
  return "gemini-flash";
}

export function isGeminiAdminTier(tier?: AiAdminModelTier | null): boolean {
  return tier === "gemini" || tier === "gemini-flash";
}

export function aiAdminModelTierLabel(tier: AiAdminModelTier): string {
  if (tier === "gemini-flash") return "Smart";
  if (tier === "gemini") return "Gemini 2.5 Pro";
  if (tier === "lite") return "Claude Haiku";
  if (tier === "flash") return "Claude Sonnet";
  return "PRO";
}
