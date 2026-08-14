/**
 * Admin ✨ kvalitātes līmenis:
 * `pro` → Claude Opus (dziļā analīze),
 * `flash` → Claude Sonnet (vidējais),
 * `lite` → Claude Haiku (lētākais — īsi komentāri, ja dati jau ir tabulā).
 * `pro` / `flash` vērtības paliek, lai saglabātos saderība ar melnrakstiem.
 */
export type AiAdminModelTier = "pro" | "flash" | "lite";

export const AI_ADMIN_MODEL_TIER_DEFAULT: AiAdminModelTier = "pro";

export function parseAiModelTier(raw: unknown): AiAdminModelTier {
  const v = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (v === "lite" || v === "haiku" || v === "cheap" || v === "eco") return "lite";
  if (v === "flash" || v === "free" || v === "fast" || v === "sonnet") return "flash";
  return "pro";
}

export function aiAdminModelTierLabel(tier: AiAdminModelTier): string {
  if (tier === "lite") return "Claude Haiku";
  if (tier === "flash") return "Claude Sonnet";
  return "Claude Opus";
}
