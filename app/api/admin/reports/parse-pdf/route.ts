/**
 * Admin: vēstures PDF → strukturēti dati.
 * POST multipart/form-data — `file` (application/pdf), opc. `target`:
 * auto_records (noklus.) | autodna | carvertical | ltab
 *
 * Ja teksta slānis tukšs — atgriež `pdf_extract_empty` + `geminiFallback` (nevis apstājas).
 */
import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { detectHistoryPdfKind } from "@/lib/admin-portfolio-pdf-analysis";
import { PDF_MAX_FILE_BYTES } from "@/lib/pdf-api-limits";
import { parseAutoRecordsPdfText } from "@/lib/auto-records-pdf-parse";
import {
  parseHistoryVendorPdfText,
  type HistoryVendorPdfTarget,
} from "@/lib/history-vendor-pdf-import";
import { extractPdfTextDetailed, logPdfExtractResult } from "@/lib/pdf-text-extract-server";

export const maxDuration = 90;
export const runtime = "nodejs";

const LOG_PREFIX = "[admin/reports/parse-pdf]";

function geminiFallbackResponse(
  fileName: string,
  extracted: Awaited<ReturnType<typeof extractPdfTextDetailed>>,
) {
  const detail =
    extracted.stage === "load_failed"
      ? `PDF teksta slāni neizdevās ielādēt (${extracted.errorMessage ?? "pdf.js"}). Izmanto portfeļa sadaļu „Sistēmas anomālijas un AI analīze” — PDF tiks nosūtīts Gemini tieši.`
      : `PDF teksta slānis tukšs (${extracted.textLayerCharCount} zīmes, ${extracted.pageCount} lapas). Izmanto „Sistēmas anomālijas un AI analīze” — Gemini lasa PDF.`;

  console.warn(`${LOG_PREFIX} gemini_fallback_recommended`, {
    fileName,
    stage: extracted.stage,
    pageCount: extracted.pageCount,
    textLayerCharCount: extracted.textLayerCharCount,
    errorMessage: extracted.errorMessage,
  });

  return NextResponse.json(
    {
      error: "pdf_extract_empty",
      geminiFallback: true,
      detail,
      stage: extracted.stage,
      pageCount: extracted.pageCount,
      textLayerCharCount: extracted.textLayerCharCount,
      fileName,
    },
    { status: 422 },
  );
}

export async function POST(req: Request) {
  const ok = await getAdminSession();
  if (!ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
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
        detail: "Augšupielāde pārāk liela. Samazini PDF izmēru vai izmanto AI analīzes bloku portfelī.",
      },
      { status: 413 },
    );
  }

  const file = form.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "missing_file" }, { status: 400 });
  }

  if (file.size <= 0) {
    return NextResponse.json({ error: "empty_file" }, { status: 400 });
  }

  if (file.size > PDF_MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: "file_too_large", detail: `Maks. ${Math.round(PDF_MAX_FILE_BYTES / (1024 * 1024))} MB` },
      { status: 413 },
    );
  }

  const mime = (file.type || "").toLowerCase();
  const name = (file.name || "").toLowerCase();
  if (mime && mime !== "application/pdf" && !mime.includes("pdf")) {
    return NextResponse.json({ error: "invalid_file_type", detail: "Tikai PDF datnes" }, { status: 400 });
  }
  if (name && !name.endsWith(".pdf")) {
    return NextResponse.json({ error: "invalid_file_type", detail: "Faila paplašinājumam jābūt .pdf" }, { status: 400 });
  }

  try {
    const buffer = await file.arrayBuffer();
    const extracted = await extractPdfTextDetailed(buffer, { fileName: file.name });
    logPdfExtractResult(LOG_PREFIX, extracted);

    const text = extracted.text;
    const hasUsableText = extracted.ok && text.trim().length >= 40;

    if (!hasUsableText) {
      return geminiFallbackResponse(file.name, extracted);
    }

    const targetRaw = String(form.get("target") ?? "auto_records")
      .trim()
      .toLowerCase();
    const vendorTargets: HistoryVendorPdfTarget[] = ["autodna", "carvertical", "ltab"];
    const target = vendorTargets.includes(targetRaw as HistoryVendorPdfTarget)
      ? (targetRaw as HistoryVendorPdfTarget)
      : null;

    if (target) {
      const parsed = parseHistoryVendorPdfText(target, text);
      if (
        parsed.serviceHistory.length === 0 &&
        parsed.incidents.length === 0 &&
        parsed.warnings.length === 0
      ) {
        parsed.warnings.push("Datu nav — pārbaudi PDF avotu vai izmanto AI analīzi.");
      }
      return NextResponse.json({
        ok: true,
        fileName: file.name,
        ...parsed,
      });
    }

    const parsed = parseAutoRecordsPdfText(text);
    if (parsed.serviceHistory.length === 0 && parsed.warnings.length === 0) {
      parsed.warnings.push("Datu nav — pārbaudi PDF avotu.");
    }

    return NextResponse.json({
      ok: true,
      fileName: file.name,
      ...parsed,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    console.error(`${LOG_PREFIX} unexpected`, msg, e);
    return NextResponse.json({ error: "parse_failed", detail: msg }, { status: 500 });
  }
}
