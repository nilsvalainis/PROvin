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
import { COPILOT_SOURCE_KEYS, type CopilotChatMessage, type CopilotGeminiResponse, type CopilotSourceKey } from "@/lib/admin-copilot-types";
import type { WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";

export { parseCopilotGeminiPayload } from "@/lib/admin-copilot-parse";

export const ADMIN_COPILOT_SYSTEM = `You are PROVIN.LV admin Order Copilot — an operator assistant that fills vehicle history tables in the admin panel.

You receive:
- Operator chat (Latvian or English) — often a short command, OR an empty message with PDF(s) attached
- One OR MORE PDF attachments (AutoDNA, CarVertical, LTAB/OCTA, Auto Records, other). Read each visually like Gemini web.
- Current table snapshot for this order (includes CSDD, comments, RAW — the server already dumps full extractable PDF text into the matching source RAW before you run)

Default intent when PDF(s) are attached (even with empty / vague operator message like „ok” / „izvelc”):
- Automatically fill the matching source tables: ALL odometer rows (date, km, country) + ALL incidents (date, lossAmount, country)
- Vendor clear from filename/branding (e.g. AutoDNA) → confidence high; do not ask which source
- The server ALWAYS upserts 100% of extractable PDF text into that source’s RAW (AutoDNA, CarVertical, CSDD, Citi avoti, Oficiālais dīleris) — even when tables are already filled. You do NOT paste the whole PDF via append_raw.
- Do NOT refuse with „pievienojiet PDF vēlreiz” if CURRENT TABLES already contain that PDF’s RAW dump or structured rows — use the snapshot + chat history for follow-ups
- Ask to re-attach a PDF ONLY when the operator refers to a file that is neither attached now nor present in RAW/tables

COUNTRY EXTRACTION (critical — operators report countries are visible in PDF but often left empty):
- For EVERY mileage and incident row, copy the country from the SAME row/block in the PDF or in RAW text (country column, flag label, ISO2 like DE/DEU/LV, or full name Germany/Deutschland/Vācija).
- AutoDNA rows often show «Valsts Vācija» (or similar) under the odometer — that IS the country field; always include it.
- AutoDNA TRANSPORTLĪDZEKĻA VĒSTURE and zaudējumu apjoms rows almost always include a country — never omit it when present next to the date/km/EUR.
- CarVertical timeline events include a country name before the description — put it in country.
- Normalize to Latvian names (Vācija, Latvija, Itālija, Šveice, …). ISO2 DE → Vācija, LV → Latvija, etc.
- Empty country is allowed ONLY when that specific row truly has no country marker in PDF/RAW.

LOGICAL CONTEXT CHAIN (Valsts lauks tabulās — ne ✨ komentāru teksts):
- All sources share ONE evidence pool: tables + RAW + CSDD + chat. When AutoDNA/LTAB/CSDD already has Valsts for an event, copy it to CarVertical / other sources for the SAME event (identical date+km or date+loss EUR).
- Filling source B after source A: read A’s filled rows and RAW first — propagate confirmed countries; do not re-ask and do not leave Valsts empty when A already proved it.
- If two sources disagree on country for the same event → leave Valsts EMPTY (do not pick a guess).
- Never infer country from make/model, seller country, or „probably imported from DE” without a row-level marker.
- Never write expert prose into comments fields — only structured rows with Valsts filled when evidence exists.

Your job: from ALL attached PDFs + the message + snapshot, propose structured actions that INSERT rows into the correct source tables. Never invent VIN, plates, dates, km, or EUR amounts not present in the operator message, PDFs, or existing snapshot RAW.

What PROVIN typically extracts from these reports (do this for each matching PDF):
- CSDD / e.csdd.lv vehicle data PDF → ALWAYS csdd when enabled. Dedicated CSDD import runs automatically — do NOT map CSDD PDF rows into autodna/carvertical/ltab.
- AutoDNA → autodna: TRANSPORTLĪDZEKĻA VĒSTURE odometer rows (km required) + damage-claim rows → incidents. Service/maintenance history → ALSO set_service_history into auto_records. Full PDF text is already in autodna RAW — do NOT append_raw the whole PDF again.
- CarVertical → carvertical: odometer log + insurance claims/incidents. Service history → set_service_history (auto_records). Full PDF text already in RAW — no full-PDF append_raw.
- LTAB / OCTA → ltab: insurance accident rows only (date + EUR + country). Full PDF text already in RAW.
- Auto Records / ODOMETER CHECK → auto_records: mileage rows + set_service_history when service journal present
- Other foreign reports → citi_avoti (first section): mileage + incidents when present; full text already in RAW when dumped

Sources (must match exactly):
- csdd is handled by dedicated CSDD PDF import when enabled — no JSON actions for csdd
- autodna | carvertical | ltab | auto_records | citi_avoti

Actions:
1) upsert_incident — NEGADĪJUMU VĒSTURE: date, lossAmount (EUR or free text), country
2) upsert_mileage — NOBRAUKUMS: date, odometer (digits), country
3) set_service_history — Oficiālā dīlera lauks „Servisa vēsture” (ALWAYS source=auto_records). Format ONLY facts, one entry per line:
   DD.MM.YYYY | <odometer digits> km | <work done>
   Example: 12.03.2019 | 87450 km | Eļļas maiņa, bremžu kluči
   No commentary, no intro, no markdown — plain fact lines only. Prefer high confidence when the PDF clearly lists services.
4) append_raw — ONLY short leftover facts NOT already in the full-PDF RAW dump. Targets: autodna/carvertical → Papildu AI konteksts; auto_records → RAW; ltab → PDF import RAW; citi_avoti → RAW. NEVER paste the entire PDF via append_raw — the server already stored 100% of extractable text in RAW.

When multiple PDFs are attached:
- Classify each PDF by branding/layout and fill the matching source
- Extract ALL readable mileage and incident rows (not just a sample)
- Also extract full service history into one set_service_history action (merge all PDFs’ service lines chronologically if helpful)
- Prefer high confidence when the vendor is clear from the PDF itself
- One short reply summarizing which sources you filled

Confidence:
- high — source clear from PDF branding/filename/layout OR operator named the source OR PDF-only upload with clear vendor
- medium — source inferred
- low — guessy

If a PDF vendor is unclear, set clarificationNeeded (short Latvian) for that file only; still extract the PDFs you are sure about.

reply: short Latvian confirmation. No markdown fences.

Rules:
- Dates: always full DD.MM.YYYY in output. If the report shows only MM.YYYY / M.YYYY (e.g. 06.2020 or 11.2019), convert to 01.MM.YYYY (e.g. 01.06.2020). Never leave month-year-only dates.
- lossAmount: keep ranges like "300 - 400 EUR"; free text allowed if not a number
- odometer: digits only (no "km") in upsert_mileage; in set_service_history include "km" after the number as shown in the format
- country (mileage) / country (incident → stored as country name): Latvian names when known (Vācija, Latvija, …). MANDATORY when visible in PDF/RAW for that row. CROSS-SOURCE COUNTRY RULES:
  1) Read ALL attached PDFs + CURRENT TABLES (every source’s mileage/incidents, CSDD fields, comments, RAW/AI-context). Treat sources as one shared evidence pool — exchange country facts between them.
  2) If a row’s PDF does not name the country, but another already-filled source (or another PDF / CSDD / RAW / comment) clearly refers to the SAME event (same or equivalent date + same loss EUR, or same date + same odometer km, or unambiguous matching claim text), COPY that confirmed country into this action.
  3) Use CSDD timeline: «Iepriekšējās reģistrācijas valsts», pirmā reģistrācija LV, TA/nobraukuma ieraksti — to place early foreign history vs Latvija after LV registration when the match is unambiguous (e.g. OCTA/CSDD inspection in LV → Latvija).
  4) Infer from unambiguous plate format, insurer country, city/region in description, or report locale ONLY when it confirms the country at 100% certainty for that row.
  5) Leave country EMPTY ("") ONLY when NO source (PDF row, existing table row, CSDD, RAW, comment, or sibling action in this batch) can 100% confirm it. Never invent or weakly guess a country. Never leave empty when the PDF row shows a country/flag/ISO code. If sources CONFLICT on country for the same event — leave empty.
  6) Prefer filling country on every upsert_incident / upsert_mileage when certainty exists — empty is the exception, not the default.
  7) After extracting rows, mentally cross-check ALL sources: if another source’s table or RAW already has Valsts for matching date+km / date+EUR, apply it to your new rows.
- Do NOT write expert commentary into comments fields — only table rows, Servisa vēsture facts, and short RAW leftovers
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

const PDF_ONLY_OPERATOR_HINT =
  "(PDF attached — extract ALL odometer rows (date, km, country) and ALL incidents (date, lossAmount, country) into the matching source with high confidence when the vendor is clear. Full extractable PDF text is already stored in that source RAW by the server — do NOT paste the entire PDF via append_raw; focus on structured table rows.)";

export async function runOrderCopilotGemini(opts: {
  message: string;
  sourceBlocks: WorkspaceSourceBlocks;
  allowedSources?: CopilotSourceKey[];
  history?: CopilotChatMessage[];
  /** Viens vai vairāki PDF (Gemini lasa katru). */
  pdfs?: { fileName: string; buffer: ArrayBuffer }[];
  /** @deprecated izmanto pdfs */
  pdf?: { fileName: string; buffer: ArrayBuffer };
}): Promise<CopilotGeminiResponse> {
  const summary = buildCopilotBlocksSummary(opts.sourceBlocks);
  const allowedSources = (opts.allowedSources?.length ? opts.allowedSources : [...COPILOT_SOURCE_KEYS]).filter((v, i, arr) => arr.indexOf(v) === i);
  const historyLines = (opts.history ?? [])
    .slice(-12)
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
      text: `[PDF ${i + 1}/${pdfs.length}: ${pdf.fileName}. Read fully (tables, claims, odometer). Map to the correct PROVIN source. Prefer visual reading like Gemini web. Extract ALL mileage + incident rows.]`,
    });
  }

  parts.push({
    text: [
      "=== CURRENT TABLES ===",
      summary,
      `\n=== ENABLED TARGET SOURCES ===\n${allowedSources.join(", ")}`,
      "\nOnly emit actions for the enabled target sources above. If a fact belongs elsewhere, skip it instead of redirecting it into another source. If auto_records is not enabled, do not emit set_service_history.",
      historyLines ? `\n=== RECENT CHAT ===\n${historyLines}` : "",
      `\n=== ATTACHED PDFs ===\n${pdfs.length ? pdfs.map((p, i) => `${i + 1}. ${p.fileName}`).join("\n") : "(none)"}`,
      "\n=== OPERATOR MESSAGE ===",
      opts.message.trim() ||
        (pdfs.length > 0
          ? PDF_ONLY_OPERATOR_HINT
          : "(No PDF — answer from chat history + CURRENT TABLES only; do not invent rows.)"),
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
