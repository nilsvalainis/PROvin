import type { AiAdminModelTier } from "@/lib/ai-admin-model-tier";

/**
 * Ieteicamais ✨ līmenis pēc lauka — dārgais Opus tikai verdiktam.
 * Gemini Flash = avotu/listing īsie komentāri; Sonnet = sintēze; Opus = kopsavilkums.
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
  tirgus: "gemini-flash",
  seller: "flash",
  price: "flash",
  mileage: "flash",
  incidents: "flash",
  inspection: "flash",
  technical_risks: "flash",
  summary: "pro",
  sources_comparison: "flash",
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
