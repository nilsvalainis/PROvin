/**
 * Order Copilot — Gemini Pro + PDF inline → strukturētas darbības.
 */
import "server-only";

import { SchemaType, type Schema } from "@google/generative-ai";
import {
  GEMINI_MODEL_PRO,
  geminiGenerateJsonWithSchema,
  type GeminiJsonSchema,
  type GeminiUserPart,
} from "@/lib/admin-gemini";
import { buildCopilotBlocksSummary } from "@/lib/admin-copilot-apply";
import { parseCopilotGeminiPayload } from "@/lib/admin-copilot-parse";
import type { CopilotChatMessage, CopilotGeminiResponse } from "@/lib/admin-copilot-types";
import type { WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";

export { parseCopilotGeminiPayload } from "@/lib/admin-copilot-parse";

export const ADMIN_COPILOT_SYSTEM = `You are PROVIN.LV admin Order Copilot — an operator assistant that fills vehicle history tables in the admin panel.

You receive:
- Operator chat (Latvian or English)
- Optional PDF attachment (read it visually like Gemini web — tables, dates, amounts)
- Current table snapshot for this order

Your job: propose structured actions that INSERT rows into the correct source tables. Never invent VIN, plates, dates, km, or EUR amounts not present in the operator message or PDF.

Sources (must match exactly):
- autodna — AutoDNA (mileage + incidents)
- carvertical — CarVertical (mileage + incidents)
- ltab — LTAB/OCTA (incidents only)
- auto_records — AUTO RECORDS (mileage only)
- citi_avoti — Citi avoti / other sources (mileage + incidents; first section)

Actions:
1) upsert_incident — NEGADĪJUMU VĒSTURE row: date, lossAmount (EUR or free text), country
2) upsert_mileage — NOBRAUKUMS row: date, odometer (digits), country

Confidence:
- high — source + fields clearly stated by operator OR clearly readable in PDF for that vendor
- medium — source inferred or partial fields
- low — guessy

If source is ambiguous and multiple vendors exist, set clarificationNeeded (short Latvian question) and leave actions empty OR only include actions you are sure about.

reply: short Latvian confirmation of what you will fill (or what you need). No markdown fences.

Rules:
- Dates: prefer DD.MM.YYYY (accept ISO and normalize in text)
- lossAmount: keep ranges like "300 - 400 EUR"; free text allowed if not a number
- odometer: digits only in the field (no "km")
- country: Latvian names when known (Vācija, Latvija, …)
- PDF: map AutoDNA / CarVertical / LTAB / Auto Records / other → correct source
- Do NOT write expert commentary fields — only table rows
- Deduplicate against existing snapshot rows when the same date+amount or date+km already exists (omit those actions)`;

const ACTION_ITEM_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    type: { type: SchemaType.STRING, format: "enum", enum: ["upsert_incident", "upsert_mileage"] },
    source: {
      type: SchemaType.STRING,
      format: "enum",
      enum: ["autodna", "carvertical", "ltab", "auto_records", "citi_avoti"],
    },
    date: { type: SchemaType.STRING },
    lossAmount: { type: SchemaType.STRING },
    odometer: { type: SchemaType.STRING },
    country: { type: SchemaType.STRING },
    confidence: { type: SchemaType.STRING, format: "enum", enum: ["high", "medium", "low"] },
    note: { type: SchemaType.STRING },
  },
  required: ["type", "source", "date", "confidence"],
};

export const ADMIN_COPILOT_RESPONSE_SCHEMA: GeminiJsonSchema = {
  type: SchemaType.OBJECT,
  properties: {
    reply: { type: SchemaType.STRING },
    clarificationNeeded: { type: SchemaType.STRING },
    actions: {
      type: SchemaType.ARRAY,
      items: ACTION_ITEM_SCHEMA,
    },
  },
  required: ["reply", "actions", "clarificationNeeded"],
};

function bufferToBase64(buffer: ArrayBuffer): string {
  return Buffer.from(buffer).toString("base64");
}

export async function runOrderCopilotGemini(opts: {
  message: string;
  sourceBlocks: WorkspaceSourceBlocks;
  history?: CopilotChatMessage[];
  pdf?: { fileName: string; buffer: ArrayBuffer };
}): Promise<CopilotGeminiResponse> {
  const summary = buildCopilotBlocksSummary(opts.sourceBlocks);
  const historyLines = (opts.history ?? [])
    .slice(-8)
    .map((m) => `${m.role === "user" ? "Operator" : "Copilot"}: ${m.content.slice(0, 1500)}`)
    .join("\n");

  const parts: GeminiUserPart[] = [];
  if (opts.pdf && opts.pdf.buffer.byteLength > 0) {
    parts.push({
      inlineData: { mimeType: "application/pdf", data: bufferToBase64(opts.pdf.buffer) },
    });
    parts.push({
      text: `[Attached PDF: ${opts.pdf.fileName}. Read the full document visually — extract mileage and accident/claim rows. Prefer Gemini-web quality, not text-layer OCR.]`,
    });
  }

  parts.push({
    text: [
      "=== CURRENT TABLES ===",
      summary,
      historyLines ? `\n=== RECENT CHAT ===\n${historyLines}` : "",
      "\n=== OPERATOR MESSAGE ===",
      opts.message.trim() || "(PDF only — extract structured rows for the matching vendor)",
      "\nReturn JSON matching the schema.",
    ]
      .filter(Boolean)
      .join("\n"),
  });

  const raw = await geminiGenerateJsonWithSchema({
    model: GEMINI_MODEL_PRO,
    systemInstruction: ADMIN_COPILOT_SYSTEM,
    parts,
    responseSchema: ADMIN_COPILOT_RESPONSE_SCHEMA,
    temperature: 0.1,
  });

  return parseCopilotGeminiPayload(raw);
}
