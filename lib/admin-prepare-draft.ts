import "server-only";

import {
  detectSourcePdfIngestTarget,
  labelFromUnknownPdfFileName,
} from "@/lib/admin-source-pdf-detect";
import { generateIncidentsSummaryWithGemini } from "@/lib/admin-gemini-incidents-summary";
import { generateMileageCommentWithGemini } from "@/lib/admin-gemini-mileage-comment";
import type { GeminiOrderContextInput } from "@/lib/admin-gemini-order-context";
import { generateSourceCommentWithGemini } from "@/lib/admin-gemini-source-comment";
import { generateSourcesComparisonWithGemini } from "@/lib/admin-gemini-sources-comparison";
import {
  applySourceBlockGeneratedComment,
  GEMINI_SOURCE_COMMENT_BLOCK_KEYS,
  isMainAnalysisSourceBlock,
  sourceBlockCommentsPlainForGemini,
  sourceBlockHasDataExcludingComments,
  type GeminiSourceCommentBlockKey,
} from "@/lib/admin-source-comment-blocks";
import {
  geminiExpertSourceCommentToRichHtml,
  geminiPlainTextToRichHtml,
  adminRichHtmlToPlainText,
} from "@/lib/admin-rich-comment-html";
import type { AutoRecordsPdfParseResult } from "@/lib/auto-records-pdf-parse";
import { mergeAutoRecordsServiceHistory } from "@/lib/auto-records-pdf-parse";
import {
  citiAvotiSectionHasContent,
  emptyCitiAvotiSection,
  mergeSourceBlocksWithDefaults,
  normalizeSourcePdfChecklist,
  sourcePdfChecklistHasAny,
  type AutoRecordsBlockState,
  type CitiAvotiBlockState,
  type CsddFormFields,
  type LtabBlockState,
  type VendorAvotuBlockState,
  type WorkspaceSourceBlocks,
} from "@/lib/admin-source-blocks";
import type { HistoryVendorPdfParseResult, HistoryVendorPdfTarget } from "@/lib/history-vendor-pdf-import";
import { mergeLtabIncidentRows, mergeVendorServiceHistory } from "@/lib/history-vendor-pdf-import";
import { extractPdfTextDetailed } from "@/lib/pdf-text-extract-server";
import { ingestSourcePdfFile, type SourcePdfIngestTarget } from "@/lib/pdf-source-ingest";
import type { PdfIngestEngine } from "@/lib/pdf-ingest-types";
import {
  classifyPdfIngestTargetWithGemini,
  type CsddPdfParseResult,
} from "@/lib/source-pdf-gemini-extract";

export type PrepareDraftStep = {
  id: string;
  label: string;
  status: "ok" | "skipped" | "error";
  detail?: string;
};

export type PrepareDraftResult = {
  sourceBlocks: WorkspaceSourceBlocks;
  orderEdits: {
    internalComment?: string;
    mileageComment?: string;
    sourcesComparisonComment?: string;
    vin?: string;
  };
  steps: PrepareDraftStep[];
  warnings: string[];
};

export type PrepareDraftPdfInput = {
  fileName: string;
  buffer: ArrayBuffer;
  /** Ja nav — tiek noteikts pēc nosaukuma/teksta. */
  target?: SourcePdfIngestTarget | null;
};

function applyVendorImport(
  existing: VendorAvotuBlockState,
  result: HistoryVendorPdfParseResult,
): VendorAvotuBlockState {
  const raw = result.rawText.trim();
  const nextService =
    result.serviceHistory.length > 0
      ? mergeVendorServiceHistory(existing.serviceHistory ?? [], result.serviceHistory)
      : existing.serviceHistory;
  const nextIncidents =
    result.incidents.length > 0
      ? mergeLtabIncidentRows(existing.incidents ?? [], result.incidents)
      : existing.incidents;
  const checklist = normalizeSourcePdfChecklist({
    ...existing.pdfChecklist,
    ...result.suggestedPdfChecklist,
  });
  return {
    ...existing,
    ...(raw ? { mileagePasteRaw: raw.slice(0, 24_000) } : {}),
    ...(nextService.length > 0 ? { serviceHistory: nextService } : {}),
    ...(nextIncidents.length > 0 ? { incidents: nextIncidents } : {}),
    ...(result.vehicleHistoryTimeline?.length ? { vehicleHistoryTimeline: result.vehicleHistoryTimeline } : {}),
    ...(result.damageDetails?.length ? { damageDetails: result.damageDetails } : {}),
    ...(sourcePdfChecklistHasAny(checklist) ? { pdfChecklist: checklist } : {}),
  };
}

function applyLtabImport(existing: LtabBlockState, result: HistoryVendorPdfParseResult): LtabBlockState {
  return {
    ...existing,
    rows:
      result.incidents.length > 0
        ? mergeLtabIncidentRows(existing.rows, result.incidents)
        : existing.rows,
    ...(result.rawText.trim() ? { pdfImportRaw: result.rawText.trim().slice(0, 120_000) } : {}),
  };
}

