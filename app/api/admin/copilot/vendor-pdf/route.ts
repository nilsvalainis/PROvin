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
    return `dīlera dati: ${Object.keys(a.vehicleInfo).join(", ")}`;
  }
  if (a.type === "set_service_history") {
    const lines = a.text.trim().split(/\n+/).filter(Boolean).length;
    return `servisa vēsture (${lines} apkopes)`;
  }
  if (a.type === "upsert_service_work") {
    return `apkope ${a.date} · ${a.odometer || "—"} km · ${a.works.slice(0, 60)}`;
  }
  return a.type;
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
    const detail = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: "payload_too_large", detail }, { status: 413 });
  }

  const sessionId = str(form.get("sessionId")).trim();
  if (!sessionId) return NextResponse.json({ error: "missing_session" }, { status: 400 });

  const targetRaw = str(form.get("target")).trim();
  if (targetRaw !== "autodna" && targetRaw !== "carvertical") {
    return NextResponse.json({ error: "invalid_target" }, { status: 400 });
  }
  const target: VendorReportVendor = targetRaw;

  const file = form.get("file");
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

  let sourceBlocks: WorkspaceSourceBlocks;
  try {
    const raw = JSON.parse(str(form.get("sourceBlocks")) || "{}") as Partial<WorkspaceSourceBlocks>;
    sourceBlocks = mergeSourceBlocksWithDefaults(raw);
  } catch {
    return NextResponse.json({ error: "missing_source_blocks" }, { status: 400 });
  }

  const guard = await assertGeminiAllowedForSession(sessionId);
  if (!guard.ok) {
    return NextResponse.json(
      { error: guard.error, ...(guard.detail ? { detail: guard.detail } : {}) },
      { status: guard.status },
    );
  }

  const buffer = await file.arrayBuffer();
  if (buffer.byteLength > PDF_GEMINI_INLINE_MAX_BYTES) {
    return NextResponse.json(
      { error: "file_too_large", detail: "Pārāk liels Gemini inline (maks. ~18 MB)" },
      { status: 413 },
    );
  }

  try {
    const agent = await runVendorPdfAgent({
      target,
      fileName: file.name || "report.pdf",
      buffer,
      sourceBlocks,
    });

    const result = applyCopilotActions(sourceBlocks, agent.actions, { onlyAuto: false });
    const changedKeys: CopilotSourceKey[] = result.changedKeys;

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
      notes: agent.notes,
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
  }
}
