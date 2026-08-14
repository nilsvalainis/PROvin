/**
 * Admin ✨ kvalitātes līmenis:
 * `pro` → Claude Opus (tikai kopsavilkums / apzināts klikšķis),
 * `flash` → Claude Sonnet (sintēze: nobraukums, negadījumi, riski, cena),
 * `lite` → Claude Haiku + Sonnet gramatika (API saderība; UI slēpts),
 * `gemini` → Gemini 2.5 Pro (vidēji smagi Gemini lauki),
 * `gemini-flash` → Gemini 3 Flash (noklusējums avotu komentāriem).
 */
export type AiAdminModelTier = "pro" | "flash" | "lite" | "gemini" | "gemini-flash";

/** Globālais fallback, ja lauks nav norādīts — lētais līmenis, ne Opus. */
export const AI_ADMIN_MODEL_TIER_DEFAULT: AiAdminModelTier = "gemini-flash";

export function parseAiModelTier(raw: unknown): AiAdminModelTier {
  const v = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (v === "gemini-flash" || v === "gflash" || v === "gemini_flash") return "gemini-flash";
  if (v === "gemini" || v === "gemini-pro" || v === "gpro" || v === "gemini_pro") return "gemini";
  if (v === "lite" || v === "haiku" || v === "cheap" || v === "eco") return "lite";
  if (v === "flash" || v === "free" || v === "fast" || v === "sonnet") return "flash";
  return "pro";
}

export function isGeminiAdminTier(tier?: AiAdminModelTier | null): boolean {
  return tier === "gemini" || tier === "gemini-flash";
}

export function aiAdminModelTierLabel(tier: AiAdminModelTier): string {
  if (tier === "gemini-flash") return "Gemini 3 Flash";
  if (tier === "gemini") return "Gemini 2.5 Pro";
  if (tier === "lite") return "Claude Haiku";
  if (tier === "flash") return "Claude Sonnet";
  return "Claude Opus";
}
