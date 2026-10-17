import type { AiAdminModelTier } from "@/lib/ai-admin-model-tier";

/**
 * Ieteicamais ✨ līmenis pēc lauka. Noklusējums visiem komentāriem ir Smart
 * (gemini-3.8-flash). PRO (Opus 5.5) operators izvēlas manuāli. PDF extract
 * paliek Sonnet iekšēji (nav ✨ poga).
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
  seller: "gemini-flash",
  price: "gemini-flash",
  mileage: "gemini-flash",
  incidents: "gemini-flash",
  inspection: "gemini-flash",
  technical_risks: "gemini-flash",
  summary: "gemini-flash",
  sources_comparison: "gemini-flash",
  listing_peek: "gemini-flash",
  extract: "flash",
};

/** UI pogas: Smart, tad PRO. Vecākie līmeņi paliek kodā, ne pogās. */
export const AI_ADMIN_TIER_BUTTON_ORDER: AiAdminModelTier[] = ["gemini-flash", "pro"];

export function aiAdminButtonOrder(recommended: AiAdminModelTier): AiAdminModelTier[] {
  const visible = AI_ADMIN_TIER_BUTTON_ORDER;
  if (visible.includes(recommended)) {
    return [recommended, ...visible.filter((t) => t !== recommended)];
  }
  return [...visible];
}
