/**
 * Admin: vairāki vēstures PDF → teksts (Plan A: pdf-parse) + Gemini tikai skenētiem PDF (Plan B).
 */
import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { assertGeminiAllowedForSession } from "@/lib/admin-gemini-demo-guard";
import { getGeminiApiKeyFromEnv } from "@/lib/admin-gemini";
import { detectHistoryPdfKind } from "@/lib/admin-portfolio-pdf-analysis";
import {
  PDF_MAX_FILE_BYTES,
  PDF_MAX_FILES,
  PDF_MAX_TOTAL_BYTES,
  PDF_GEMINI_INLINE_MAX_BYTES,
} from "@/lib/pdf-api-limits";
import {
  extractVehicleDataWithGemini,
  type PdfInlineAttachment,
  type PdfTextBundle,
} from "@/lib/admin-vehicle-reports-gemini";
import type { PdfIngestEngine } from "@/lib/pdf-ingest-types";
import {
  extractPdfTextDetailed,
  logPdfExtractResult,
  MIN_USABLE_TEXT_CHARS,
} from "@/lib/pdf-text-extract-server";
import { patchOrderDraft, readOrderDraft, isSafeOrderDraftSessionId } from "@/lib/admin-order-draft-store";
import type { OrderDraftWorkspaceBody } from "@/lib/admin-order-draft-types";
import { coalesceOrderDraftWorkspacePatch } from "@/lib/admin-order-draft-workspace-merge";
import { createDefaultSourceBlocks } from "@/lib/admin-source-blocks";
import type { VehicleAiExtractionMeta } from "@/lib/vehicle-ai-extraction-types";

export const maxDuration = 120;
export const runtime = "nodejs";

const LOG_PREFIX = "[admin/reports/ai-extract]";

const SOURCE_HINT: Record<string, string> = {
  euro_network: "CarVertical / platā Eiropas datu bāze",
  regional_alt: "AutoDNA / reģionāls formāts",
  registry_focus: "Auto Records / reģistrs",
  generic: "Vēstures PDF",
};

function isPdfFile(file: File): boolean {
  const mime = (file.type || "").toLowerCase();
  const name = (file.name || "").toLowerCase();
  if (mime && mime !== "application/pdf" && !mime.includes("pdf")) return false;
  if (name && !name.endsWith(".pdf")) return false;
  return true;
}

/** Plan B — tikai ja teksta slānis tukšs vai īss (skenēts PDF). */
function needsGeminiInlinePdf(extracted: Awaited<ReturnType<typeof extractPdfTextDetailed>>): boolean {
  if (extracted.stage === "load_failed") return true;
  if (extracted.textLayerCharCount === 0) return true;
  if (!extracted.ok && extracted.textLayerCharCount < MIN_USABLE_TEXT_CHARS) return true;
  return false;
}

/** Pagaidām atslēgts — admin sadaļa „Sistēmas anomālijas un AI analīze” tiks pārbūvēta. */
const AI_EXTRACT_DISABLED = true;

