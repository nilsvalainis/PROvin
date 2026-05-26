/**
 * Admin: vairāki vēstures PDF → teksts un/vai inline PDF → Gemini JSON.
 * POST multipart/form-data: sessionId, files[] (application/pdf).
 */
import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { assertGeminiAllowedForSession } from "@/lib/admin-gemini-demo-guard";
import { getGeminiApiKeyFromEnv } from "@/lib/admin-gemini";
import { detectHistoryPdfKind } from "@/lib/admin-portfolio-pdf-analysis";
import {
  extractVehicleDataWithGemini,
  type PdfInlineAttachment,
  type PdfTextBundle,
} from "@/lib/admin-vehicle-reports-gemini";
import {
  extractPdfTextDetailed,
  logPdfExtractResult,
  MIN_USABLE_TEXT_CHARS,
} from "@/lib/pdf-text-extract-server";

export const maxDuration = 120;
export const runtime = "nodejs";

const LOG_PREFIX = "[admin/reports/ai-extract]";
const MAX_PDF_BYTES = 12 * 1024 * 1024;
const MAX_FILES = 8;

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

export async function POST(req: Request) {
  const ok = await getAdminSession();
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (!getGeminiApiKeyFromEnv()) {
    return NextResponse.json({ error: "missing_gemini_key" }, { status: 503 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid_form_data" }, { status: 400 });
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
    return NextResponse.json({ error: "missing_files", detail: "Pievieno vismaz vienu PDF" }, { status: 400 });
  }
  if (files.length > MAX_FILES) {
    return NextResponse.json(
      { error: "too_many_files", detail: `Maks. ${MAX_FILES} PDF vienā pieprasījumā` },
      { status: 400 },
    );
  }

  const bundles: PdfTextBundle[] = [];
  const pdfAttachments: PdfInlineAttachment[] = [];
  const warnings: string[] = [];
  const extractLog: Array<Record<string, unknown>> = [];

  for (const file of files) {
    if (!isPdfFile(file)) {
      return NextResponse.json({ error: "invalid_file_type", detail: `${file.name}: tikai PDF` }, { status: 400 });
    }
    if (file.size <= 0) {
      return NextResponse.json({ error: "empty_file", detail: file.name }, { status: 400 });
    }
    if (file.size > MAX_PDF_BYTES) {
      return NextResponse.json(
        { error: "file_too_large", detail: `${file.name}: maks. ${Math.round(MAX_PDF_BYTES / (1024 * 1024))} MB` },
        { status: 413 },
      );
    }

    const buffer = await file.arrayBuffer();
    const extracted = await extractPdfTextDetailed(buffer, { fileName: file.name });
    logPdfExtractResult(LOG_PREFIX, extracted);

    const kind = detectHistoryPdfKind(file.name, extracted.text);
    const sourceHint = SOURCE_HINT[kind] ?? SOURCE_HINT.generic;

    extractLog.push({
      fileName: file.name,
      stage: extracted.stage,
      pageCount: extracted.pageCount,
      textLayerCharCount: extracted.textLayerCharCount,
      fileBytes: file.size,
      errorMessage: extracted.errorMessage,
    });

    if (extracted.ok && extracted.text.trim().length >= MIN_USABLE_TEXT_CHARS) {
      bundles.push({
        fileName: file.name,
        text: extracted.text,
        sourceHint,
      });
      continue;
    }

    if (extracted.stage === "text_layer_empty") {
      warnings.push(
        `${file.name}: teksta slānis tukšs (${extracted.textLayerCharCount} rakstzīmes, ${extracted.pageCount} lpp.) — nosūtīts Gemini kā PDF`,
      );
    } else if (extracted.stage === "load_failed") {
      warnings.push(
        `${file.name}: PDF ielādes kļūda (${extracted.errorMessage ?? "unknown"}) — mēģināts Gemini inline PDF`,
      );
    } else {
      warnings.push(`${file.name}: nepietiekams teksts — nosūtīts Gemini kā PDF`);
    }

    pdfAttachments.push({
      fileName: file.name,
      sourceHint,
      buffer,
    });
  }

  if (bundles.length === 0 && pdfAttachments.length === 0) {
    console.error(`${LOG_PREFIX} all_files_failed`, { sessionId, extractLog });
    return NextResponse.json(
      {
        error: "pdf_extract_failed",
        detail: warnings.join("; ") || "Nav izvelkama teksta un neizdevās sagatavot PDF Gemini",
        extractLog,
      },
      { status: 422 },
    );
  }

  try {
    const extraction = await extractVehicleDataWithGemini({ textBundles: bundles, pdfAttachments });
    return NextResponse.json({
      ok: true,
      extraction,
      meta: {
        analyzedAt: new Date().toISOString(),
        fileNames: files.map((f) => f.name),
        sources: [...bundles.map((b) => b.sourceHint), ...pdfAttachments.map((p) => p.sourceHint)],
        charCounts: bundles.map((b) => b.text.length),
        usedGeminiInlinePdf: pdfAttachments.map((p) => p.fileName),
        extractLog,
      },
      warnings,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    console.error(`${LOG_PREFIX} gemini_failed`, { sessionId, msg, extractLog, stack: e instanceof Error ? e.stack : undefined });
    if (msg === "gemini_invalid_json") {
      return NextResponse.json({ error: "gemini_invalid_json", detail: "Nevalīds JSON no Gemini" }, { status: 502 });
    }
    if (msg === "no_pdf_text") {
      return NextResponse.json({ error: "no_pdf_text" }, { status: 422 });
    }
    return NextResponse.json({ error: "extraction_failed", detail: msg }, { status: 502 });
  }
}
