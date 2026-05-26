import "server-only";

import { geminiGenerateJsonText } from "@/lib/admin-gemini";
import { parseVehicleAIExtraction } from "@/lib/vehicle-ai-extraction-parse";
import type { VehicleAIExtraction } from "@/lib/vehicle-ai-extraction-types";

export const VEHICLE_AI_EXTRACTION_SYSTEM = `You are PROVIN.LV vehicle history forensic analyst.
You receive raw text extracted from one or more vehicle history PDF reports (any language).
Return ONLY one valid JSON object matching the schema — no markdown, no commentary.

Output language rules:
- anomalies[].description_lv and ai_generated_comments_lv MUST be fluent Latvian for the admin operator.
- Read source text in any language (EN, DE, LV, PL, etc.).

Semantic rules (mandatory):
1. MILEAGE_ROLLBACK (CRITICAL): if an older date shows higher odometer than a newer date, or clear rollback language.
2. HIDDEN_DAMAGE (CRITICAL): if one report states no accidents/clean (e.g. LTAB/OCTA) while another shows damage, payout, total loss, or structural damage.
3. COMMERCIAL_USE (WARNING): taxi, fleet, rental, commercial registration hints.
4. DATA_DISCREPANCY (WARNING or INFO): VIN/plate/year/mileage conflicts between reports.

Odometer synonyms: Odometer, Mileage, Nobraukums, Rida, Läbisõit, km, odometrs.
Always pick the chronologically latest credible mileage as latest_calculated_mileage (integer km).
Count distinct accident/claim events across reports for total_accidents_found.

JSON schema:
{
  "vehicle_metadata": {
    "vin": "string",
    "license_plate": "string|null",
    "manufacture_year": "number|null",
    "first_registration_date": "string|null"
  },
  "extracted_metrics": {
    "latest_calculated_mileage": "number",
    "latest_mileage_date": "string|null",
    "total_accidents_found": "number"
  },
  "anomalies": [
    {
      "severity": "CRITICAL|WARNING|INFO",
      "category": "MILEAGE_ROLLBACK|HIDDEN_DAMAGE|COMMERCIAL_USE|DATA_DISCREPANCY",
      "description_lv": "string"
    }
  ],
  "ai_generated_comments_lv": "string"
}`;

export type PdfTextBundle = { fileName: string; text: string; sourceHint: string };

export function buildVehicleReportsUserPrompt(bundles: PdfTextBundle[]): string {
  const parts = bundles.map((b, i) => {
    const header = `--- PDF ${i + 1}: ${b.fileName} (${b.sourceHint}) ---`;
    const body = b.text.trim().slice(0, 180_000);
    return `${header}\n${body}`;
  });
  return `Analyze ALL PDF extracts below together.\n\n${parts.join("\n\n")}`;
}

export async function extractVehicleDataWithGemini(bundles: PdfTextBundle[]): Promise<VehicleAIExtraction> {
  if (bundles.every((b) => !b.text.trim())) {
    throw new Error("no_pdf_text");
  }
  const raw = await geminiGenerateJsonText({
    model: "gemini-2.5-pro",
    systemInstruction: VEHICLE_AI_EXTRACTION_SYSTEM,
    userPrompt: buildVehicleReportsUserPrompt(bundles),
    temperature: 0.15,
  });
  return parseVehicleAIExtraction(raw);
}
