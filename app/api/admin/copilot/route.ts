/**
 * Admin Order Copilot — chat + optional PDF → structured table actions.
 */
import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { assertGeminiAllowedForSession } from "@/lib/admin-gemini-demo-guard";
import { getGeminiApiKeyFromEnv } from "@/lib/admin-gemini";
import { applyCopilotActions } from "@/lib/admin-copilot-apply";
import { isLikelyCsddPdfText, mergeCsddFieldsFillEmpty } from "@/lib/admin-copilot-csdd";
import { runOrderCopilotGemini } from "@/lib/admin-copilot-gemini";
import { COPILOT_SOURCE_KEYS, type CopilotAction, type CopilotChatMessage, type CopilotSourceKey, isCopilotSourceKey } from "@/lib/admin-copilot-types";
import { mergeSourceBlocksWithDefaults, type WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";
import { PDF_GEMINI_INLINE_MAX_BYTES, PDF_MAX_FILE_BYTES, PDF_MAX_FILES, PDF_MAX_TOTAL_BYTES } from "@/lib/pdf-api-limits";
import type { CsddPdfParseResult } from "@/lib/csdd-pdf-ingest";
import { extractPdfTextDetailed } from "@/lib/pdf-text-extract-server";
import { ingestSourcePdfFile } from "@/lib/pdf-source-ingest";
import { csddParseHasData } from "@/lib/source-pdf-gemini-extract";

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

function parseAllowedSources(raw: unknown): CopilotSourceKey[] {
  const input = typeof raw === "string" ? (() => {
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return raw.split(",").map((part) => part.trim());
    }
  })() : raw;
  if (!Array.isArray(input)) return [...COPILOT_SOURCE_KEYS];
  const out: CopilotSourceKey[] = [];
  for (const item of input) {
    if (typeof item !== "string" || !isCopilotSourceKey(item) || out.includes(item)) continue;
    out.push(item);
  }
  return out.length > 0 ? out : [...COPILOT_SOURCE_KEYS];
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
  let allowedSources: CopilotSourceKey[] = [...COPILOT_SOURCE_KEYS];
  const pdfs: { fileName: string; buffer: ArrayBuffer }[] = [];
  let applyMode: "auto" | "preview" = "auto";

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      sessionId = str(form.get("sessionId")).trim();
      message = str(form.get("message")).trim();
      history = parseHistory(form.get("history"));
      sourceBlocks = parseSourceBlocks(form.get("sourceBlocks"));
      allowedSources = parseAllowedSources(form.get("allowedSources"));
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
      allowedSources = parseAllowedSources(b.allowedSources);
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
    const allowedSet = new Set<CopilotSourceKey>(allowedSources);
    let workingBlocks = sourceBlocks;
    const csddImportNotes: string[] = [];

    if (allowedSet.has("csdd") && pdfs.length > 0) {
      for (const pdf of pdfs) {
        const extract = await extractPdfTextDetailed(pdf.buffer, { fileName: pdf.fileName });
        if (!isLikelyCsddPdfText(extract.text)) continue;
        try {
          const { result } = await ingestSourcePdfFile({
            target: "csdd",
            buffer: pdf.buffer,
            fileName: pdf.fileName,
          });
          const csddResult = result as CsddPdfParseResult;
          if (csddParseHasData(csddResult)) {
            workingBlocks = {
              ...workingBlocks,
              csdd: mergeCsddFieldsFillEmpty(
                workingBlocks.csdd,
                csddResult.fields,
                csddResult.rawUnprocessedData,
              ),
            };
            csddImportNotes.push(`CSDD PDF „${pdf.fileName}” — aizpildīti tukšie lauki (TA vēsture, nobraukums u.c.).`);
          }
        } catch (csddErr) {
          const detail = csddErr instanceof Error ? csddErr.message : "unknown";
          console.warn(`${LOG_PREFIX} csdd_pdf_failed`, { fileName: pdf.fileName, detail });
          csddImportNotes.push(`CSDD PDF „${pdf.fileName}” — neizdevās pilnībā importēt (${detail}).`);
        }
      }
    }

    const skipGenericCopilot =
      allowedSet.has("csdd") &&
      allowedSources.length === 1 &&
      pdfs.length > 0 &&
      csddImportNotes.some((n) => n.includes("aizpildīti"));

    const gemini = skipGenericCopilot
      ? {
          reply:
            csddImportNotes.join("\n") ||
            "CSDD PDF apstrādāts — pārbaudi CSDD avota laukus un raw, ja kaut kas trūkst.",
          actions: [] as CopilotAction[],
          clarificationNeeded: "",
        }
      : await runOrderCopilotGemini({
          message,
          sourceBlocks: workingBlocks,
          allowedSources,
          history,
          pdfs,
        });

    const blocked = gemini.actions.filter((a) => !allowedSet.has(a.source));
    const allowedActions = gemini.actions.filter((a) => allowedSet.has(a.source));

    const autoResult = applyCopilotActions(workingBlocks, allowedActions, {
      onlyAuto: true,
      clarificationNeeded: gemini.clarificationNeeded,
    });
    workingBlocks = autoResult.sourceBlocks;

    const changedKeys = new Set<CopilotSourceKey>(autoResult.changedKeys);
    if (workingBlocks.csdd !== sourceBlocks.csdd) {
      changedKeys.add("csdd");
    }

    const needsConfirm = autoResult.skipped.filter((s) => s.reason === "needs_confirm").map((s) => s.action);
    const hardSkipped = [
      ...autoResult.skipped.filter((s) => s.reason !== "needs_confirm"),
      ...blocked.map((action) => ({ action, reason: "source_disabled" as const })),
    ];

    const shouldPatch = applyMode === "auto" && (autoResult.applied.length > 0 || changedKeys.has("csdd"));
    const replyParts = [gemini.reply.trim()];
    if (csddImportNotes.length > 0 && !skipGenericCopilot) {
      replyParts.push(csddImportNotes.join("\n"));
    }

    console.info(`${LOG_PREFIX} ok`, {
      sessionId: sessionId.slice(0, 12),
      actions: gemini.actions.length,
      allowedSources,
      auto: autoResult.applied.length,
      confirm: needsConfirm.length,
      pdfCount: pdfs.length,
      csddImports: csddImportNotes.length,
    });

    const changedList = [...changedKeys];

    return NextResponse.json({
      ok: true,
      reply: replyParts.filter(Boolean).join("\n\n"),
      clarificationNeeded: gemini.clarificationNeeded,
      actions: gemini.actions.map((a) => ({ ...a, label: describeAction(a) })),
      autoApplied: shouldPatch
        ? autoResult.applied.map((a) => ({ ...a, label: describeAction(a) }))
        : [],
      needsConfirm: needsConfirm.map((a) => ({ ...a, label: describeAction(a) })),
      skipped: hardSkipped.map((s) => ({ ...s.action, label: describeAction(s.action), reason: s.reason })),
      patchedSourceBlocks: shouldPatch
        ? Object.fromEntries(changedList.map((k) => [k, workingBlocks[k]]))
        : {},
      changedKeys: shouldPatch ? changedList : [],
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
  const allowedSources = parseAllowedSources(b.allowedSources);

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

  const allowedSet = new Set<CopilotSourceKey>(allowedSources);
  const allowedActions = actions.filter((a) => allowedSet.has(a.source));
  const blocked = actions.filter((a) => !allowedSet.has(a.source));
  const result = applyCopilotActions(sourceBlocks, allowedActions, { onlyAuto: false });
  return NextResponse.json({
    ok: true,
    autoApplied: result.applied.map((a) => ({ ...a, label: describeAction(a) })),
    skipped: [
      ...result.skipped.map((s) => ({ ...s.action, label: describeAction(s.action), reason: s.reason })),
      ...blocked.map((a) => ({ ...a, label: describeAction(a), reason: "source_disabled" })),
    ],
    patchedSourceBlocks: Object.fromEntries(result.changedKeys.map((k) => [k, result.sourceBlocks[k]])),
    changedKeys: result.changedKeys,
  });
}
