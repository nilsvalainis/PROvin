import "server-only";

import { getAnthropicApiKeyFromEnv } from "@/lib/admin-ai";
import { parseAutoRecordsPdfText, type AutoRecordsPdfParseResult } from "@/lib/auto-records-pdf-parse";
import { parseHistoryVendorPdfText } from "@/lib/history-vendor-pdf-import";
import { parseCarverticalPdfText } from "@/lib/carvertical-pdf-parse";
import type { HistoryVendorPdfParseResult, HistoryVendorPdfTarget } from "@/lib/history-vendor-pdf-import";
import type { PdfIngestEngine } from "@/lib/pdf-ingest-types";
import { extractPdfTextDetailed, type PdfExtractResult } from "@/lib/pdf-text-extract-server";
import type { CsddPdfParseResult } from "@/lib/csdd-pdf-ingest";
import { extractCsddPdfWithAiStructured } from "@/lib/csdd-ai-structured";
import { parseAutodnaDamageEvents } from "@/lib/autodna-damage-parse";
import { ltabRowHasData } from "@/lib/admin-source-blocks";
import {
  autoRecordsParseHasData,
  csddParseHasData,
  extractSourcePdfWithAi,
  vendorParseHasData,
} from "@/lib/source-pdf-ai-extract";
import {
  detectVendorPdfStructure,
  parseVendorPdfLocal,
  vendorLocalParseHasData,
} from "@/lib/vendor-pdf-local-parse";

function enrichCsddAiResult(result: CsddPdfParseResult): CsddPdfParseResult {
  return result;
}

const LOG_PREFIX = "[pdf-source-ingest]";
const MIN_TEXT_FOR_STRUCTURE = 40;

export type SourcePdfIngestTarget = HistoryVendorPdfTarget | "auto_records" | "csdd" | "citi_avoti";

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

function enrichCarverticalAiResult(
  result: HistoryVendorPdfParseResult,
  textHint: string,
): HistoryVendorPdfParseResult {
  const hint = textHint.trim();
  if (!hint) return result;
  const cv = parseCarverticalPdfText(hint);
  return {
    ...result,
    ...(cv.timeline.length > 0 && !(result.vehicleHistoryTimeline ?? []).length
      ? { vehicleHistoryTimeline: cv.timeline }
      : {}),
    ...(cv.damageDetails.length > 0 && !(result.damageDetails ?? []).length
      ? { damageDetails: cv.damageDetails }
      : {}),
    ...(result.serviceHistory.length === 0 && cv.serviceHistory.length > 0
      ? { serviceHistory: cv.serviceHistory }
      : {}),
    ...(result.incidents.length === 0 && cv.incidents.length > 0 ? { incidents: cv.incidents } : {}),
  };
}

function enrichAutodnaAiResult(
  result: HistoryVendorPdfParseResult,
  textHint: string,
): HistoryVendorPdfParseResult {
  const hint = textHint.trim();
  if (!hint) return result;
  const local = parseHistoryVendorPdfText("autodna", hint);
  const damageLocal = parseAutodnaDamageEvents(hint);
  const incidents =
    result.incidents.filter(ltabRowHasData).length >= damageLocal.length &&
    result.incidents.filter(ltabRowHasData).length >= local.incidents.filter(ltabRowHasData).length
      ? result.incidents
      : damageLocal.length > 0
        ? damageLocal
        : local.incidents;
  return {
    ...result,
    ...(result.serviceHistory.length === 0 && local.serviceHistory.length > 0
      ? { serviceHistory: local.serviceHistory }
      : {}),
    incidents,
    ...(local.damageDetails?.length && !(result.damageDetails ?? []).length
      ? { damageDetails: local.damageDetails }
      : {}),
    ...(local.vehicleHistoryTimeline?.length && !(result.vehicleHistoryTimeline ?? []).length
      ? { vehicleHistoryTimeline: local.vehicleHistoryTimeline }
      : {}),
  };
}

