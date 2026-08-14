import "server-only";

import {
  CLAUDE_MODEL_EXTRACT,
  aiGenerateJsonWithSchema,
  type AiUserPart,
} from "@/lib/admin-ai";
import type { CsddPdfParseResult } from "@/lib/csdd-pdf-ingest";
import { normalizeCsddRawText } from "@/lib/csdd-extended-parse";
import { PDF_AI_INLINE_MAX_BYTES } from "@/lib/pdf-api-limits";
import { ADMIN_RAW_UNPROCESSED_MAX_LEN } from "@/lib/admin-raw-field-limits";
import {
  CSDD_AI_RESPONSE_SCHEMA,
  CSDD_AI_STRUCTURED_SYSTEM,
  CSDD_TA_AI_RESPONSE_SCHEMA,
  CSDD_TA_AI_STRUCTURED_SYSTEM,
  csddFieldsFromStructuredAiPayload,
  csddTaExtractionLooksIncomplete,
  countTaDefects,
  extractTaSectionTextHint,
  finalizeCsddAiPdfResult,
  mergeCsddTaAiIntoFields,
  normalizeStructuredAiPayload,
} from "@/lib/csdd-ai-structured-map";

export {
  CSDD_AI_RESPONSE_SCHEMA,
  CSDD_AI_STRUCTURED_SYSTEM,
  csddFieldsFromStructuredAiPayload,
  finalizeCsddAiPdfResult,
  mergeCsddPdfParseResults,
  sanitizeCsddRegistrationNumber,
} from "@/lib/csdd-ai-structured-map";

const LOG_PREFIX = "[csdd-ai-structured]";

function bufferToBase64(buffer: ArrayBuffer): string {
  return Buffer.from(buffer).toString("base64");
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function asString(v: unknown, max = 400): string {
  if (typeof v === "string") return v.trim().slice(0, max);
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return "";
}

export async function extractCsddPdfWithAiStructured(opts: {
  buffer: ArrayBuffer;
  fileName: string;
  textHint?: string;
}): Promise<CsddPdfParseResult> {
  const textHint = normalizeCsddRawText(opts.textHint ?? "").trim();
  const usePdf = opts.buffer.byteLength > 0 && opts.buffer.byteLength <= PDF_AI_INLINE_MAX_BYTES;

  const extraParts: AiUserPart[] = [];
  if (usePdf) {
    extraParts.push({
      inlineData: { mimeType: "application/pdf", data: bufferToBase64(opts.buffer) },
    });
  }
  extraParts.push({
    text: `[CSDD PDF: ${opts.fileName}]\nRead the attached PDF document (all pages). Extract every table from the PDF layout.\n${
      textHint.length > 0
        ? `Optional incomplete text-layer hint (PDF wins if different):\n${textHint.slice(0, 60_000)}`
        : ""
    }`,
  });

  const rawJson = await aiGenerateJsonWithSchema({
    model: CLAUDE_MODEL_EXTRACT,
    systemInstruction: CSDD_AI_STRUCTURED_SYSTEM,
    parts: extraParts,
    responseSchema: CSDD_AI_RESPONSE_SCHEMA,
    temperature: 0,
  });

  let payload: Record<string, unknown> | null;
  try {
    payload = asRecord(JSON.parse(rawJson));
  } catch {
    throw new Error("ai_invalid_json");
  }
  if (!payload) throw new Error("ai_invalid_json");

  const rawForStorage =
    textHint.length > 0
      ? textHint.slice(0, ADMIN_RAW_UNPROCESSED_MAX_LEN)
      : asString(payload.rawTekstaFragments, 8000);
  let fields = csddFieldsFromStructuredAiPayload(
    normalizeStructuredAiPayload(payload),
    rawForStorage,
  );

  let taPass = 0;
  if (csddTaExtractionLooksIncomplete(fields, textHint)) {
    taPass = 1;
    const taHint = extractTaSectionTextHint(textHint);
    const taParts: AiUserPart[] = [];
    if (usePdf) {
      taParts.push({
        inlineData: { mimeType: "application/pdf", data: bufferToBase64(opts.buffer) },
      });
    }
    taParts.push({
      text: `[CSDD TA only — ${opts.fileName}]\nExtract EVERY "Apskates datums" block and ALL Kods rows from Tehnisko apskašu vēsture + Iepriekšējās apskates / Detalizētais vērtējums.\n${
        taHint.length > 0
          ? `Text-layer focus (PDF wins if different):\n${taHint.slice(0, 80_000)}`
          : "Read all PDF pages for technical inspection sections."
      }`,
    });

    const taRawJson = await aiGenerateJsonWithSchema({
      model: CLAUDE_MODEL_EXTRACT,
      systemInstruction: CSDD_TA_AI_STRUCTURED_SYSTEM,
      parts: taParts,
      responseSchema: CSDD_TA_AI_RESPONSE_SCHEMA,
      temperature: 0,
    });

    let taPayload: Record<string, unknown> | null;
    try {
      taPayload = asRecord(JSON.parse(taRawJson));
    } catch {
      taPayload = null;
    }
    if (taPayload) {
      fields = mergeCsddTaAiIntoFields(fields, taPayload);
    }
  }

  console.info(`${LOG_PREFIX} ok`, {
    fileName: opts.fileName,
    taPass,
    mileage: fields.mileageHistory.filter((r) => r.odometer.trim()).length,
    ta: fields.technicalInspectionHistory.length,
    defects: countTaDefects(fields.technicalInspectionHistory),
    prevDefects: fields.prevInspectionBlock.defects?.length ?? 0,
  });

  return finalizeCsddAiPdfResult(
    {
      rawUnprocessedData: rawForStorage,
      fields,
      warnings: [
        `Datu avots: AI Structured Output — PDF (${opts.fileName}).`,
        ...(taPass > 0 ? ["Papildu AI izsaukums: tehniskās apskates dati."] : []),
      ],
      meta: {
        charCount: rawForStorage.length,
        engine: "ai_primary",
        extractionMethod: "ai",
      },
    },
    textHint,
  );
}
