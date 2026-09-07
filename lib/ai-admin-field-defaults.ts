import type { AiAdminModelTier } from "@/lib/ai-admin-model-tier";

/**
 * Ieteicamais ✨ līmenis pēc lauka. Noklusējums ir Gemini ģimene;
 * Sonnet / Opus operators izvēlas manuāli.
 */
export type AiAdminFieldKind =
  | "source_comment"
  | "listing"
  | "tirgus"
  | "seller"
  | "price"
  | "mileage"
  | "incidents"
  | "inspection"
  | "technical_risks"
  | "summary"
  | "sources_comparison"
  | "listing_peek"
  | "extract";

export const AI_ADMIN_FIELD_DEFAULT_TIER: Record<AiAdminFieldKind, AiAdminModelTier> = {
  source_comment: "gemini-flash",
  listing: "gemini-flash",
  tirgus: "gemini",
  seller: "gemini",
  price: "gemini",
  mileage: "gemini",
  incidents: "gemini",
  inspection: "gemini",
  technical_risks: "gemini",
  summary: "gemini",
  sources_comparison: "gemini",
  listing_peek: "gemini-flash",
  extract: "flash",
};

/** Pogas no lētākā uz dārgāko (Haiku UI paliek slēpts). */
export const AI_ADMIN_TIER_BUTTON_ORDER: AiAdminModelTier[] = [
  "gemini-flash",
  "gemini",
  "flash",
  "pro",
];

export function aiAdminButtonOrder(recommended: AiAdminModelTier): AiAdminModelTier[] {
  return [recommended, ...AI_ADMIN_TIER_BUTTON_ORDER.filter((t) => t !== recommended)];
}