function enrichVendorAiResult(
  target: HistoryVendorPdfTarget,
  result: HistoryVendorPdfParseResult,
  textHint: string,
): HistoryVendorPdfParseResult {
  if (target === "carvertical") return enrichCarverticalAiResult(result, textHint);
  if (target === "autodna") return enrichAutodnaAiResult(result, textHint);
  return result;
}

async function runAiExtract(
  target: SourcePdfIngestTarget,
  buffer: ArrayBuffer,
  fileName: string,
  textHint: string,
  extract: PdfExtractResult,
  engine: PdfIngestEngine,
): Promise<HistoryVendorPdfParseResult | AutoRecordsPdfParseResult | CsddPdfParseResult> {
  if (!getAnthropicApiKeyFromEnv()) {
    throw new Error("missing_ai_key");
  }
  console.info(`${LOG_PREFIX} ai_extract`, { fileName, target, engine, stage: extract.stage });
  const result = await extractSourcePdfWithAi({ target, buffer, fileName, textHint });
  if (target === "csdd") {
    return withEngine(enrichCsddAiResult(result as CsddPdfParseResult), engine, extract.backend);
  }
  if ("incidents" in result) {
    const vendorTarget =
      target === "citi_avoti" ? "autodna" : target === "auto_records" ? null : (target as HistoryVendorPdfTarget);
    const enriched =
      vendorTarget != null
        ? enrichVendorAiResult(vendorTarget, result as HistoryVendorPdfParseResult, textHint)
        : (result as HistoryVendorPdfParseResult);
    return withEngine(enriched, engine, extract.backend);
  }
  return withEngine(result, engine, extract.backend);
}

