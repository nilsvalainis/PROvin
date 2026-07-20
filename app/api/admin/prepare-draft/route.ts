/**
 * Admin: portfeļa PDF → avotu bloki + Gemini ✨ melnraksta komentāri.
 */
import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { assertGeminiAllowedForSession } from "@/lib/admin-gemini-demo-guard";
import { getGeminiApiKeyFromEnv } from "@/lib/admin-gemini";
import { mergeSourceBlocksFromBody, parseGeminiOrderContextFromBody } from "@/lib/admin-gemini-api-body";
import { runPrepareDraftPipeline, type PrepareDraftPdfInput } from "@/lib/admin-prepare-draft";
import { detectSourcePdfIngestTarget } from "@/lib/admin-source-pdf-detect";
import { PROVIN_GEMINI_PROMPT_VERSION } from "@/lib/gemini-prompt-version";
import {
  PDF_MAX_FILE_BYTES,
  PDF_MAX_FILES,
  PDF_MAX_TOTAL_BYTES,
} from "@/lib/pdf-api-limits";
import type { SourcePdfIngestTarget } from "@/lib/pdf-source-ingest";
import { extractPdfTextDetailed } from "@/lib/pdf-text-extract-server";

export const maxDuration = 300;
export const runtime = "nodejs";

const LOG_PREFIX = "[admin/prepare-draft]";

function isPdfFile(file: File): boolean {
  const mime = (file.type || "").toLowerCase();
  const name = (file.name || "").toLowerCase();
  if (mime && mime !== "application/pdf" && !mime.includes("pdf")) return false;
  if (name && !name.endsWith(".pdf")) return false;
  return true;
}

function parseTargetHint(raw: string): SourcePdfIngestTarget | null {
  const t = raw.trim().toLowerCase();
  if (
    t === "carvertical" ||
    t === "autodna" ||
    t === "ltab" ||
    t === "auto_records" ||
    t === "csdd" ||
    t === "citi_avoti"
  ) {
    return t;
  }
  return null;
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
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    console.error(`${LOG_PREFIX} formData_failed`, msg);
    return NextResponse.json(
      { error: "payload_too_large", detail: "Augšupielāde pārāk liela." },
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
    return NextResponse.json(
      { error: "missing_files", detail: "Pievieno vismēaz vienu PDF portfelī." },
      { status: 400 },
    );
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
      { error: "payload_too_large", detail: "Kopējais PDF apjoms pārsniedz limitu." },
      { status: 413 },
    );
  }

  const targetHintsRaw = form.getAll("targets").map((t) => String(t ?? ""));
  const generateComments = String(form.get("generateComments") ?? "true").toLowerCase() !== "false";

  const pdfs: PrepareDraftPdfInput[] = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i]!;
    if (!isPdfFile(file)) {
      return NextResponse.json({ error: "invalid_file_type", detail: `${file.name}: tikai PDF` }, { status: 400 });
    }
    if (file.size <= 0 || file.size > PDF_MAX_FILE_BYTES) {
      return NextResponse.json({ error: "file_too_large", detail: file.name }, { status: 413 });
    }
    const buffer = await file.arrayBuffer();
    const hint = parseTargetHint(targetHintsRaw[i] ?? "");
    let target = hint;
    if (!target) {
      const extracted = await extractPdfTextDetailed(buffer, { fileName: file.name });
      target = detectSourcePdfIngestTarget(file.name, extracted.text);
    }
    pdfs.push({ fileName: file.name, buffer, target });
  }

  let sourceBlocksBody: unknown = {};
  const sourceBlocksRaw = form.get("sourceBlocks");
  if (typeof sourceBlocksRaw === "string" && sourceBlocksRaw.trim()) {
    try {
      sourceBlocksBody = JSON.parse(sourceBlocksRaw);
    } catch {
      return NextResponse.json({ error: "invalid_source_blocks" }, { status: 400 });
    }
  }

  const sourceBlocks = mergeSourceBlocksFromBody({ sourceBlocks: sourceBlocksBody });

  const context = parseGeminiOrderContextFromBody(
    {
      sessionId,
      vin: form.get("vin"),
      listingUrl: form.get("listingUrl"),
      customerName: form.get("customerName"),
      notes: form.get("notes"),
      internalComment: form.get("internalComment"),
      mileageComment: form.get("mileageComment"),
      sourcesComparisonComment: form.get("sourcesComparisonComment"),
      modelTier: form.get("modelTier"),
    },
    sourceBlocks,
  );

  console.info(`${LOG_PREFIX} start`, {
    sessionId,
    pdfCount: pdfs.length,
    generateComments,
    modelTier: context.modelTier ?? "pro",
  });

  try {
    const result = await runPrepareDraftPipeline({
      pdfs,
      context,
      generateComments,
    });

    const imported = result.steps.filter((s) => s.id.startsWith("pdf:") && s.status === "ok").length;
    console.info(`${LOG_PREFIX} ok`, { sessionId, imported, steps: result.steps.length });

    return NextResponse.json({
      ok: true,
      promptVersion: PROVIN_GEMINI_PROMPT_VERSION,
      ...result,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    console.error(`${LOG_PREFIX} failed`, { sessionId, msg });
    return NextResponse.json({ error: "prepare_draft_failed", detail: msg }, { status: 502 });
  }
}
