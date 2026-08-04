/**
 * Admin Order Copilot — strukturētās darbības (negadījumi / nobraukums).
 */

export const COPILOT_SOURCE_KEYS = [
  "autodna",
  "carvertical",
  "ltab",
  "auto_records",
  "citi_avoti",
] as const;

export type CopilotSourceKey = (typeof COPILOT_SOURCE_KEYS)[number];

export type CopilotConfidence = "high" | "medium" | "low";

export type CopilotIncidentAction = {
  type: "upsert_incident";
  source: CopilotSourceKey;
  date: string;
  lossAmount: string;
  country: string;
  confidence: CopilotConfidence;
  note?: string;
};

export type CopilotMileageAction = {
  type: "upsert_mileage";
  source: CopilotSourceKey;
  date: string;
  odometer: string;
  country: string;
  confidence: CopilotConfidence;
  note?: string;
};

export type CopilotAction = CopilotIncidentAction | CopilotMileageAction;

export type CopilotChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type CopilotGeminiResponse = {
  reply: string;
  actions: CopilotAction[];
  /** Ja avots nav skaidrs — īss jautājums operatoram. */
  clarificationNeeded: string;
};

export function isCopilotSourceKey(v: string): v is CopilotSourceKey {
  return (COPILOT_SOURCE_KEYS as readonly string[]).includes(v);
}
