/**
 * Admin Order Copilot — chat + optional PDF → structured table actions.
 */
import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { assertGeminiAllowedForSession } from "@/lib/admin-gemini-demo-guard";
import { getGeminiApiKeyFromEnv } from "@/lib/admin-gemini";
import { applyCopilotActions } from "@/lib/admin-copilot-apply";
import { runOrderCopilotGemini } from "@/lib/admin-copilot-gemini";
import type { CopilotAction, CopilotChatMessage } from "@/lib/admin-copilot-types";
import { mergeSourceBlocksWithDefaults, type WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";
import { PDF_GEMINI_INLINE_MAX_BYTES, PDF_MAX_FILE_BYTES, PDF_MAX_FILES, PDF_MAX_TOTAL_BYTES } from "@/lib/pdf-api-limits";

export const maxDuration = 120;
export const runtime = "nodejs";

const LOG_PREFIX = "[admin/copilot]";

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function parseHistory(raw: unknown): CopilotChatMessage[] {
  if (typeof raw === "string") {
    try {
      return parseHistory(JSON.parse(raw));
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw)) return [];
  const out: CopilotChatMessage[] = [];
  for (const item of raw.slice(-10)) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const role = str(o.role);
    const content = str(o.content).trim();
    if ((role === "user" || role === "assistant") && content) {
      out.push({ role, content: content.slice(0, 4000) });
    }
  }
  return out;
}

function parseSourceBlocks(raw: unknown): WorkspaceSourceBlocks | null {
  if (typeof raw === "string") {
    try {
      return parseSourceBlocks(JSON.parse(raw));
    } catch {
      return null;
    }
  }
  if (!raw || typeof raw !== "object") return null;
  return mergeSourceBlocksWithDefaults(raw as Partial<WorkspaceSourceBlocks>);
}

function describeAction(a: CopilotAction): string {
  if (a.type === "upsert_incident") {
    return `${a.source} · negadījums ${a.date || "—"} · ${a.lossAmount || "—"} · ${a.country || "—"} (${a.confidence})`;
  }
  if (a.type === "upsert_mileage") {
    return `${a.source} · nobraukums ${a.date || "—"} · ${a.odometer || "—"} km · ${a.country || "—"} (${a.confidence})`;
  }
  if (a.type === "set_service_history") {
    const lines = a.text.trim().split(/\n+/).filter(Boolean).length;
    return `auto_records · Servisa vēsture (${lines} rindas) (${a.confidence})`;
  }
  if (a.type === "append_raw") {
    const preview = a.text.trim().slice(0, 60).replace(/\s+/g, " ");
    return `${a.source} · RAW · ${preview}${a.text.trim().length > 60 ? "…" : ""} (${a.confidence})`;
  }
  const _exhaustive: never = a;
  return String(_exhaustive);
}

