/**
 * Order Copilot — Gemini JSON atbildes parsēšana (bez server-only; der arī testiem).
 */
import type {
  CopilotAction,
  CopilotConfidence,
  CopilotGeminiResponse,
  CopilotSourceKey,
} from "@/lib/admin-copilot-types";
import { isCopilotSourceKey } from "@/lib/admin-copilot-types";
import { OUTVIN_VEHICLE_INFO_ROWS, type OutvinVehicleInfo } from "@/lib/outvin-dealer-types";

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function asString(v: unknown, max = 500): string {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, max);
}

function asConfidence(v: unknown): CopilotConfidence {
  const s = asString(v, 16);
  if (s === "high" || s === "medium" || s === "low") return s;
  return "medium";
}

function parseDealerVehicleInfo(raw: unknown): Partial<OutvinVehicleInfo> {
  const o = asRecord(raw);
  if (!o) return {};
  const out: Partial<OutvinVehicleInfo> = {};
  for (const { key } of OUTVIN_VEHICLE_INFO_ROWS) {
    const value = asString(o[key], 160);
    if (value && !/^[-—–]$/.test(value)) out[key] = value;
  }
  return out;
}

function parseAction(raw: unknown): CopilotAction | null {
  const o = asRecord(raw);
  if (!o) return null;
  const type = asString(o.type, 40);
  const sourceRaw = asString(o.source, 32);
  if (!isCopilotSourceKey(sourceRaw)) return null;
  const source: CopilotSourceKey = sourceRaw;
  const confidence = asConfidence(o.confidence);
  const note = asString(o.note, 200);

  if (type === "upsert_incident") {
    return {
      type: "upsert_incident",
      source,
      date: asString(o.date, 40),
      lossAmount: asString(o.lossAmount, 120),
      country: asString(o.country, 80),
      confidence,
      ...(note ? { note } : {}),
    };
  }
  if (type === "upsert_mileage") {
    return {
      type: "upsert_mileage",
      source,
      date: asString(o.date, 40),
      odometer: asString(o.odometer, 32),
      country: asString(o.country, 80),
      confidence,
      ...(note ? { note } : {}),
    };
  }
  if (type === "set_service_history") {
    const text = asString(o.text, 12_000);
    if (!text) return null;
    return {
      type: "set_service_history",
      source: "auto_records",
      text,
      confidence,
      ...(note ? { note } : {}),
    };
  }
  if (type === "set_dealer_vehicle_info") {
    const vehicleInfo = parseDealerVehicleInfo(o.vehicleInfo);
    if (Object.keys(vehicleInfo).length === 0) return null;
    return {
      type: "set_dealer_vehicle_info",
      source: "auto_records",
      vehicleInfo,
      confidence,
      ...(note ? { note } : {}),
    };
  }
  if (type === "append_raw") {
    const text = asString(o.text, 12_000);
    if (!text) return null;
    return {
      type: "append_raw",
      source,
      text,
      confidence,
      ...(note ? { note } : {}),
    };
  }
  return null;
}

export function parseCopilotGeminiPayload(rawJson: string): CopilotGeminiResponse {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    throw new Error("gemini_invalid_json");
  }
  const o = asRecord(parsed);
  if (!o) throw new Error("gemini_invalid_json");
  const actionsIn = Array.isArray(o.actions) ? o.actions : [];
  const actions: CopilotAction[] = [];
  for (const item of actionsIn.slice(0, 120)) {
    const a = parseAction(item);
    if (a) actions.push(a);
  }
  return {
    reply: asString(o.reply, 4000) || "Gatavs.",
    actions,
    clarificationNeeded: asString(o.clarificationNeeded, 500),
  };
}