export async function POST(req: Request) {
  if (AI_EXTRACT_DISABLED) {
    return NextResponse.json(
      {
        error: "feature_disabled",
        detail: "Sistēmas anomālijas un AI analīze pagaidām nav pieejama.",
      },
      { status: 410 },
    );
  }

  const ok = await getAdminSession();
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (!getGeminiApiKeyFromEnv()) {
    return NextResponse.json({ error: "missing_gemini_key" }, { status: 503 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    console.error(`${LOG_PREFIX} formData_failed`, msg);
    return NextResponse.json(
      {
        error: "payload_too_large",
        detail:
          "Neizdevās nolasīt augšupielādi (iespējams pārāk liels kopējais apjoms). Samazini failu skaitu vai izmēru (maks. ~48 MB kopā).",
      },
      { status: 413 },
    );
  }

  const sessionId = String(form.get("sessionId") ?? "").trim();
  const guard = await assertGeminiAllowedForSession(sessionId);
  if (!guard.ok) {
    return NextResponse.json(
      { error: guard.error, ...(guard.detail ? { detail: guard.detail } : {}) },
      { status: guard.status },
    );
  }

  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    const single = form.get("file");
    if (single instanceof File) files.push(single);
  }
  if (files.length === 0) {
    return NextResponse.json({ error: "missing_files", detail: "Pievieno vismaz vienu PDF" }, { status: 400 });
  }
  if (files.length > PDF_MAX_FILES) {
    return NextResponse.json(
      { error: "too_many_files", detail: `Maks. ${PDF_MAX_FILES} PDF vienā pieprasījumā` },
      { status: 400 },
    );
  }

  const totalBytes = files.reduce((a, f) => a + f.size, 0);
  if (totalBytes > PDF_MAX_TOTAL_BYTES) {
    return NextResponse.json(
      {
        error: "payload_too_large",
        detail: `Kopējais PDF apjoms pārsniedz limitu (~${Math.round(PDF_MAX_TOTAL_BYTES / (1024 * 1024))} MB)`,
      },
      { status: 413 },
    );
  }

  const bundles: PdfTextBundle[] = [];
  const pdfAttachments: PdfInlineAttachment[] = [];
  const warnings: string[] = [];
  const extractLog: Array<Record<string, unknown>> = [];
  const enginesPerFile: PdfIngestEngine[] = [];

  for (const file of files) {
    if (!isPdfFile(file)) {
      return NextResponse.json({ error: "invalid_file_type", detail: `${file.name}: tikai PDF` }, { status: 400 });
    }
    if (file.size <= 0) {
      return NextResponse.json({ error: "empty_file", detail: file.name }, { status: 400 });
    }
    if (file.size > PDF_MAX_FILE_BYTES) {
      return NextResponse.json(
        {
          error: "file_too_large",
          detail: `${file.name}: maks. ${Math.round(PDF_MAX_FILE_BYTES / (1024 * 1024))} MB`,
        },
        { status: 413 },
      );
    }

    let buffer: ArrayBuffer;
    try {
      buffer = await file.arrayBuffer();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "unknown";
      console.error(`${LOG_PREFIX} arrayBuffer_failed`, { fileName: file.name, msg });
      warnings.push(`${file.name}: neizdevās nolasīt faila saturu (${msg})`);
      extractLog.push({ fileName: file.name, stage: "buffer_read_failed", errorMessage: msg });
      continue;
    }

    const kind = detectHistoryPdfKind(file.name, "");
    const sourceHint = SOURCE_HINT[kind] ?? SOURCE_HINT.generic;

    const extracted = await extractPdfTextDetailed(buffer, { fileName: file.name });
    logPdfExtractResult(LOG_PREFIX, extracted);

    const useInline = needsGeminiInlinePdf(extracted);
    const fileEngine: PdfIngestEngine = useInline ? "gemini_fallback" : "local_parser";
    enginesPerFile.push(fileEngine);

    if (useInline) {
      if (file.size <= PDF_GEMINI_INLINE_MAX_BYTES) {
        pdfAttachments.push({ fileName: file.name, sourceHint, buffer });
        warnings.push(
          `${file.name}: skenēts PDF — Plan B (Gemini lasa attēlu, ${extracted.textLayerCharCount} zīmes tekstā).`,
        );
      } else {
        warnings.push(
          `${file.name}: skenēts, bet fails pārāk liels inline Gemini (~18 MB) — tikai īss teksta fragments.`,
        );
      }
    }

    const textForBundle = extracted.text.trim();
    if (textForBundle.length > 0) {
      bundles.push({
        fileName: file.name,
        text: textForBundle,
        sourceHint,
      });
      if (!useInline) {
        warnings.push(`${file.name}: Plan A (lokāls teksts, ${extracted.backend}, ${extracted.textLayerCharCount} zīmes).`);
      }
    }

    extractLog.push({
      fileName: file.name,
      stage: extracted.stage,
      backend: extracted.backend,
      pageCount: extracted.pageCount,
      textLayerCharCount: extracted.textLayerCharCount,
      fileBytes: file.size,
      engine: fileEngine,
      sentInlineToGemini: pdfAttachments.some((p) => p.fileName === file.name),
    });
  }

  if (pdfAttachments.length === 0 && bundles.length === 0) {
    console.error(`${LOG_PREFIX} no_input`, { sessionId, extractLog, warnings });
    return NextResponse.json(
      {
        error: "no_pdf_input",
        detail: warnings.join("; ") || "Neizdevās sagatavot PDF analīzei.",
        extractLog,
      },
      { status: 422 },
    );
  }

  const aggregateEngine: PdfIngestEngine =
    pdfAttachments.length > 0 ? "gemini_fallback" : "local_parser";

  console.info(`${LOG_PREFIX} gemini_start`, {
    sessionId,
    aggregateEngine,
    textBundles: bundles.length,
    inlinePdfs: pdfAttachments.length,
  });

  try {
    const extraction = await extractVehicleDataWithGemini({ textBundles: bundles, pdfAttachments });
    const analyzedAt = new Date().toISOString();
    const meta: VehicleAiExtractionMeta & {
      engine?: PdfIngestEngine;
      enginesPerFile?: PdfIngestEngine[];
      charCounts?: number[];
      usedGeminiInlinePdf?: string[];
      extractLog?: typeof extractLog;
    } = {
      analyzedAt,
      fileNames: files.map((f) => f.name),
      sources: [...bundles.map((b) => b.sourceHint), ...pdfAttachments.map((p) => p.sourceHint)],
      engine: aggregateEngine,
      enginesPerFile,
      charCounts: bundles.map((b) => b.text.length),
      usedGeminiInlinePdf: pdfAttachments.map((p) => p.fileName),
      extractLog,
    };

    if (sessionId && isSafeOrderDraftSessionId(sessionId)) {
      try {
        const prev = await readOrderDraft(sessionId);
        const prevW = prev?.workspace;
        const incoming: OrderDraftWorkspaceBody = {
          sourceBlocks: prevW?.sourceBlocks ?? createDefaultSourceBlocks(),
          iriss: prevW?.iriss ?? "",
          apskatesPlāns: prevW?.apskatesPlāns ?? "",
          cenasAtbilstiba: prevW?.cenasAtbilstiba ?? "",
          previewConfirmed: prevW?.previewConfirmed ?? false,
          pdfVisibility: prevW?.pdfVisibility,
          pdfBannerInclude: prevW?.pdfBannerInclude,
          vehicleAiExtraction: extraction,
          vehicleAiExtractionMeta: meta,
        };
        const { workspace } = coalesceOrderDraftWorkspacePatch(incoming, prevW ?? null, sessionId);
        const persistResult = await patchOrderDraft(sessionId, { workspace });
        if (persistResult.ok && persistResult.durable) {
          console.info("[ai_extract:persist]", {
            sessionId,
            storageBackend: persistResult.storageBackend,
            workspaceRevision: persistResult.workspaceRevision,
          });
        } else {
          const err = !persistResult.ok ? persistResult.error : "store_not_durable";
          console.warn("[ai_extract:persist]", { sessionId, error: err });
          warnings.push(
            err === "store_not_durable" ?
              "Servera melnraksts nav ilgtermiņa — iestati ADMIN_ORDER_DRAFT_BLOB_PREFIX + BLOB_READ_WRITE_TOKEN."
            : `Servera saglabāšana neizdevās: ${err}`,
          );
        }
      } catch (e) {
        console.warn("[ai_extract:persist]", {
          sessionId,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    return NextResponse.json({
      ok: true,
      extraction,
      meta,
      warnings,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    console.error(`${LOG_PREFIX} gemini_failed`, { sessionId, msg, extractLog });
    if (msg === "gemini_invalid_json") {
      return NextResponse.json({ error: "gemini_invalid_json", detail: "Nevalīds JSON no Gemini" }, { status: 502 });
    }
    if (msg === "no_pdf_text") {
      return NextResponse.json(
        {
          error: "extraction_failed",
          detail: "Gemini nesaņēma izmantojamu ievdi.",
          extractLog,
        },
        { status: 502 },
      );
    }
    return NextResponse.json({ error: "extraction_failed", detail: msg, extractLog }, { status: 502 });
  }
}