function applyAutoRecordsImport(
  existing: AutoRecordsBlockState,
  result: AutoRecordsPdfParseResult,
): AutoRecordsBlockState {
  return {
    ...existing,
    ...(result.rawUnprocessedData.trim()
      ? { rawUnprocessedData: result.rawUnprocessedData.trim().slice(0, 500_000) }
      : {}),
    ...(result.serviceHistory.length > 0
      ? { serviceHistory: mergeAutoRecordsServiceHistory(existing.serviceHistory, result.serviceHistory) }
      : {}),
  };
}

function vendorBlockKey(target: HistoryVendorPdfTarget): "autodna" | "carvertical" {
  return target === "carvertical" ? "carvertical" : "autodna";
}

function applyCsddImport(existing: CsddFormFields, result: CsddPdfParseResult): CsddFormFields {
  const raw = result.rawUnprocessedData.trim();
  const imported = result.fields;
  return {
    ...existing,
    ...imported,
    ...(raw ? { rawUnprocessedData: raw.slice(0, 500_000) } : {}),
    comments: existing.comments || imported.comments,
    geminiContextRaw: existing.geminiContextRaw || imported.geminiContextRaw,
  };
}

function applyCitiAvotiImport(
  block: CitiAvotiBlockState,
  result: HistoryVendorPdfParseResult,
  label: string,
): CitiAvotiBlockState {
  const sections = [...(block.sections ?? [])];
  let idx = sections.findIndex((s) => !citiAvotiSectionHasContent(s));
  if (idx < 0) {
    sections.push(emptyCitiAvotiSection());
    idx = sections.length - 1;
  }
  const existing = sections[idx] ?? emptyCitiAvotiSection();
  const merged = applyVendorImport(existing, result);
  sections[idx] = {
    ...merged,
    label: label.trim() || existing.label || "",
    rawUnprocessedData:
      result.rawText.trim().slice(0, 120_000) || existing.rawUnprocessedData || "",
  };
  return { sections };
}

function plainCommentToHtml(blockKey: GeminiSourceCommentBlockKey, plain: string): string {
  return isMainAnalysisSourceBlock(blockKey)
    ? geminiExpertSourceCommentToRichHtml(plain)
    : geminiPlainTextToRichHtml(plain);
}

function countSourcesWithData(blocks: WorkspaceSourceBlocks): number {
  return GEMINI_SOURCE_COMMENT_BLOCK_KEYS.filter((k) =>
    sourceBlockHasDataExcludingComments(k, blocks),
  ).length;
}

/**
 * Portfeļa PDF → avotu bloki + Gemini ✨ komentāru melnraksts.
 */
