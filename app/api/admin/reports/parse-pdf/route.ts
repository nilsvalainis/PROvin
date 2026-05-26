/**
 * Admin: vēstures PDF → strukturēti dati.
 * POST multipart/form-data — `file` (application/pdf), opc. `target`:
 * auto_records (noklus.) | autodna | carvertical | ltab
 *
 * Teksta slānis tukšs / pdf.js kļūda → automātisks Gemini inline PDF (ne 422).
 */
import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { getGeminiApiKeyFromEnv } from "@/lib/admin-gemini";
import { parseAutoRecordsPdfText, type AutoRecordsPdfParseResult } from "@/lib/auto-records-pdf-parse";
import { autoRecordsRowHasData } from "@/lib/auto-records-paste-parse";
import { ltabRowHasData } from "@/lib/admin-source-blocks";
import {
  parseHistoryVendorPdfText,
  type HistoryVendorPdfParseResult,
  type HistoryVendorPdfTarget,
} from "@/lib/history-vendor-pdf-import";
import { PDF_MAX_FILE_BYTES } from "@/lib/pdf-api-limits";
import { extractPdfTextDetailed, logPdfExtractResult } from "@/lib/pdf-text-extract-server";
import {
  autoRecordsParseHasData,
  extractSourcePdfWithGemini,
  vendorParseHasData,
} from "@/lib/source-pdf-gemini-extract";

export const maxDuration = 120;
export const runtime = "nodejs";

const LOG_PREFIX = "[admin/reports/parse-pdf]";

function markTextLayerMeta<T extends { meta: { extractionMethod?: "text_layer" | "gemini" } }>(r: T): T {
  return { ...r, meta: { ...r.meta, extractionMethod: "text_layer" } };
}

function vendorHeuristicHasRows(r: HistoryVendorPdfParseResult): boolean {
  return r.serviceHistory.some(autoRecordsRowHasData) || r.incidents.some(ltabRowHasData);
}

function autoRecordsHeuristicHasRows(r: AutoRecordsPdfParseResult): boolean {
  return r.serviceHistory.some(autoRecordsRowHasData);
}

async function runGeminiFallback(
  target: HistoryVendorPdfTarget | "auto_records",
  buffer: ArrayBuffer,
  fileName: string,
  textHint: string,
): Promise<HistoryVendorPdfParseResult | AutoRecordsPdfParseResult> {
  if (!getGeminiApiKeyFromEnv()) {
    throw new Error("missing_gemini_key");
  }
  console.info(`${LOG_PREFIX} gemini_fallback_start`, { fileName, target });
  return extractSourcePdfWithGemini({ target, buffer, fileName, textHint });
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

  const targetRaw = String(form.get("target") ?? "auto_records").trim().toLowerCase();
  const vendorTargets: HistoryVendorPdfTarget[] = ["autodna", "carvertical", "ltab"];
  const vendorTarget = vendorTargets.includes(targetRaw as HistoryVendorPdfTarget)
    ? (targetRaw as HistoryVendorPdfTarget)
    : null;
  const geminiTarget: HistoryVendorPdfTarget | "auto_records" = vendorTarget ?? "auto_records";

  try {
    const buffer = await file.arrayBuffer();
    const extracted = await extractPdfTextDetailed(buffer, { fileName: file.name });
    logPdfExtractResult(LOG_PREFIX, extracted);

    const text = extracted.text;
    const hasUsableText = extracted.ok && text.trim().length >= 40;
    const textHint = hasUsableText ? text : extracted.text;

    const needsGemini =
      !hasUsableText ||
      extracted.stage === "text_layer_empty" ||
      extracted.stage === "load_failed";

    if (!needsGemini) {
      if (vendorTarget) {
        const parsed = markTextLayerMeta(parseHistoryVendorPdfText(vendorTarget, text));
        if (vendorHeuristicHasRows(parsed)) {
          return NextResponse.json({ ok: true, fileName: file.name, ...parsed });
        }
      } else {
        const parsed = markTextLayerMeta(parseAutoRecordsPdfText(text));
        if (autoRecordsHeuristicHasRows(parsed)) {
          return NextResponse.json({ ok: true, fileName: file.name, ...parsed });
        }
      }
    }

    try {
      const geminiResult = await runGeminiFallback(geminiTarget, buffer, file.name, textHint);
      const warnings =
        "warnings" in geminiResult && Array.isArray(geminiResult.warnings) ? [...geminiResult.warnings] : [];
      if (!hasUsableText) {
        warnings.unshift(
          extracted.stage === "load_failed"
            ? `Teksta slānis neielādējās (${extracted.errorMessage ?? "pdf.js"}) — aizpildīts ar Gemini.`
            : `Teksta slānis tukšs (${extracted.textLayerCharCount} zīmes) — aizpildīts ar Gemini.`,
        );
      } else if (needsGemini) {
        warnings.unshift("Heuristika neatrada rindas — aizpildīts ar Gemini.");
      }

      if (vendorTarget && "incidents" in geminiResult) {
        const v = geminiResult as HistoryVendorPdfParseResult;
        if (!vendorParseHasData(v)) {
          return NextResponse.json(
            {
              error: "extraction_failed",
              detail: "Gemini neatrada izmantojamus datus šajā PDF — pārbaudi avotu vai mēģini vēlreiz.",
              stage: extracted.stage,
            },
            { status: 502 },
          );
        }
        return NextResponse.json({
          ok: true,
          fileName: file.name,
          ...v,
          warnings,
        });
      }

      const ar = geminiResult as AutoRecordsPdfParseResult;
      if (!autoRecordsParseHasData(ar)) {
        return NextResponse.json(
          {
            error: "extraction_failed",
            detail: "Gemini neatrada nobraukuma datus — pārbaudi PDF vai ielīmē RAW tekstu.",
            stage: extracted.stage,
          },
          { status: 502 },
        );
      }
      return NextResponse.json({
        ok: true,
        fileName: file.name,
        ...ar,
        warnings,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "unknown";
      console.error(`${LOG_PREFIX} gemini_fallback_failed`, { fileName: file.name, target: geminiTarget, msg });
      if (msg === "missing_gemini_key") {
        return NextResponse.json({ error: "missing_gemini_key" }, { status: 503 });
      }
      if (msg === "pdf_too_large_for_gemini") {
        return NextResponse.json(
          {
            error: "file_too_large",
            detail: "PDF pārāk liels Gemini inline analīzei (maks. ~18 MB).",
          },
          { status: 413 },
        );
      }
      if (msg === "gemini_invalid_json") {
        return NextResponse.json(
          { error: "extraction_failed", detail: "Gemini atgrieza nevalīdu JSON — mēģini vēlreiz." },
          { status: 502 },
        );
      }
      return NextResponse.json(
        { error: "extraction_failed", detail: msg, stage: extracted.stage },
        { status: 502 },
      );
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    console.error(`${LOG_PREFIX} unexpected`, msg, e);
    return NextResponse.json({ error: "parse_failed", detail: msg }, { status: 500 });
  }
}
