import "server-only";

import { GEMINI_MODEL_PRO, geminiGenerateJsonText, type GeminiUserPart } from "@/lib/admin-gemini";
import { parseVehicleAIExtraction } from "@/lib/vehicle-ai-extraction-parse";
import type { VehicleAIExtraction } from "@/lib/vehicle-ai-extraction-types";

export const VEHICLE_AI_EXTRACTION_SYSTEM = `You are PROVIN.LV vehicle history forensic analyst.
You receive vehicle history from extracted PDF text and/or PDF files attached as binary documents.
Return ONLY one valid JSON object matching the schema — no markdown, no commentary.

Input modes:
- Plain text extracts (may be partial).
- Full PDF attachments when text extraction failed (scanned/image PDFs) — read the document directly.

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

export type PdfInlineAttachment = {
  fileName: string;
  sourceHint: string;
  buffer: ArrayBuffer;
};

export function buildVehicleReportsUserPrompt(bundles: PdfTextBundle[], pdfCount: number): string {
  const parts: string[] = [];
  if (bundles.length > 0) {
    parts.push("=== EXTRACTED TEXT FROM PDFs ===");
    for (const [i, b] of bundles.entries()) {
      const header = `--- PDF ${i + 1}: ${b.fileName} (${b.sourceHint}) ---`;
      const body = b.text.trim().slice(0, 180_000);
      parts.push(`${header}\n${body}`);
    }
  }
  if (pdfCount > 0) {
    parts.push(
      `=== BINARY PDF ATTACHMENTS (${pdfCount}) ===`,
      "The PDF file(s) above in this message are attached directly before this instruction.",
      "Read them fully (including tables, stamps, and images).",
    );
  }
  parts.push("Analyze ALL sources together and return the JSON object only.");
  return parts.join("\n\n");
}

function bufferToBase64(buffer: ArrayBuffer): string {
  return Buffer.from(buffer).toString("base64");
}

export async function extractVehicleDataWithGemini(input: {
  textBundles: PdfTextBundle[];
  pdfAttachments?: PdfInlineAttachment[];
}): Promise<VehicleAIExtraction> {
  const pdfs = input.pdfAttachments ?? [];
  if (input.textBundles.every((b) => !b.text.trim()) && pdfs.length === 0) {
    throw new Error("no_pdf_text");
  }

  const extraParts: GeminiUserPart[] = [];
  for (const pdf of pdfs) {
    extraParts.push({
      inlineData: {
        mimeType: "application/pdf",
        data: bufferToBase64(pdf.buffer),
      },
    });
    extraParts.push({
      text: `[Attached PDF document: ${pdf.fileName} — ${pdf.sourceHint}. Read this file for vehicle history data.]`,
    });
  }

  const raw = await geminiGenerateJsonText({
    model: GEMINI_MODEL_PRO,
    systemInstruction: VEHICLE_AI_EXTRACTION_SYSTEM,
    extraParts,
    userPrompt: buildVehicleReportsUserPrompt(input.textBundles, pdfs.length),
    temperature: 0.15,
  });
  return parseVehicleAIExtraction(raw);
}
