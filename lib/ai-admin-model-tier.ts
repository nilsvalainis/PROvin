/**
 * Admin ✨ kvalitātes līmenis: `pro` → Claude Opus (dziļāka analīze),
 * `flash` → Claude Sonnet (ātrāks, lētāks). Vērtības paliek nemainītas, lai
 * saglabātos saderība ar jau saglabātajiem melnrakstiem un pieprasījumiem.
 */
export type AiAdminModelTier = "pro" | "flash";

export const AI_ADMIN_MODEL_TIER_DEFAULT: AiAdminModelTier = "pro";

export function parseAiModelTier(raw: unknown): AiAdminModelTier {
  const v = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (v === "flash" || v === "free" || v === "fast" || v === "sonnet") return "flash";
  return "pro";
}
