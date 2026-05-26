import "server-only";

import { getGeminiApiKeyFromEnv } from "@/lib/admin-gemini";
import { parseAutoRecordsPdfText, type AutoRecordsPdfParseResult } from "@/lib/auto-records-pdf-parse";
import { autoRecordsRowHasData } from "@/lib/auto-records-paste-parse";
import { ltabRowHasData } from "@/lib/admin-source-blocks";
import type { HistoryVendorPdfParseResult, HistoryVendorPdfTarget } from "@/lib/history-vendor-pdf-import";
import type { PdfIngestEngine } from "@/lib/pdf-ingest-types";
import { extractPdfTextDetailed, type PdfExtractResult } from "@/lib/pdf-text-extract-server";
import {
  autoRecordsParseHasData,
  extractSourcePdfWithGemini,
  vendorParseHasData,
} from "@/lib/source-pdf-gemini-extract";
import {
  detectVendorPdfStructure,
  parseVendorPdfLocal,
  vendorLocalParseHasData,
} from "@/lib/vendor-pdf-local-parse";

const LOG_PREFIX = "[pdf-source-ingest]";
const MIN_TEXT_FOR_STRUCTURE = 40;

export type SourcePdfIngestTarget = HistoryVendorPdfTarget | "auto_records";

function autoRecordsStructureDetected(text: string): boolean {
  return /ODOMETER\s+CHECK|auto[\s_-]*records|Event\s+Date/i.test(text.slice(0, 200_000));
}

function withEngine<T extends { meta: { engine?: PdfIngestEngine } }>(
  result: T,
  engine: PdfIngestEngine,
  textBackend?: PdfExtractResult["backend"],
): T {
  return {
    ...result,
    meta: {
      ...result.meta,
      engine,
      ...(textBackend ? { textBackend } : {}),
    },
  };
}

async function runGeminiPlanB(
  target: SourcePdfIngestTarget,
  buffer: ArrayBuffer,
  fileName: string,
  textHint: string,
  extract: PdfExtractResult,
): Promise<HistoryVendorPdfParseResult | AutoRecordsPdfParseResult> {
  if (!getGeminiApiKeyFromEnv()) {
    throw new Error("missing_gemini_key");
  }
  console.info(`${LOG_PREFIX} plan_b_gemini`, { fileName, target, stage: extract.stage });
  const result = await extractSourcePdfWithGemini({ target, buffer, fileName, textHint });
  if ("incidents" in result) {
    return withEngine(result, "gemini_fallback", extract.backend);
  }
  return withEngine(result, "gemini_fallback", extract.backend);
}

function shouldUsePlanB(
  target: SourcePdfIngestTarget,
  extract: PdfExtractResult,
  text: string,
  localVendor?: HistoryVendorPdfParseResult,
  localAuto?: AutoRecordsPdfParseResult,
): { use: boolean; reason: string } {
  if (extract.textLayerCharCount === 0 || extract.stage === "load_failed") {
    return { use: true, reason: "empty_text_layer" };
  }
  if (extract.textLayerCharCount < MIN_TEXT_FOR_STRUCTURE) {
    return { use: true, reason: "text_too_short" };
  }

  if (target === "auto_records") {
    if (!autoRecordsStructureDetected(text)) {
      return { use: true, reason: "auto_records_structure_unmatched" };
    }
    if (!localAuto || !autoRecordsParseHasData(localAuto)) {
      return { use: true, reason: "auto_records_no_rows" };
    }
    return { use: false, reason: "local_ok" };
  }

  const structure = detectVendorPdfStructure(target, text);
  if (!structure.matched) {
    return { use: true, reason: "vendor_structure_unmatched" };
  }
  if (!localVendor || !vendorLocalParseHasData(localVendor)) {
    return { use: true, reason: "vendor_no_rows" };
  }
  return { use: false, reason: "local_ok" };
}

/**
 * Viena PDF imports: Plan A (lokāls) → Plan B (Gemini tikai skenētiem / neatpazītiem).
 */
export async function ingestSourcePdfFile(opts: {
  target: SourcePdfIngestTarget;
  buffer: ArrayBuffer;
  fileName: string;
}): Promise<{
  result: HistoryVendorPdfParseResult | AutoRecordsPdfParseResult;
  extract: PdfExtractResult;
  plan: PdfIngestEngine;
  planReason: string;
}> {
  const { target, buffer, fileName } = opts;
  const extract = await extractPdfTextDetailed(buffer, { fileName });
  const text = extract.text;

  let localVendor: HistoryVendorPdfParseResult | undefined;
  let localAuto: AutoRecordsPdfParseResult | undefined;

  if (target !== "auto_records" && extract.textLayerCharCount >= MIN_TEXT_FOR_STRUCTURE) {
    localVendor = parseVendorPdfLocal(target, text, { textBackend: extract.backend });
  } else if (target === "auto_records" && extract.textLayerCharCount >= MIN_TEXT_FOR_STRUCTURE) {
    localAuto = withEngine(parseAutoRecordsPdfText(text), "local_parser", extract.backend);
  }

  const decision = shouldUsePlanB(target, extract, text, localVendor, localAuto);

  if (!decision.use) {
    console.info(`${LOG_PREFIX} plan_a_ok`, { fileName, target, reason: decision.reason, backend: extract.backend });
    const result = target === "auto_records" ? localAuto! : localVendor!;
    return { result, extract, plan: "local_parser", planReason: decision.reason };
  }

  const geminiResult = await runGeminiPlanB(target, buffer, fileName, text, extract);
  const warnings = "warnings" in geminiResult ? [...geminiResult.warnings] : [];
  if (decision.reason === "empty_text_layer") {
    warnings.unshift(
      extract.stage === "load_failed"
        ? `Teksta slānis neielādējās (${extract.errorMessage ?? "parser"}) — Plan B: Gemini.`
        : `Skenēts PDF (0 zīmes tekstā) — Plan B: Gemini.`,
    );
  } else if (decision.reason === "vendor_structure_unmatched" || decision.reason === "auto_records_structure_unmatched") {
    warnings.unshift("Avota struktūra neatpazīta lokāli — Plan B: Gemini.");
  } else if (decision.reason.includes("no_rows")) {
    warnings.unshift("Lokālā heuristika neatrada rindas — Plan B: Gemini.");
  }

  if ("warnings" in geminiResult) {
    geminiResult.warnings = warnings;
  }

  return {
    result: geminiResult,
    extract,
    plan: "gemini_fallback",
    planReason: decision.reason,
  };
}
