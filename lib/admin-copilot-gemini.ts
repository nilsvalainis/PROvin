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
- Operator chat (Latvian or English) — often a short command like "izvelc datus no PDF" / "aizpildi tabulas"
- One OR MORE PDF attachments (AutoDNA, CarVertical, LTAB/OCTA, Auto Records, other). Read each visually like Gemini web.
- Current table snapshot for this order

Your job: from ALL attached PDFs + the message, propose structured actions that INSERT rows into the correct source tables. Never invent VIN, plates, dates, km, or EUR amounts not present in the operator message or PDFs.

What PROVIN typically extracts from these reports (do this for each matching PDF):
- AutoDNA → autodna: TRANSPORTLĪDZEKĻA VĒSTURE odometer rows (km required) + Transportlīdzekļa zaudējumu apjoms / damage-claim rows → incidents. If AutoDNA (or any PDF) has service/maintenance/repair history (apkopes, dīlera žurnāls, workshop visits) → ALSO set_service_history into auto_records (see below). Other leftover significant facts → append_raw on autodna.
- CarVertical → carvertical: odometer/mileage log + insurance claims/incidents (+ damage details map into incidents when amount+date exist). Service history in PDF → set_service_history (auto_records). Leftover significant facts → append_raw on carvertical.
- LTAB / OCTA → ltab: insurance accident rows only (date + EUR + country). Leftover significant facts → append_raw on ltab.
- Auto Records / ODOMETER CHECK → auto_records: mileage rows + set_service_history when service journal present
- Other foreign reports → citi_avoti (first section): mileage + incidents when present; leftover facts → append_raw on citi_avoti

Sources (must match exactly):
- autodna | carvertical | ltab | auto_records | citi_avoti

Actions:
1) upsert_incident — NEGADĪJUMU VĒSTURE: date, lossAmount (EUR or free text), country
2) upsert_mileage — NOBRAUKUMS: date, odometer (digits), country
3) set_service_history — Oficiālā dīlera lauks „Servisa vēsture” (ALWAYS source=auto_records). Put maintenance/repair history here when present in ANY attached PDF (often AutoDNA). Format ONLY facts, one entry per line:
   DD.MM.YYYY | <odometer digits> km | <work done>
   Example: 12.03.2019 | 87450 km | Eļļas maiņa, bremžu kluči
   No commentary, no intro, no markdown — plain fact lines only. Prefer high confidence when the PDF clearly lists services.
4) append_raw — Append significant leftover report facts into that source’s RAW / AI-context field (so later ✨ comment generation does not miss them). Targets: autodna/carvertical → Papildu AI konteksts; auto_records → RAW; ltab → PDF import RAW; citi_avoti → RAW. Use for: equipment lists, type/engine codes, stolen/taxi/fleet flags, ownership notes, inspection remarks, Status Center items, damage zone text without EUR, recalls, etc. that do NOT fit incident/mileage/service-history actions. Keep factual bullet/plain lines; no essay. Prefer the PDF’s matching source.

When multiple PDFs are attached:
- Classify each PDF by branding/layout and fill the matching source
- Extract ALL readable mileage and incident rows (not just a sample)
- Also extract full service history into one set_service_history action (merge all PDFs’ service lines chronologically if helpful)
- Prefer high confidence when the vendor is clear from the PDF itself
- One short reply summarizing which sources you filled

Confidence:
- high — source clear from PDF branding/filename/layout OR operator named the source
- medium — source inferred
- low — guessy

If a PDF vendor is unclear, set clarificationNeeded (short Latvian) for that file only; still extract the PDFs you are sure about.

reply: short Latvian confirmation. No markdown fences.

Rules:
- Dates: always full DD.MM.YYYY in output. If the report shows only MM.YYYY / M.YYYY (e.g. 06.2020 or 11.2019), convert to 01.MM.YYYY (e.g. 01.06.2020). Never leave month-year-only dates.
- lossAmount: keep ranges like "300 - 400 EUR"; free text allowed if not a number
- odometer: digits only (no "km") in upsert_mileage; in set_service_history include "km" after the number as shown in the format
- country: Latvian names when known (Vācija, Latvija, …)
- Do NOT write expert commentary into comments fields — only table rows, Servisa vēsture facts, and RAW facts
- set_service_history / append_raw use the "text" field (date not required for those types)
- Deduplicate against existing snapshot and across PDFs (same date+amount or date+km → omit duplicate actions; identical service lines → omit)`;

const ACTION_ITEM_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    type: {
      type: SchemaType.STRING,
      format: "enum",
      enum: ["upsert_incident", "upsert_mileage", "set_service_history", "append_raw"],
    },
    source: {
      type: SchemaType.STRING,
      format: "enum",
      enum: ["autodna", "carvertical", "ltab", "auto_records", "citi_avoti"],
    },
    date: { type: SchemaType.STRING },
    lossAmount: { type: SchemaType.STRING },
    odometer: { type: SchemaType.STRING },
    country: { type: SchemaType.STRING },
    text: { type: SchemaType.STRING },
    confidence: { type: SchemaType.STRING, format: "enum", enum: ["high", "medium", "low"] },
    note: { type: SchemaType.STRING },
  },
  required: ["type", "source", "confidence"],
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
  /** Viens vai vairāki PDF (Gemini lasa katru). */
  pdfs?: { fileName: string; buffer: ArrayBuffer }[];
  /** @deprecated izmanto pdfs */
  pdf?: { fileName: string; buffer: ArrayBuffer };
}): Promise<CopilotGeminiResponse> {
  const summary = buildCopilotBlocksSummary(opts.sourceBlocks);
  const historyLines = (opts.history ?? [])
    .slice(-8)
    .map((m) => `${m.role === "user" ? "Operator" : "Copilot"}: ${m.content.slice(0, 1500)}`)
    .join("\n");

  const pdfs = [
    ...(opts.pdfs ?? []),
    ...(opts.pdf && opts.pdf.buffer.byteLength > 0 ? [opts.pdf] : []),
  ].filter((p) => p.buffer.byteLength > 0);

  const parts: GeminiUserPart[] = [];
  for (const [i, pdf] of pdfs.entries()) {
    parts.push({
      inlineData: { mimeType: "application/pdf", data: bufferToBase64(pdf.buffer) },
    });
    parts.push({
      text: `[PDF ${i + 1}/${pdfs.length}: ${pdf.fileName}. Read fully (tables, claims, odometer). Map to the correct PROVIN source. Prefer visual reading like Gemini web.]`,
    });
  }

  parts.push({
    text: [
      "=== CURRENT TABLES ===",
      summary,
      historyLines ? `\n=== RECENT CHAT ===\n${historyLines}` : "",
      `\n=== ATTACHED PDFs ===\n${pdfs.length ? pdfs.map((p, i) => `${i + 1}. ${p.fileName}`).join("\n") : "(none)"}`,
      "\n=== OPERATOR MESSAGE ===",
      opts.message.trim() ||
        (pdfs.length > 1
          ? "(Multi-PDF) Extract all mileage + incident rows from every attached report into the matching sources."
          : "(PDF only — extract structured rows for the matching vendor)"),
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
