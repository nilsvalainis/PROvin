/**
 * Admin Order Copilot — strukturētās darbības (negadījumi / nobraukums / serviss / RAW).
 */
import type { OutvinVehicleInfo } from "@/lib/outvin-dealer-types";

export const COPILOT_SOURCE_KEYS = [
  "csdd",
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

/** Oficiālā dīlera „Servisa vēsture” — faktu rindas (datums + km + darbi). */
export type CopilotServiceHistoryAction = {
  type: "set_service_history";
  source: "auto_records";
  text: string;
  confidence: CopilotConfidence;
  note?: string;
};

/** OFICIĀLĀ DĪLERA DATI → „SERVISA UN REMONTU VĒSTURE” tabulas rinda. */
export type CopilotServiceWorkAction = {
  type: "upsert_service_work";
  source: "auto_records";
  date: string;
  odometer: string;
  works: string;
  confidence: CopilotConfidence;
  note?: string;
};

/**
 * OFICIĀLĀ DĪLERA DATI — transporta informācijas lauki (VIN, dzinēja kods, ātrumkārba,
 * krāsa, interjērs) no avotu atskaišu specifikācijas sadaļām.
 */
export type CopilotDealerVehicleInfoAction = {
  type: "set_dealer_vehicle_info";
  source: "auto_records";
  vehicleInfo: Partial<OutvinVehicleInfo>;
  confidence: CopilotConfidence;
  note?: string;
};

/** Būtiska papildu info → avota RAW žurnāls. */
export type CopilotAppendRawAction = {
  type: "append_raw";
  source: CopilotSourceKey;
  text: string;
  confidence: CopilotConfidence;
  note?: string;
};

export type CopilotAction =
  | CopilotIncidentAction
  | CopilotMileageAction
  | CopilotServiceHistoryAction
  | CopilotServiceWorkAction
  | CopilotDealerVehicleInfoAction
  | CopilotAppendRawAction;

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
