import "server-only";

import {
  GEMINI_MODEL_PRO,
  geminiGenerateJsonWithSchema,
  type GeminiUserPart,
} from "@/lib/admin-gemini";
import type { CsddPdfParseResult } from "@/lib/csdd-pdf-ingest";
import { normalizeCsddRawText } from "@/lib/csdd-extended-parse";
import { PDF_GEMINI_INLINE_MAX_BYTES } from "@/lib/pdf-api-limits";
import {
  CSDD_GEMINI_RESPONSE_SCHEMA,
  CSDD_GEMINI_STRUCTURED_SYSTEM,
  csddFieldsFromStructuredGeminiPayload,
  countTaDefects,
  finalizeCsddGeminiPdfResult,
} from "@/lib/csdd-gemini-structured-map";

export {
  CSDD_GEMINI_RESPONSE_SCHEMA,
  CSDD_GEMINI_STRUCTURED_SYSTEM,
  csddFieldsFromStructuredGeminiPayload,
  finalizeCsddGeminiPdfResult,
  mergeCsddPdfParseResults,
  sanitizeCsddRegistrationNumber,
} from "@/lib/csdd-gemini-structured-map";

const LOG_PREFIX = "[csdd-gemini-structured]";

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

export async function extractCsddPdfWithGeminiStructured(opts: {
  buffer: ArrayBuffer;
  fileName: string;
  textHint?: string;
}): Promise<CsddPdfParseResult> {
  const textHint = normalizeCsddRawText(opts.textHint ?? "").trim();
  const usePdf = opts.buffer.byteLength > 0 && opts.buffer.byteLength <= PDF_GEMINI_INLINE_MAX_BYTES;

  const extraParts: GeminiUserPart[] = [];
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

  const rawJson = await geminiGenerateJsonWithSchema({
    model: GEMINI_MODEL_PRO,
    systemInstruction: CSDD_GEMINI_STRUCTURED_SYSTEM,
    parts: extraParts,
    responseSchema: CSDD_GEMINI_RESPONSE_SCHEMA,
    temperature: 0,
  });

  let payload: Record<string, unknown> | null;
  try {
    payload = asRecord(JSON.parse(rawJson));
  } catch {
    throw new Error("gemini_invalid_json");
  }
  if (!payload) throw new Error("gemini_invalid_json");

  const rawForStorage =
    textHint.length > 0
      ? textHint.slice(0, 500_000)
      : asString(payload.rawTekstaFragments, 8000);
  const fields = csddFieldsFromStructuredGeminiPayload(payload, rawForStorage);

  console.info(`${LOG_PREFIX} ok`, {
    fileName: opts.fileName,
    mileage: fields.mileageHistory.filter((r) => r.odometer.trim()).length,
    ta: fields.technicalInspectionHistory.length,
    defects: countTaDefects(fields.technicalInspectionHistory),
    prevDefects: fields.prevInspectionBlock.defects?.length ?? 0,
  });

  return finalizeCsddGeminiPdfResult(
    {
      rawUnprocessedData: rawForStorage,
      fields,
      warnings: [`Datu avots: Gemini Structured Output — PDF (${opts.fileName}).`],
      meta: {
        charCount: rawForStorage.length,
        engine: "gemini_primary",
        extractionMethod: "gemini",
      },
    },
    textHint,
  );
}
