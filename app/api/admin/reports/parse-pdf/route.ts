/**
 * Admin: vēstures PDF → strukturēti dati.
 * Noklusējums: Gemini Pro lasa pilnu PDF; lokālais parsers — fallback.
 */
import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import type { AutoRecordsPdfParseResult } from "@/lib/auto-records-pdf-parse";
import type { HistoryVendorPdfParseResult, HistoryVendorPdfTarget } from "@/lib/history-vendor-pdf-import";
import { PDF_MAX_FILE_BYTES } from "@/lib/pdf-api-limits";
import { ingestSourcePdfFile } from "@/lib/pdf-source-ingest";
import { logPdfExtractResult } from "@/lib/pdf-text-extract-server";
import { autoRecordsParseHasData, vendorParseHasData } from "@/lib/source-pdf-gemini-extract";

export const maxDuration = 120;
export const runtime = "nodejs";

const LOG_PREFIX = "[admin/reports/parse-pdf]";

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
        detail: "Augšupielāde pārāk liela. Samazini PDF izmēru.",
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

  const targetRaw = String(form.get("target") ?? "auto_records").trim().toLowerCase();
  const vendorTargets: HistoryVendorPdfTarget[] = ["autodna", "carvertical", "ltab"];
  const target = vendorTargets.includes(targetRaw as HistoryVendorPdfTarget)
    ? (targetRaw as HistoryVendorPdfTarget)
    : ("auto_records" as const);

  try {
    const buffer = await file.arrayBuffer();
    const { result, extract, plan, planReason } = await ingestSourcePdfFile({
      target,
      buffer,
      fileName: file.name,
    });
    logPdfExtractResult(LOG_PREFIX, extract);

    const hasData =
      "incidents" in result ? vendorParseHasData(result as HistoryVendorPdfParseResult) : autoRecordsParseHasData(result as AutoRecordsPdfParseResult);

    if (!hasData) {
      return NextResponse.json(
        {
          error: "extraction_failed",
          detail: "Neizdevās izvilkt datus no PDF — pārbaudi avotu vai mēģini vēlreiz.",
          meta: { engine: plan, planReason, textBackend: extract.backend },
          stage: extract.stage,
        },
        { status: 502 },
      );
    }

    console.info(`${LOG_PREFIX} ok`, {
      fileName: file.name,
      target,
      plan,
      planReason,
      backend: extract.backend,
    });

    return NextResponse.json({
      ok: true,
      fileName: file.name,
      ...result,
      meta: {
        ...result.meta,
        engine: plan,
        planReason,
        textBackend: extract.backend,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    console.error(`${LOG_PREFIX} failed`, { fileName: file.name, target, msg });
    if (msg === "missing_gemini_key") {
      return NextResponse.json({ error: "missing_gemini_key" }, { status: 503 });
    }
    if (msg === "pdf_too_large_for_gemini") {
      return NextResponse.json(
        { error: "file_too_large", detail: "PDF pārāk liels Gemini inline analīzei (maks. ~18 MB)." },
        { status: 413 },
      );
    }
    if (msg === "gemini_invalid_json") {
      return NextResponse.json(
        { error: "extraction_failed", detail: "Gemini atgrieza nevalīdu JSON." },
        { status: 502 },
      );
    }
    return NextResponse.json({ error: "parse_failed", detail: msg }, { status: 500 });
  }
}