export async function POST(req: Request) {
  const ok = await getAdminSession();
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (!getGeminiApiKeyFromEnv()) {
    return NextResponse.json({ error: "missing_gemini_key" }, { status: 503 });
  }

  const contentType = req.headers.get("content-type") || "";
  let sessionId = "";
  let message = "";
  let history: CopilotChatMessage[] = [];
  let sourceBlocks: WorkspaceSourceBlocks | null = null;
  const pdfs: { fileName: string; buffer: ArrayBuffer }[] = [];
  let applyMode: "auto" | "preview" = "auto";

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      sessionId = str(form.get("sessionId")).trim();
      message = str(form.get("message")).trim();
      history = parseHistory(form.get("history"));
      sourceBlocks = parseSourceBlocks(form.get("sourceBlocks"));
      const mode = str(form.get("applyMode")).trim();
      if (mode === "preview") applyMode = "preview";

      const candidates: File[] = [];
      for (const key of ["files", "file"]) {
        for (const entry of form.getAll(key)) {
          if (entry instanceof File && entry.size > 0) candidates.push(entry);
        }
      }
      // dedupe by name+size
      const seen = new Set<string>();
      const unique = candidates.filter((f) => {
        const k = `${f.name}:${f.size}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      if (unique.length > PDF_MAX_FILES) {
        return NextResponse.json(
          { error: "too_many_files", detail: `Maks. ${PDF_MAX_FILES} PDF vienā reizē` },
          { status: 400 },
        );
      }
      let totalBytes = 0;
      for (const file of unique) {
        const name = (file.name || "report.pdf").toLowerCase();
        const mime = (file.type || "").toLowerCase();
        if (mime && mime !== "application/pdf" && !mime.includes("pdf")) {
          return NextResponse.json({ error: "invalid_file_type", detail: `Tikai PDF: ${file.name}` }, { status: 400 });
        }
        if (name && !name.endsWith(".pdf")) {
          return NextResponse.json({ error: "invalid_file_type", detail: `Tikai PDF: ${file.name}` }, { status: 400 });
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
        totalBytes += file.size;
        if (totalBytes > PDF_MAX_TOTAL_BYTES) {
          return NextResponse.json(
            {
              error: "file_too_large",
              detail: `Kopā pārāk lieli PDF (maks. ${Math.round(PDF_MAX_TOTAL_BYTES / (1024 * 1024))} MB)`,
            },
            { status: 413 },
          );
        }
        const buffer = await file.arrayBuffer();
        if (buffer.byteLength > PDF_GEMINI_INLINE_MAX_BYTES) {
          return NextResponse.json(
            { error: "file_too_large", detail: `${file.name}: pārāk liels Gemini inline (maks. ~18 MB)` },
            { status: 413 },
          );
        }
        pdfs.push({ fileName: file.name || "report.pdf", buffer });
      }
    } else {
      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return NextResponse.json({ error: "invalid_json" }, { status: 400 });
      }
      if (!body || typeof body !== "object") {
        return NextResponse.json({ error: "invalid_body" }, { status: 400 });
      }
      const b = body as Record<string, unknown>;
      sessionId = str(b.sessionId).trim();
      message = str(b.message).trim();
      history = parseHistory(b.history);
      sourceBlocks = parseSourceBlocks(b.sourceBlocks);
      if (str(b.applyMode).trim() === "preview") applyMode = "preview";
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    console.error(`${LOG_PREFIX} parse_failed`, msg);
    return NextResponse.json({ error: "payload_too_large", detail: msg }, { status: 413 });
  }

  if (!sessionId) {
    return NextResponse.json({ error: "missing_session" }, { status: 400 });
  }
  if (!message && pdfs.length === 0) {
    return NextResponse.json({ error: "empty_message", detail: "Ieraksti ziņu vai pievieno PDF" }, { status: 400 });
  }
  if (!sourceBlocks) {
    return NextResponse.json({ error: "missing_source_blocks" }, { status: 400 });
  }

  const guard = await assertGeminiAllowedForSession(sessionId);
  if (!guard.ok) {
    return NextResponse.json(
      { error: guard.error, ...(guard.detail ? { detail: guard.detail } : {}) },
      { status: guard.status },
    );
  }

  try {
    const gemini = await runOrderCopilotGemini({
      message,
      sourceBlocks,
      history,
      pdfs,
    });

    const autoResult = applyCopilotActions(sourceBlocks, gemini.actions, {
      onlyAuto: true,
      clarificationNeeded: gemini.clarificationNeeded,
    });
    const needsConfirm = autoResult.skipped.filter((s) => s.reason === "needs_confirm").map((s) => s.action);
    const hardSkipped = autoResult.skipped.filter((s) => s.reason !== "needs_confirm");

    const shouldPatch = applyMode === "auto" && autoResult.applied.length > 0;

    console.info(`${LOG_PREFIX} ok`, {
      sessionId: sessionId.slice(0, 12),
      actions: gemini.actions.length,
      auto: autoResult.applied.length,
      confirm: needsConfirm.length,
      pdfCount: pdfs.length,
    });

    return NextResponse.json({
      ok: true,
      reply: gemini.reply,
      clarificationNeeded: gemini.clarificationNeeded,
      actions: gemini.actions.map((a) => ({ ...a, label: describeAction(a) })),
      autoApplied: shouldPatch
        ? autoResult.applied.map((a) => ({ ...a, label: describeAction(a) }))
        : [],
      needsConfirm: needsConfirm.map((a) => ({ ...a, label: describeAction(a) })),
      skipped: hardSkipped.map((s) => ({ ...s.action, label: describeAction(s.action), reason: s.reason })),
      // Client merges these keys into local workspace (autosave follows)
      patchedSourceBlocks: shouldPatch
        ? Object.fromEntries(autoResult.changedKeys.map((k) => [k, autoResult.sourceBlocks[k]]))
        : {},
      changedKeys: shouldPatch ? autoResult.changedKeys : [],
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    console.error(`${LOG_PREFIX} failed`, msg);
    if (msg === "missing_gemini_key") {
      return NextResponse.json({ error: "missing_gemini_key" }, { status: 503 });
    }
    if (msg === "gemini_invalid_json") {
      return NextResponse.json({ error: "extraction_failed", detail: "Gemini atgrieza nederīgu JSON" }, { status: 502 });
    }
    return NextResponse.json({ error: "generation_failed", detail: msg }, { status: 502 });
  }
}

/** Apstiprina / piespiež medium-confidence darbības ar to pašu apply loģiku. */
export async function PUT(req: Request) {
  const ok = await getAdminSession();
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const sessionId = str(b.sessionId).trim();
  if (!sessionId) return NextResponse.json({ error: "missing_session" }, { status: 400 });

  const guard = await assertGeminiAllowedForSession(sessionId);
  if (!guard.ok) {
    return NextResponse.json(
      { error: guard.error, ...(guard.detail ? { detail: guard.detail } : {}) },
      { status: guard.status },
    );
  }

  const sourceBlocks = parseSourceBlocks(b.sourceBlocks);
  if (!sourceBlocks) return NextResponse.json({ error: "missing_source_blocks" }, { status: 400 });

  const actionsRaw = Array.isArray(b.actions) ? b.actions : [];
  const { parseCopilotGeminiPayload } = await import("@/lib/admin-copilot-parse");
  let actions: CopilotAction[] = [];
  try {
    const parsed = parseCopilotGeminiPayload(
      JSON.stringify({ reply: "", clarificationNeeded: "", actions: actionsRaw }),
    );
    actions = parsed.actions;
  } catch {
    return NextResponse.json({ error: "invalid_actions" }, { status: 400 });
  }

  const result = applyCopilotActions(sourceBlocks, actions, { onlyAuto: false });
  return NextResponse.json({
    ok: true,
    autoApplied: result.applied.map((a) => ({ ...a, label: describeAction(a) })),
    skipped: result.skipped.map((s) => ({ ...s.action, label: describeAction(s.action), reason: s.reason })),
    patchedSourceBlocks: Object.fromEntries(result.changedKeys.map((k) => [k, result.sourceBlocks[k]])),
    changedKeys: result.changedKeys,
  });
}
