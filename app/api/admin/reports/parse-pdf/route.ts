/**
 * Admin: vēstures PDF → strukturēti dati.
 * POST multipart/form-data — `file` (application/pdf), opc. `target`:
 * auto_records (noklus.) | autodna | carvertical | ltab
 */
import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { extractPdfText } from "@/lib/admin-portfolio-pdf-analysis";
import { parseAutoRecordsPdfText } from "@/lib/auto-records-pdf-parse";
import {
  parseHistoryVendorPdfText,
  type HistoryVendorPdfTarget,
} from "@/lib/history-vendor-pdf-import";

export const maxDuration = 90;
export const runtime = "nodejs";

const MAX_PDF_BYTES = 12 * 1024 * 1024;

export async function POST(req: Request) {
  const ok = await getAdminSession();
  if (!ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid_form_data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "missing_file" }, { status: 400 });
  }

  if (file.size <= 0) {
    return NextResponse.json({ error: "empty_file" }, { status: 400 });
  }

  if (file.size > MAX_PDF_BYTES) {
    return NextResponse.json(
      { error: "file_too_large", detail: `Maks. ${Math.round(MAX_PDF_BYTES / (1024 * 1024))} MB` },
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
    let text = "";
    try {
      text = await extractPdfText(buffer);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "unknown";
      console.error("[admin/reports/parse-pdf] extractPdfText:", msg);
      return NextResponse.json(
        { error: "pdf_extract_failed", detail: "Neizdevās nolasīt PDF tekstu" },
        { status: 422 },
      );
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
        parsed.warnings.push("Datu nav — pārbaudi PDF avotu.");
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
    console.error("[admin/reports/parse-pdf]", msg, e);
    return NextResponse.json({ error: "parse_failed", detail: msg }, { status: 500 });
  }
}
