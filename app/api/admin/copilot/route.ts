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
import { PDF_GEMINI_INLINE_MAX_BYTES, PDF_MAX_FILE_BYTES } from "@/lib/pdf-api-limits";

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
  return `${a.source} · nobraukums ${a.date || "—"} · ${a.odometer || "—"} km · ${a.country || "—"} (${a.confidence})`;
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
  let pdf: { fileName: string; buffer: ArrayBuffer } | undefined;
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
      const file = form.get("file");
      if (file && file instanceof File && file.size > 0) {
        const name = (file.name || "report.pdf").toLowerCase();
        const mime = (file.type || "").toLowerCase();
        if (mime && mime !== "application/pdf" && !mime.includes("pdf")) {
          return NextResponse.json({ error: "invalid_file_type", detail: "Tikai PDF" }, { status: 400 });
        }
        if (name && !name.endsWith(".pdf")) {
          return NextResponse.json({ error: "invalid_file_type", detail: "Tikai PDF" }, { status: 400 });
        }
        if (file.size > PDF_MAX_FILE_BYTES) {
          return NextResponse.json(
            { error: "file_too_large", detail: `Maks. ${Math.round(PDF_MAX_FILE_BYTES / (1024 * 1024))} MB` },
            { status: 413 },
          );
        }
        const buffer = await file.arrayBuffer();
        if (buffer.byteLength > PDF_GEMINI_INLINE_MAX_BYTES) {
          return NextResponse.json(
            { error: "file_too_large", detail: "PDF pārāk liels Gemini inline (maks. ~18 MB)" },
            { status: 413 },
          );
        }
        pdf = { fileName: file.name || "report.pdf", buffer };
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
  if (!message && !pdf) {
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
      pdf,
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
      pdf: Boolean(pdf),
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
