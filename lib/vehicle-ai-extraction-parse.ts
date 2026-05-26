import type {
  VehicleAIExtraction,
  VehicleAiAnomaly,
  VehicleAiAnomalyCategory,
  VehicleAiAnomalySeverity,
  VehicleAiExtractionMeta,
} from "@/lib/vehicle-ai-extraction-types";

const SEVERITIES = new Set<VehicleAiAnomalySeverity>(["CRITICAL", "WARNING", "INFO"]);
const CATEGORIES = new Set<VehicleAiAnomalyCategory>([
  "MILEAGE_ROLLBACK",
  "HIDDEN_DAMAGE",
  "COMMERCIAL_USE",
  "DATA_DISCREPANCY",
]);

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function numOrNull(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return Math.round(v);
  if (typeof v === "string" && v.trim()) {
    const n = Number.parseInt(v.replace(/\D/g, ""), 10);
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

function parseAnomaly(raw: unknown): VehicleAiAnomaly | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const severity = str(o.severity).toUpperCase() as VehicleAiAnomalySeverity;
  const category = str(o.category).toUpperCase() as VehicleAiAnomalyCategory;
  const description_lv = str(o.description_lv);
  if (!SEVERITIES.has(severity) || !CATEGORIES.has(category) || !description_lv) return null;
  return { severity, category, description_lv };
}

/** Noņem ```json apvalku, ja modelis to pievienoja. */
export function stripJsonFence(raw: string): string {
  const t = raw.trim();
  const m = t.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  return (m?.[1] ?? t).trim();
}

export function parseVehicleAIExtraction(raw: string): VehicleAIExtraction {
  const jsonText = stripJsonFence(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("gemini_invalid_json");
  }
  if (!parsed || typeof parsed !== "object") throw new Error("gemini_invalid_json");

  const root = parsed as Record<string, unknown>;
  const meta = root.vehicle_metadata;
  const metrics = root.extracted_metrics;
  if (!meta || typeof meta !== "object" || !metrics || typeof metrics !== "object") {
    throw new Error("gemini_invalid_json");
  }

  const m = meta as Record<string, unknown>;
  const x = metrics as Record<string, unknown>;
  const vin = str(m.vin).toUpperCase().replace(/\s/g, "");
  const latest = numOrNull(x.latest_calculated_mileage) ?? 0;
  const accidents = numOrNull(x.total_accidents_found) ?? 0;

  const anomaliesIn = Array.isArray(root.anomalies) ? root.anomalies : [];
  const anomalies = anomaliesIn.map(parseAnomaly).filter((a): a is VehicleAiAnomaly => a !== null);

  return {
    vehicle_metadata: {
      vin,
      license_plate: str(m.license_plate) || null,
      manufacture_year: numOrNull(m.manufacture_year),
      first_registration_date: str(m.first_registration_date) || null,
    },
    extracted_metrics: {
      latest_calculated_mileage: Math.max(0, latest),
      latest_mileage_date: str(x.latest_mileage_date) || null,
      total_accidents_found: Math.max(0, accidents),
    },
    anomalies,
    ai_generated_comments_lv: str(root.ai_generated_comments_lv),
  };
}

/** Droša atjaunošana no melnraksta JSON (neizmet, ja bojāts). */
export function parseVehicleAiFromWorkspaceRecord(
  p: Record<string, unknown>,
): { extraction: VehicleAIExtraction | null; meta: VehicleAiExtractionMeta | null } {
  let extraction: VehicleAIExtraction | null = null;
  if (p.vehicleAiExtraction && typeof p.vehicleAiExtraction === "object") {
    try {
      extraction = parseVehicleAIExtraction(JSON.stringify(p.vehicleAiExtraction));
    } catch {
      extraction = null;
    }
  }
  let meta: VehicleAiExtractionMeta | null = null;
  if (p.vehicleAiExtractionMeta && typeof p.vehicleAiExtractionMeta === "object") {
    const m = p.vehicleAiExtractionMeta as Record<string, unknown>;
    const analyzedAt = str(m.analyzedAt);
    const fileNames = Array.isArray(m.fileNames) ? m.fileNames.map((x) => str(x)).filter(Boolean) : [];
    const sources = Array.isArray(m.sources) ? m.sources.map((x) => str(x)).filter(Boolean) : [];
    if (analyzedAt) meta = { analyzedAt, fileNames, sources };
  }
  return { extraction, meta };
}
