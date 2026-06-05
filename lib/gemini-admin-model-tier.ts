/** Admin ✨ — Pro (dziļāks) vai Flash (ātrāks / mazāk 503). */
export type GeminiAdminModelTier = "pro" | "flash";

export const GEMINI_ADMIN_MODEL_TIER_DEFAULT: GeminiAdminModelTier = "pro";

export function parseGeminiModelTier(raw: unknown): GeminiAdminModelTier {
  const v = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (v === "flash" || v === "free" || v === "fast") return "flash";
  return "pro";
}
