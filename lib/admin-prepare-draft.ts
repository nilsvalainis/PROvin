import "server-only";

import {
  detectSourcePdfIngestTarget,
  labelFromUnknownPdfFileName,
} from "@/lib/admin-source-pdf-detect";
import { generateIncidentsSummaryWithAi } from "@/lib/admin-ai-incidents-summary";
import { generateMileageCommentWithAi } from "@/lib/admin-ai-mileage-comment";
import type { AiOrderContextInput } from "@/lib/admin-ai-order-context";
import { generateSourceCommentWithAi } from "@/lib/admin-ai-source-comment";
import { generateSourcesComparisonWithAi } from "@/lib/admin-ai-sources-comparison";
import { AI_ADMIN_FIELD_DEFAULT_TIER } from "@/lib/ai-admin-field-defaults";
import {
  applySourceBlockGeneratedComment,
  AI_SOURCE_COMMENT_BLOCK_KEYS,
  sourceBlockCommentsPlainForAi,
  sourceBlockHasDataExcludingComments,
  type AiSourceCommentBlockKey,
} from "@/lib/admin-source-comment-blocks";
import {
  aiExpertSourceCommentToRichHtml,
  adminRichHtmlToPlainText,
} from "@/lib/admin-rich-comment-html";
import type { AutoRecordsPdfParseResult } from "@/lib/auto-records-pdf-parse";
import { mergeAutoRecordsServiceHistory } from "@/lib/auto-records-pdf-parse";
import {
  ADMIN_MILEAGE_PASTE_RAW_MAX_LEN,
  ADMIN_PDF_IMPORT_RAW_MAX_LEN,
  ADMIN_RAW_UNPROCESSED_MAX_LEN,
} from "@/lib/admin-raw-field-limits";
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
import { mergeDamageDetailRows } from "@/lib/vendor-damage-hydrate";
import { extractPdfTextDetailed } from "@/lib/pdf-text-extract-server";
import { ingestSourcePdfFile, type SourcePdfIngestTarget } from "@/lib/pdf-source-ingest";
import type { PdfIngestEngine } from "@/lib/pdf-ingest-types";
import {
  classifyPdfIngestTargetWithAi,
  type CsddPdfParseResult,
} from "@/lib/source-pdf-ai-extract";

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
    ...(raw ? { mileagePasteRaw: raw.slice(0, ADMIN_MILEAGE_PASTE_RAW_MAX_LEN) } : {}),
    ...(nextService.length > 0 ? { serviceHistory: nextService } : {}),
    ...(nextIncidents.length > 0 ? { incidents: nextIncidents } : {}),
    ...(result.vehicleHistoryTimeline?.length ? { vehicleHistoryTimeline: result.vehicleHistoryTimeline } : {}),
    ...(result.damageDetails?.length
      ? { damageDetails: mergeDamageDetailRows(existing.damageDetails ?? [], result.damageDetails) }
      : {}),
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
    ...(result.rawText.trim() ? { pdfImportRaw: result.rawText.trim().slice(0, ADMIN_PDF_IMPORT_RAW_MAX_LEN) } : {}),
  };
}

function applyAutoRecordsImport(
  existing: AutoRecordsBlockState,
  result: AutoRecordsPdfParseResult,
): AutoRecordsBlockState {
  return {
    ...existing,
    ...(result.rawUnprocessedData.trim()
      ? { rawUnprocessedData: result.rawUnprocessedData.trim().slice(0, ADMIN_RAW_UNPROCESSED_MAX_LEN) }
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
    ...(raw ? { rawUnprocessedData: raw.slice(0, ADMIN_RAW_UNPROCESSED_MAX_LEN) } : {}),
    comments: existing.comments || imported.comments,
    aiContextRaw: existing.aiContextRaw || imported.aiContextRaw,
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
      result.rawText.trim().slice(0, ADMIN_PDF_IMPORT_RAW_MAX_LEN) || existing.rawUnprocessedData || "",
  };
  return { sections };
}

function plainCommentToHtml(_blockKey: AiSourceCommentBlockKey, plain: string): string {
  return aiExpertSourceCommentToRichHtml(plain);
}

function countSourcesWithData(blocks: WorkspaceSourceBlocks): number {
  return AI_SOURCE_COMMENT_BLOCK_KEYS.filter((k) =>
    sourceBlockHasDataExcludingComments(k, blocks),
  ).length;
}

/**
 * Portfeļa PDF → avotu bloki + AI ✨ komentāru melnraksts.
 */
export async function runPrepareDraftPipeline(input: {
  pdfs: PrepareDraftPdfInput[];
  context: AiOrderContextInput;
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
      const classified = await classifyPdfIngestTargetWithAi({
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
        preferAi: true,
      });
      const engineLabel =
        plan === "ai_primary" ? "Claude Sonnet (PDF)" : plan === "ai_fallback" ? "AI (fallback)" : "lokāli";

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

  const commentTier = AI_ADMIN_FIELD_DEFAULT_TIER.source_comment;
  const synthesisTier = AI_ADMIN_FIELD_DEFAULT_TIER.mileage;
  const ctxBase: AiOrderContextInput = { ...input.context, sourceBlocks: blocks, modelTier: commentTier };

  /** Avotu komentāri paralēli — sākuma Prepare Draft brīdī sibling komentāru vēl nav; mileage/negadījumi secīgi pēc tam. */
  const commentJobs = AI_SOURCE_COMMENT_BLOCK_KEYS.map(async (blockKey) => {
    const stepId = `comment:${blockKey}`;
    if (!sourceBlockHasDataExcludingComments(blockKey, blocks)) {
      return {
        blockKey,
        step: {
          id: stepId,
          label: `Komentārs: ${blockKey}`,
          status: "skipped" as const,
          detail: "Nav avota datu",
        },
        html: null as string | null,
      };
    }
    try {
      const existingPlain = adminRichHtmlToPlainText(
        sourceBlockCommentsPlainForAi(blockKey, blocks),
      ).trim();
      const text = await generateSourceCommentWithAi({
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
        modelTier: commentTier,
      });
      const html = text.trim() ? plainCommentToHtml(blockKey, text) : null;
      return {
        blockKey,
        step: { id: stepId, label: `Komentārs: ${blockKey}`, status: "ok" as const },
        html,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return {
        blockKey,
        step: {
          id: stepId,
          label: `Komentārs: ${blockKey}`,
          status: "error" as const,
          detail: msg,
        },
        html: null as string | null,
        warning: `Komentārs (${blockKey}): ${msg}`,
      };
    }
  });

  const commentResults = await Promise.all(commentJobs);
  for (const result of commentResults) {
    steps.push(result.step);
    if (result.warning) warnings.push(result.warning);
    if (result.html) {
      const prevBlock = blocks[result.blockKey];
      blocks = {
        ...blocks,
        [result.blockKey]: applySourceBlockGeneratedComment(result.blockKey, prevBlock, result.html),
      };
    }
  }

  const ctxAfterComments: AiOrderContextInput = { ...ctxBase, sourceBlocks: blocks, modelTier: synthesisTier };

  try {
    const mileageText = await generateMileageCommentWithAi(ctxAfterComments);
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
    const incidentsText = await generateIncidentsSummaryWithAi(ctxAfterComments);
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
      const comparisonText = await generateSourcesComparisonWithAi(ctxAfterComments);
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
    case "ai_primary":
      return "Claude Sonnet (PDF vizuāli)";
    case "ai_fallback":
      return "Claude Sonnet (fallback)";
    default:
      return "Lokālais parsers";
  }
}
