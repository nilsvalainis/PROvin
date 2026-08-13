/**
 * Avota bloka PDF augšupielāde (AutoDNA / CarVertical) — pilnībā Copilot aģenta kontrolē.
 *
 * Atgriež TIKAI strukturētās tabulu rindas un dīlera specifikācijas laukus; RAW / AI konteksta
 * laukus šis ceļš neaizpilda (operators tos pārvalda pats).
 */
import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { getGeminiApiKeyFromEnv } from "@/lib/admin-gemini";
import { assertGeminiAllowedForSession } from "@/lib/admin-gemini-demo-guard";
import { applyCopilotActions } from "@/lib/admin-copilot-apply";
import type { CopilotAction, CopilotSourceKey } from "@/lib/admin-copilot-types";
import { mergeSourceBlocksWithDefaults, type WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";
import { parseSourcePdfBlobRefs } from "@/lib/admin-source-pdf-blob-constants";
import { deleteSourcePdfBlobs, fetchSourcePdfsFromBlob } from "@/lib/admin-source-pdf-blob-fetch";
import { runVendorPdfAgent } from "@/lib/copilot-vendor-pdf-agent";
import { PDF_GEMINI_INLINE_MAX_BYTES, PDF_MAX_FILE_BYTES } from "@/lib/pdf-api-limits";
import type { VendorReportVendor } from "@/lib/vendor-report-extract";

export const maxDuration = 120;
export const runtime = "nodejs";

const LOG_PREFIX = "[admin/copilot/vendor-pdf]";

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function describeAction(a: CopilotAction): string {
  if (a.type === "upsert_mileage") {
    return `nobraukums ${a.date} · ${a.odometer} km · ${a.country || "—"}`;
  }
  if (a.type === "upsert_incident") {
    return `negadījums ${a.date} · ${a.lossAmount} · ${a.country || "—"}`;
  }
  if (a.type === "set_dealer_vehicle_info") {
    const parts = [
      Object.keys(a.vehicleInfo).length > 0 ? Object.keys(a.vehicleInfo).join(", ") : "",
      a.equipment && a.equipment.length > 0 ? `komplektācija (${a.equipment.length})` : "",
    ].filter(Boolean);
    return `dīlera dati: ${parts.join(" · ")}`;
  }
  if (a.type === "set_service_history") {
    const lines = a.text.trim().split(/\n+/).filter(Boolean).length;
    return `servisa vēsture (${lines} apkopes)`;
  }
  if (a.type === "upsert_service_work") {
    const place = a.location.trim() ? ` · ${a.location.slice(0, 40)}` : "";
    return `apkope ${a.date} · ${a.odometer || "—"} km${place} · ${a.works.slice(0, 60)}`;
  }
  return a.type;
}

export async function POST(req: Request) {
  const ok = await getAdminSession();
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch (e) {
    const detail = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: "payload_too_large", detail }, { status: 413 });
  }

  const sessionId = str(form.get("sessionId")).trim();
  if (!sessionId) return NextResponse.json({ error: "missing_session" }, { status: 400 });

  const targetRaw = str(form.get("target")).trim();
  // `auto_records` blokā gaidām oficiālā dīlera / rūpnīcas izdruku (BMW portāls, auto-records.com).
  const target: VendorReportVendor | null =
    targetRaw === "autodna" || targetRaw === "carvertical"
      ? targetRaw
      : targetRaw === "auto_records" || targetRaw === "dealer"
        ? "dealer"
        : null;
  if (!target) {
    return NextResponse.json({ error: "invalid_target" }, { status: 400 });
  }

  // Lieli PDF nāk caur Vercel Blob (`fileUrls`), jo funkcijas pieprasījuma ķermenis ir ~4,5 MB.
  const blobRefs = parseSourcePdfBlobRefs(str(form.get("fileUrls")), 1);
  const file = form.get("file");
  if (blobRefs.length === 0) {
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "missing_file" }, { status: 400 });
    }
    const name = (file.name || "report.pdf").toLowerCase();
    const mime = (file.type || "").toLowerCase();
    if ((mime && !mime.includes("pdf")) || !name.endsWith(".pdf")) {
      return NextResponse.json({ error: "invalid_file_type", detail: "Tikai PDF" }, { status: 400 });
    }
    if (file.size > PDF_MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: "file_too_large", detail: `Maks. ${Math.round(PDF_MAX_FILE_BYTES / (1024 * 1024))} MB` },
        { status: 413 },
      );
    }
  }

  let sourceBlocks: WorkspaceSourceBlocks;
  try {
    const raw = JSON.parse(str(form.get("sourceBlocks")) || "{}") as Partial<WorkspaceSourceBlocks>;
    sourceBlocks = mergeSourceBlocksWithDefaults(raw);
  } catch {
    return NextResponse.json({ error: "missing_source_blocks" }, { status: 400 });
  }

  // Oficiālā dīlera un vēstures atskaišu teksta slānis tiek nolasīts lokāli, tāpēc Gemini
  // nepieejamība nav iemesls atteikt augšupielādi — tā kļūst par kļūdu tikai tad, ja lokālais
  // parseris no šī PDF neizvelk nevienu ierakstu.
  let geminiBlocked: { error: string; detail?: string } | null = null;
  if (!getGeminiApiKeyFromEnv()) {
    geminiBlocked = { error: "missing_gemini_key", detail: "Serverī nav GEMINI_API_KEY" };
  } else {
    const guard = await assertGeminiAllowedForSession(sessionId);
    if (!guard.ok) geminiBlocked = { error: guard.error, ...(guard.detail ? { detail: guard.detail } : {}) };
  }

  let fileName: string;
  let buffer: ArrayBuffer;
  try {
    if (blobRefs.length > 0) {
      const [fetched] = await fetchSourcePdfsFromBlob(sessionId, blobRefs);
      if (!fetched) return NextResponse.json({ error: "missing_file" }, { status: 400 });
      fileName = fetched.fileName;
      buffer = fetched.buffer;
    } else {
      const f = file as File;
      fileName = f.name || "report.pdf";
      buffer = await f.arrayBuffer();
    }
  } catch (e) {
    const detail = e instanceof Error ? e.message : "unknown";
    console.error(`${LOG_PREFIX} blob_fetch_failed`, detail);
    await deleteSourcePdfBlobs(blobRefs.map((r) => r.url));
    return NextResponse.json({ error: "blob_fetch_failed", detail }, { status: 502 });
  }

  if (buffer.byteLength > PDF_GEMINI_INLINE_MAX_BYTES) {
    await deleteSourcePdfBlobs(blobRefs.map((r) => r.url));
    return NextResponse.json(
      { error: "file_too_large", detail: "Pārāk liels Gemini inline (maks. ~18 MB)" },
      { status: 413 },
    );
  }

  try {
    const agent = await runVendorPdfAgent({
      target,
      fileName,
      buffer,
      sourceBlocks,
      useGemini: !geminiBlocked,
    });

    if (agent.actions.length === 0 && geminiBlocked) {
      const reason = geminiBlocked.detail ?? geminiBlocked.error;
      return NextResponse.json(
        {
          error: geminiBlocked.error,
          detail: `PDF teksta slānis nedeva nevienu ierakstu, un Gemini nav pieejams (${reason})`,
        },
        { status: 503 },
      );
    }

    const result = applyCopilotActions(sourceBlocks, agent.actions, { onlyAuto: false });
    const changedKeys: CopilotSourceKey[] = result.changedKeys;
    const notes = geminiBlocked
      ? [
          ...agent.notes,
          `Gemini izlaists (${geminiBlocked.detail ?? geminiBlocked.error}) — izmantots tikai PDF teksta slānis.`,
        ]
      : agent.notes;

    console.info(`${LOG_PREFIX} ok`, {
      sessionId: sessionId.slice(0, 12),
      target,
      vendor: agent.vendor,
      actions: agent.actions.length,
      applied: result.applied.length,
      changedKeys,
    });

    return NextResponse.json({
      ok: true,
      vendor: agent.vendor,
      summary: agent.summary,
      notes,
      applied: result.applied.map(describeAction),
      skipped: result.skipped.map((s) => ({ label: describeAction(s.action), reason: s.reason })),
      patchedSourceBlocks: Object.fromEntries(changedKeys.map((k) => [k, result.sourceBlocks[k]])),
      changedKeys,
    });
  } catch (e) {
    const detail = e instanceof Error ? e.message : "unknown";
    console.error(`${LOG_PREFIX} failed`, detail);
    if (detail === "missing_gemini_key") {
      return NextResponse.json({ error: "missing_gemini_key" }, { status: 503 });
    }
    return NextResponse.json({ error: "extraction_failed", detail }, { status: 502 });
  } finally {
    await deleteSourcePdfBlobs(blobRefs.map((r) => r.url));
  }
}