export async function runPrepareDraftPipeline(input: {
  pdfs: PrepareDraftPdfInput[];
  context: GeminiOrderContextInput;
  /** Ģenerēt avotu / kopsavilkuma komentārus pēc importa. */
  generateComments?: boolean;
}): Promise<PrepareDraftResult> {
  const generateComments = input.generateComments !== false;
  const steps: PrepareDraftStep[] = [];
  const warnings: string[] = [];
  let blocks = mergeSourceBlocksWithDefaults(input.context.sourceBlocks);
  const orderEdits: PrepareDraftResult["orderEdits"] = {};

  for (const pdf of input.pdfs) {
    const stepId = `pdf:${pdf.fileName}`;
    const quick = await extractPdfTextDetailed(pdf.buffer, { fileName: pdf.fileName });
    let target = pdf.target ?? detectSourcePdfIngestTarget(pdf.fileName, quick.text);
    let citiLabel = labelFromUnknownPdfFileName(pdf.fileName);
    if (!target) {
      const classified = await classifyPdfIngestTargetWithGemini({
        buffer: pdf.buffer,
        fileName: pdf.fileName,
        textHint: quick.text,
      });
      target = classified.target;
      if (classified.label) citiLabel = classified.label;
    }

    try {
      const { result, plan } = await ingestSourcePdfFile({
        target,
        buffer: pdf.buffer,
        fileName: pdf.fileName,
        preferGemini: true,
      });
      const engineLabel =
        plan === "gemini_primary" ? "Gemini Pro (PDF)" : plan === "gemini_fallback" ? "Gemini (fallback)" : "lokāli";

      if (target === "auto_records") {
        blocks = {
          ...blocks,
          auto_records: applyAutoRecordsImport(blocks.auto_records, result as AutoRecordsPdfParseResult),
        };
      } else if (target === "ltab") {
        blocks = {
          ...blocks,
          ltab: applyLtabImport(blocks.ltab, result as HistoryVendorPdfParseResult),
        };
      } else if (target === "csdd") {
        blocks = {
          ...blocks,
          csdd: applyCsddImport(blocks.csdd, result as CsddPdfParseResult),
        };
      } else if (target === "citi_avoti") {
        blocks = {
          ...blocks,
          citi_avoti: applyCitiAvotiImport(
            blocks.citi_avoti,
            result as HistoryVendorPdfParseResult,
            citiLabel,
          ),
        };
      } else {
        const key = vendorBlockKey(target);
        blocks = {
          ...blocks,
          [key]: applyVendorImport(blocks[key], result as HistoryVendorPdfParseResult),
        };
      }

      if ("warnings" in result && result.warnings.length > 0) {
        warnings.push(...result.warnings.slice(0, 3).map((w) => `${pdf.fileName}: ${w}`));
      }

      const targetLabel =
        target === "citi_avoti" ? `citi_avoti (${citiLabel})` : target;
      steps.push({
        id: stepId,
        label: pdf.fileName,
        status: "ok",
        detail: `${targetLabel} · ${engineLabel}`,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      steps.push({ id: stepId, label: pdf.fileName, status: "error", detail: msg });
      warnings.push(`${pdf.fileName}: ${msg}`);
    }
  }

  if (!generateComments) {
    return { sourceBlocks: blocks, orderEdits, steps, warnings };
  }

  const ctxBase: GeminiOrderContextInput = { ...input.context, sourceBlocks: blocks };

  for (const blockKey of GEMINI_SOURCE_COMMENT_BLOCK_KEYS) {
    const stepId = `comment:${blockKey}`;
    if (!sourceBlockHasDataExcludingComments(blockKey, blocks)) {
      steps.push({ id: stepId, label: `Komentārs: ${blockKey}`, status: "skipped", detail: "Nav avota datu" });
      continue;
    }
    try {
      const existingPlain = adminRichHtmlToPlainText(
        sourceBlockCommentsPlainForGemini(blockKey, blocks),
      ).trim();
      const text = await generateSourceCommentWithGemini({
        sessionId: ctxBase.sessionId,
        blockKey,
        vin: ctxBase.vin,
        listingUrl: ctxBase.listingUrl,
        customerName: ctxBase.customerName,
        notes: ctxBase.notes,
        sourceBlocks: blocks,
        internalComment: ctxBase.internalComment,
        mileageComment: ctxBase.mileageComment,
        existingDraftPlain: existingPlain,
      });
      if (text.trim()) {
        const html = plainCommentToHtml(blockKey, text);
        const prevBlock = blocks[blockKey];
        blocks = {
          ...blocks,
          [blockKey]: applySourceBlockGeneratedComment(blockKey, prevBlock, html),
        };
      }
      steps.push({ id: stepId, label: `Komentārs: ${blockKey}`, status: "ok" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      steps.push({ id: stepId, label: `Komentārs: ${blockKey}`, status: "error", detail: msg });
      warnings.push(`Komentārs (${blockKey}): ${msg}`);
    }
  }

  const ctxAfterComments: GeminiOrderContextInput = { ...ctxBase, sourceBlocks: blocks };

  try {
    const mileageText = await generateMileageCommentWithGemini(ctxAfterComments);
    if (mileageText.trim()) {
      orderEdits.mileageComment = mileageText.trim();
      steps.push({ id: "comment:mileage", label: "Nobraukuma komentārs", status: "ok" });
    } else {
      steps.push({ id: "comment:mileage", label: "Nobraukuma komentārs", status: "skipped" });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    steps.push({ id: "comment:mileage", label: "Nobraukuma komentārs", status: "error", detail: msg });
    warnings.push(`Nobraukuma komentārs: ${msg}`);
  }

  try {
    const incidentsText = await generateIncidentsSummaryWithGemini(ctxAfterComments);
    if (incidentsText.trim()) {
      orderEdits.internalComment = incidentsText.trim();
      steps.push({ id: "comment:incidents", label: "Negadījumu kopsavilkums", status: "ok" });
    } else {
      steps.push({ id: "comment:incidents", label: "Negadījumu kopsavilkums", status: "skipped" });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    steps.push({ id: "comment:incidents", label: "Negadījumu kopsavilkums", status: "error", detail: msg });
    warnings.push(`Negadījumu kopsavilkums: ${msg}`);
  }

  if (countSourcesWithData(blocks) >= 2) {
    try {
      const comparisonText = await generateSourcesComparisonWithGemini(ctxAfterComments);
      if (comparisonText.trim()) {
        orderEdits.sourcesComparisonComment = comparisonText.trim();
        steps.push({ id: "comment:sources-comparison", label: "Avotu salīdzinājums", status: "ok" });
      } else {
        steps.push({ id: "comment:sources-comparison", label: "Avotu salīdzinājums", status: "skipped" });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      steps.push({
        id: "comment:sources-comparison",
        label: "Avotu salīdzinājums",
        status: "error",
        detail: msg,
      });
      warnings.push(`Avotu salīdzinājums: ${msg}`);
    }
  } else {
    steps.push({
      id: "comment:sources-comparison",
      label: "Avotu salīdzinājums",
      status: "skipped",
      detail: "Nepieciešami vismaz 2 avoti ar datiem",
    });
  }

  return { sourceBlocks: blocks, orderEdits, steps, warnings };
}

export function formatPrepareDraftEngineLabel(plan: PdfIngestEngine): string {
  switch (plan) {
    case "gemini_primary":
      return "Gemini Pro (PDF vizuāli)";
    case "gemini_fallback":
      return "Gemini Pro (fallback)";
    default:
      return "Lokālais parsers";
  }
}