function shouldUseLegacyPlanB(
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

  if (target === "csdd" || target === "citi_avoti") {
    return { use: true, reason: "ai_only_target" };
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

function parseHasData(
  target: SourcePdfIngestTarget,
  result: HistoryVendorPdfParseResult | AutoRecordsPdfParseResult | CsddPdfParseResult,
): boolean {
  if (target === "csdd") return csddParseHasData(result as CsddPdfParseResult);
  if (target === "citi_avoti" || "incidents" in result) {
    return vendorParseHasData(result as HistoryVendorPdfParseResult);
  }
  return autoRecordsParseHasData(result as AutoRecordsPdfParseResult);
}

/**
 * Viena PDF imports.
 * CSDD: tikai AI Structured Output (PDF pielikums + shēma).
 */
export async function ingestSourcePdfFile(opts: {
  target: SourcePdfIngestTarget;
  buffer: ArrayBuffer;
  fileName: string;
  /** false — tikai lokālais + vecais Plan B fallback. */
  preferAi?: boolean;
}): Promise<{
  result: HistoryVendorPdfParseResult | AutoRecordsPdfParseResult | CsddPdfParseResult;
  extract: PdfExtractResult;
  plan: PdfIngestEngine;
  planReason: string;
}> {
  const { target, buffer, fileName } = opts;
  const preferAi = opts.preferAi !== false;
  const extract = await extractPdfTextDetailed(buffer, { fileName });
  const text = extract.text;

  let localVendor: HistoryVendorPdfParseResult | undefined;
  let localAuto: AutoRecordsPdfParseResult | undefined;

  if (
    target !== "auto_records" &&
    target !== "csdd" &&
    target !== "citi_avoti" &&
    extract.textLayerCharCount >= MIN_TEXT_FOR_STRUCTURE
  ) {
    localVendor = parseVendorPdfLocal(target, text, { textBackend: extract.backend });
  } else if (target === "auto_records" && extract.textLayerCharCount >= MIN_TEXT_FOR_STRUCTURE) {
    localAuto = withEngine(parseAutoRecordsPdfText(text), "local_parser", extract.backend);
  }

  if (target === "csdd") {
    if (!preferAi || !getAnthropicApiKeyFromEnv()) {
      throw new Error("missing_ai_key");
    }
    const structured = await extractCsddPdfWithAiStructured({
      buffer,
      fileName,
      textHint: text,
    });
    if (!csddParseHasData(structured)) {
      console.warn(`${LOG_PREFIX} csdd_ai_sparse`, { fileName });
    }
    console.info(`${LOG_PREFIX} csdd_ai_only_ok`, {
      fileName,
      mileage: structured.fields.mileageHistory.filter((r) => r.odometer.trim()).length,
      taDefects: structured.fields.technicalInspectionHistory.reduce(
        (n, r) => n + (r.defects?.length ?? 0),
        0,
      ),
      prevDefects: structured.fields.prevInspectionBlock.defects?.length ?? 0,
    });
    return {
      result: withEngine(structured, "ai_primary", extract.backend),
      extract,
      plan: "ai_primary",
      planReason: "csdd_ai_only",
    };
  }

  if (
    localVendor &&
    vendorLocalParseHasData(localVendor) &&
    target !== "citi_avoti" &&
    extract.textLayerCharCount >= MIN_TEXT_FOR_STRUCTURE &&
    detectVendorPdfStructure(target as HistoryVendorPdfTarget, text).matched
  ) {
    console.info(`${LOG_PREFIX} vendor_text_layer_ok`, { fileName, target, backend: extract.backend });
    return {
      result: localVendor,
      extract,
      plan: "local_parser",
      planReason: "vendor_text_layer",
    };
  }

  if (localAuto && autoRecordsParseHasData(localAuto) && extract.textLayerCharCount >= MIN_TEXT_FOR_STRUCTURE) {
    return { result: localAuto, extract, plan: "local_parser", planReason: "auto_records_text_layer" };
  }

  if (preferAi && getAnthropicApiKeyFromEnv()) {
    try {
      const aiResult = await runAiExtract(
        target,
        buffer,
        fileName,
        text,
        extract,
        "ai_primary",
      );
      if (parseHasData(target, aiResult)) {
        return { result: aiResult, extract, plan: "ai_primary", planReason: "ai_default" };
      }
      console.warn(`${LOG_PREFIX} ai_empty`, { fileName, target });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`${LOG_PREFIX} ai_failed_fallback_local`, { fileName, target, msg });
    }
  }

  const decision = shouldUseLegacyPlanB(target, extract, text, localVendor, localAuto);

  if (!decision.use && localVendor) {
    console.info(`${LOG_PREFIX} plan_a_ok`, { fileName, target, reason: decision.reason, backend: extract.backend });
    return { result: localVendor, extract, plan: "local_parser", planReason: decision.reason };
  }
  if (!decision.use && localAuto) {
    console.info(`${LOG_PREFIX} plan_a_ok`, { fileName, target, reason: decision.reason, backend: extract.backend });
    return { result: localAuto, extract, plan: "local_parser", planReason: decision.reason };
  }

  if (getAnthropicApiKeyFromEnv()) {
    const aiResult = await runAiExtract(
      target,
      buffer,
      fileName,
      text,
      extract,
      "ai_fallback",
    );
    const warnings = "warnings" in aiResult ? [...aiResult.warnings] : [];
    if (decision.reason === "empty_text_layer") {
      warnings.unshift(
        extract.stage === "load_failed"
          ? `Teksta slānis neielādējās (${extract.errorMessage ?? "parser"}) — AI.`
          : `Skenēts PDF (0 zīmes tekstā) — AI.`,
      );
    } else if (
      decision.reason === "vendor_structure_unmatched" ||
      decision.reason === "auto_records_structure_unmatched"
    ) {
      warnings.unshift("Avota struktūra neatpazīta lokāli — AI.");
    } else if (decision.reason.includes("no_rows")) {
      warnings.unshift("Lokālā heuristika neatrada rindas — AI.");
    } else if (decision.reason === "ai_default") {
      /* noop */
    } else {
      warnings.unshift("AI fallback pēc lokālā neveiksmīgā mēģinājuma.");
    }
    if ("warnings" in aiResult) {
      aiResult.warnings = warnings;
    }
    return {
      result: aiResult,
      extract,
      plan: "ai_fallback",
      planReason: decision.reason,
    };
  }

  const fallback = target === "auto_records" ? localAuto : localVendor;
  if (fallback && parseHasData(target, fallback)) {
    return { result: fallback, extract, plan: "local_parser", planReason: "no_ai_key" };
  }

  throw new Error("missing_ai_key");
}
