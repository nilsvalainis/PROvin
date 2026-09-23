/**
 * Admin Order Copilot — chat + optional PDF → structured table actions.
 */
import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { withAiUsageOnJsonResponse } from "@/lib/admin-ai-route-response";
import { assertAiAllowedForSession } from "@/lib/admin-ai-demo-guard";
import { getAnthropicApiKeyFromEnv } from "@/lib/admin-ai";
import { applyCopilotActions } from "@/lib/admin-copilot-apply";
import { isLikelyCsddPdfText, mergeCsddFieldsFillEmpty } from "@/lib/admin-copilot-csdd";
import { runOrderCopilotAi } from "@/lib/admin-copilot-ai";
import {
  COPILOT_SOURCE_KEYS,
  isCopilotSourceKey,
  isDestructiveCopilotAction,
  type CopilotAction,
  type CopilotChatMessage,
  type CopilotSourceKey,
} from "@/lib/admin-copilot-types";
import {
  appendCopilotChatMessages,
  clearCopilotChat,
  isCopilotChatStoreEnabled,
  readCopilotChat,
} from "@/lib/admin-copilot-chat-store";
import { buildAiOrderContextText } from "@/lib/admin-ai-order-context";
import { mergeSourceBlocksWithDefaults, type WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";
import {
  COPILOT_IMAGE_MAX_FILE_BYTES,
  COPILOT_IMAGE_MAX_FILES,
  COPILOT_IMAGE_MAX_TOTAL_BYTES,
  isCopilotImageMimeType,
  PDF_AI_INLINE_MAX_BYTES,
  PDF_AI_INLINE_MAX_TOTAL_BYTES,
  PDF_MAX_FILE_BYTES,
  PDF_MAX_FILES,
  PDF_MAX_TOTAL_BYTES,
} from "@/lib/pdf-api-limits";
import type { CsddPdfParseResult } from "@/lib/csdd-pdf-ingest";
import { extractPdfTextDetailed } from "@/lib/pdf-text-extract-server";
import { ingestSourcePdfFile } from "@/lib/pdf-source-ingest";
import { csddParseHasData } from "@/lib/source-pdf-ai-extract";
import { detectVendorFromReport, runCcVinPdfAgent, runVendorPdfAgent } from "@/lib/copilot-vendor-pdf-agent";
import { applyFinnikReportToBlock, looksLikeFinnikReport } from "@/lib/finnik-report-parse";
import { fillVendorAiContextIfEmpty } from "@/lib/vendor-ai-context-fill";
import { looksLikeCcVinReport } from "@/lib/cc-vin-report-parse";
import { buildCarinfoCopilotActions, looksLikeCarinfoDump } from "@/lib/admin-copilot-vin-registry";
import {
  parseSourcePdfBlobRefs,
  type SourcePdfBlobRef,
} from "@/lib/admin-source-pdf-blob-constants";
import { deleteSourcePdfBlobs, fetchSourcePdfsFromBlob } from "@/lib/admin-source-pdf-blob-fetch";
import { vendorSourceKey } from "@/lib/vendor-report-extract";

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

/**
 * Pārējais ievāktais audits (kopsavilkumi, sludinājums, operatora piezīmes).
 * Tos pašus laukus klients jau sūta ✨ ģenerēšanas maršrutiem.
 */
function parseAuditContextInput(raw: unknown, sourceBlocks: WorkspaceSourceBlocks, sessionId: string) {
  const parsed =
    typeof raw === "string"
      ? (() => {
          try {
            return JSON.parse(raw) as unknown;
          } catch {
            return null;
          }
        })()
      : raw;
  const b = (parsed && typeof parsed === "object" ? parsed : {}) as Record<string, unknown>;
  return {
    sessionId,
    vin: str(b.vin).trim() || null,
    listingUrl: str(b.listingUrl).trim() || null,
    customerName: str(b.customerName).trim() || null,
    notes: str(b.notes).trim() || null,
    sourceBlocks,
    irissSummary: str(b.iriss),
    inspectionPlan: str(b.apskatesPlāns),
    technicalRiskAnalysis: str(b.tehniskoRiskuAnalize),
    priceFit: str(b.cenasAtbilstiba),
    internalComment: str(b.internalComment),
    mileageComment: str(b.mileageComment),
    sourcesComparisonComment: str(b.sourcesComparisonComment),
    operatorNotes: str(b.operatorNotes),
  };
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
  return out;
}

function describeAction(a: CopilotAction): string {
  if (a.type === "upsert_incident") {
    return `${a.source} · negadījums ${a.date || "—"} · ${a.lossAmount || "—"} · ${a.country || "—"} (${a.confidence})`;
  }
  if (a.type === "upsert_mileage") {
    return `${a.source} · nobraukums ${a.date || "—"} · ${a.odometer || "—"} km · ${a.country || "—"} (${a.confidence})`;
  }
  if (a.type === "upsert_vehicle_history_timeline_row") {
    const odo = a.odometer?.trim() ? ` · ${a.odometer} km` : "";
    return `${a.source} · laikposma fakts ${a.date || "—"}${odo} · ${a.description || "—"} · ${a.country || "—"} (${a.confidence})`;
  }
  if (a.type === "set_service_history") {
    const lines = a.text.trim().split(/\n+/).filter(Boolean).length;
    return `auto_records · Servisa vēsture (${lines} rindas) (${a.confidence})`;
  }
  if (a.type === "upsert_service_work") {
    const place = a.location.trim() ? ` · ${a.location.slice(0, 40)}` : "";
    return `auto_records · apkope ${a.date || "—"} · ${a.odometer || "—"} km${place} · ${a.works.slice(0, 60)} (${a.confidence})`;
  }
  if (a.type === "set_dealer_vehicle_info") {
    return `auto_records · dīlera dati: ${Object.keys(a.vehicleInfo).join(", ")} (${a.confidence})`;
  }
  if (a.type === "append_raw") {
    const preview = a.text.trim().slice(0, 60).replace(/\s+/g, " ");
    return `${a.source} · RAW · ${preview}${a.text.trim().length > 60 ? "…" : ""} (${a.confidence})`;
  }
  if (a.type === "set_registry_fields") {
    return `${a.source} · īpašnieki/statusi/RED FLAG (${a.confidence})`;
  }
  if (a.type === "set_ltab_certificate") {
    const n = a.certificate.claims.length;
    return `ltab · izziņa · ${n} CSNg (${a.confidence})`;
  }
  if (a.type === "delete_incident") {
    const loss = a.lossAmount?.trim() ? ` · ${a.lossAmount}` : " · visas šī datuma rindas";
    return `DZĒST · ${a.source} · negadījums ${a.date}${loss}`;
  }
  if (a.type === "delete_mileage") {
    const odo = a.odometer?.trim() ? ` · ${a.odometer} km` : " · visas šī datuma rindas";
    return `DZĒST · ${a.source} · nobraukums ${a.date}${odo}`;
  }
  if (a.type === "delete_service_work") {
    const odo = a.odometer?.trim() ? ` · ${a.odometer} km` : " · visas šī datuma rindas";
    return `DZĒST · auto_records · apkope ${a.date}${odo}`;
  }
  if (a.type === "clear_field") {
    return `IZTĪRĪT · ${a.source} · lauks „${a.field}”`;
  }
  const _exhaustive: never = a;
  return String(_exhaustive);
}

/** Servera sarunas atmiņa — atver pasūtījumu citā ierīcē un čats ir turpat. */
export async function GET(req: Request) {
  const ok = await getAdminSession();
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sessionId = new URL(req.url).searchParams.get("sessionId")?.trim() ?? "";
  if (!sessionId) return NextResponse.json({ error: "missing_session" }, { status: 400 });
  if (!isCopilotChatStoreEnabled()) {
    return NextResponse.json({ ok: true, enabled: false, messages: [], allowedSources: [] });
  }

  const doc = await readCopilotChat(sessionId);
  return NextResponse.json({
    ok: true,
    enabled: true,
    messages: doc?.messages ?? [],
    allowedSources: doc?.allowedSources ?? [],
    updatedAt: doc?.updatedAt ?? null,
  });
}

/** Notīra pasūtījuma Copilot sarakstes vēsturi (tabulas netiek aiztiktas). */
export async function DELETE(req: Request) {
  const ok = await getAdminSession();
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sessionId = new URL(req.url).searchParams.get("sessionId")?.trim() ?? "";
  if (!sessionId) return NextResponse.json({ error: "missing_session" }, { status: 400 });
  const cleared = await clearCopilotChat(sessionId);
  return NextResponse.json({ ok: true, cleared });
}

export async function POST(req: Request) {
  const ok = await getAdminSession();
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (!getAnthropicApiKeyFromEnv()) {
    return NextResponse.json({ error: "missing_ai_key" }, { status: 503 });
  }

  return withAiUsageOnJsonResponse(async () => {
  const contentType = req.headers.get("content-type") || "";
  let sessionId = "";
  let message = "";
  let history: CopilotChatMessage[] = [];
  let sourceBlocks: WorkspaceSourceBlocks | null = null;
  let allowedSources: CopilotSourceKey[] = [...COPILOT_SOURCE_KEYS];
  const pdfs: { fileName: string; buffer: ArrayBuffer }[] = [];
  const photos: { fileName: string; mimeType: string; buffer: ArrayBuffer }[] = [];
  /** Lieli PDF ceļo caur Vercel Blob — funkcijas pieprasījuma ķermenis ir ~4,5 MB. */
  let blobRefs: SourcePdfBlobRef[] = [];
  let applyMode: "auto" | "preview" = "auto";
  let auditContextRaw: unknown = null;

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
      auditContextRaw = form.get("auditContext");

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

      const imageFiles = unique.filter((f) => isCopilotImageMimeType(f.type || ""));
      const pdfFiles = unique.filter((f) => !isCopilotImageMimeType(f.type || ""));

      if (pdfFiles.length > PDF_MAX_FILES) {
        return NextResponse.json(
          { error: "too_many_files", detail: `Maks. ${PDF_MAX_FILES} PDF vienā reizē` },
          { status: 400 },
        );
      }
      if (imageFiles.length > COPILOT_IMAGE_MAX_FILES) {
        return NextResponse.json(
          { error: "too_many_files", detail: `Maks. ${COPILOT_IMAGE_MAX_FILES} fotogrāfijas vienā reizē` },
          { status: 400 },
        );
      }

      let photoBytes = 0;
      for (const file of imageFiles) {
        if (file.size > COPILOT_IMAGE_MAX_FILE_BYTES) {
          return NextResponse.json(
            {
              error: "file_too_large",
              detail: `${file.name}: maks. ${Math.round(COPILOT_IMAGE_MAX_FILE_BYTES / (1024 * 1024))} MB vienai fotogrāfijai`,
            },
            { status: 413 },
          );
        }
        photoBytes += file.size;
        if (photoBytes > COPILOT_IMAGE_MAX_TOTAL_BYTES) {
          return NextResponse.json(
            {
              error: "file_too_large",
              detail: `Kopā pārāk lielas fotogrāfijas (maks. ${Math.round(COPILOT_IMAGE_MAX_TOTAL_BYTES / (1024 * 1024))} MB)`,
            },
            { status: 413 },
          );
        }
        photos.push({
          fileName: file.name || "foto.jpg",
          mimeType: (file.type || "image/jpeg").toLowerCase(),
          buffer: await file.arrayBuffer(),
        });
      }

      let totalBytes = 0;
      let inlineBytes = 0;
      for (const file of pdfFiles) {
        const name = (file.name || "report.pdf").toLowerCase();
        const mime = (file.type || "").toLowerCase();
        if (mime && mime !== "application/pdf" && !mime.includes("pdf")) {
          return NextResponse.json(
            { error: "invalid_file_type", detail: `Tikai PDF vai foto: ${file.name}` },
            { status: 400 },
          );
        }
        if (name && !name.endsWith(".pdf")) {
          return NextResponse.json(
            { error: "invalid_file_type", detail: `Tikai PDF vai foto: ${file.name}` },
            { status: 400 },
          );
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
        if (buffer.byteLength > PDF_AI_INLINE_MAX_BYTES) {
          return NextResponse.json(
            {
              error: "file_too_large",
              detail: `${file.name}: pārāk liels AI inline (maks. ~${Math.round(PDF_AI_INLINE_MAX_BYTES / (1024 * 1024))} MB)`,
            },
            { status: 413 },
          );
        }
        inlineBytes += buffer.byteLength;
        if (inlineBytes > PDF_AI_INLINE_MAX_TOTAL_BYTES) {
          return NextResponse.json(
            {
              error: "file_too_large",
              detail: `Kopā pārāk daudz PDF vienam AI pieprasījumam (maks. ~${Math.round(PDF_AI_INLINE_MAX_TOTAL_BYTES / (1024 * 1024))} MB) — sadali pa vairākiem izsaukumiem`,
            },
            { status: 413 },
          );
        }
        pdfs.push({ fileName: file.name || "report.pdf", buffer });
      }
      blobRefs = parseSourcePdfBlobRefs(str(form.get("fileUrls")), PDF_MAX_FILES);
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
      auditContextRaw = b.auditContext ?? null;
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
  if (blobRefs.length > 0) {
    try {
      for (const fetched of await fetchSourcePdfsFromBlob(sessionId, blobRefs)) {
        pdfs.push({ fileName: fetched.fileName, buffer: fetched.buffer });
      }
    } catch (e) {
      const detail = e instanceof Error ? e.message : "unknown";
      console.error(`${LOG_PREFIX} blob_fetch_failed`, detail);
      await deleteSourcePdfBlobs(blobRefs.map((r) => r.url));
      return NextResponse.json({ error: "blob_fetch_failed", detail }, { status: 502 });
    }
  }
  if (!message && pdfs.length === 0 && photos.length === 0) {
    return NextResponse.json(
      { error: "empty_message", detail: "Ieraksti ziņu vai pievieno PDF / foto" },
      { status: 400 },
    );
  }
  if (!sourceBlocks) {
    return NextResponse.json({ error: "missing_source_blocks" }, { status: 400 });
  }

  const guard = await assertAiAllowedForSession(sessionId);
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
    const vendorAgentNotes: string[] = [];
    const vendorAgentApplied: CopilotAction[] = [];
    const vendorHandledFiles = new Set<string>();

    for (const pdf of pdfs) {
      let pdfText = "";
      try {
        const extracted = await extractPdfTextDetailed(pdf.buffer, { fileName: pdf.fileName });
        pdfText = extracted.text ?? "";
      } catch {
        pdfText = "";
      }

      if (allowedSet.has("finnik") && looksLikeFinnikReport(`${pdf.fileName}\n${pdfText}`)) {
        const applied = applyFinnikReportToBlock(workingBlocks.finnik, pdfText);
        if (applied) {
          workingBlocks = { ...workingBlocks, finnik: applied.block };
          vendorAgentNotes.push(applied.summary);
          vendorHandledFiles.add(pdf.fileName);
          continue;
        }
      }

      const detected = detectVendorFromReport(pdfText, pdf.fileName);
      if (detected && allowedSet.has(vendorSourceKey(detected))) {
        try {
          const agent = await runVendorPdfAgent({
            target: detected,
            fileName: pdf.fileName,
            buffer: pdf.buffer,
            sourceBlocks: workingBlocks,
          });
          const result = applyCopilotActions(workingBlocks, agent.actions, { onlyAuto: false });
          workingBlocks = result.sourceBlocks;
          if (detected === "autodna" || detected === "carvertical") {
            const filled = fillVendorAiContextIfEmpty(workingBlocks[detected], pdfText);
            if (filled.aiContextRaw !== workingBlocks[detected].aiContextRaw) {
              workingBlocks = { ...workingBlocks, [detected]: filled };
            }
          }
          vendorAgentApplied.push(...result.applied);
          vendorAgentNotes.push(agent.summary, ...agent.notes.slice(0, 4));
          vendorHandledFiles.add(pdf.fileName);
        } catch (vendorErr) {
          const detail = vendorErr instanceof Error ? vendorErr.message : "unknown";
          console.warn(`${LOG_PREFIX} vendor_pdf_failed`, { fileName: pdf.fileName, detail });
          vendorAgentNotes.push(`„${pdf.fileName}” — avota aģents neizdevās (${detail}).`);
        }
        continue;
      }

      if (allowedSet.has("cc_vin") && looksLikeCcVinReport(pdfText, pdf.fileName)) {
        try {
          const agent = await runCcVinPdfAgent({
            fileName: pdf.fileName,
            buffer: pdf.buffer,
            previous: workingBlocks.cc_vin,
          });
          if (agent.block) {
            workingBlocks = { ...workingBlocks, cc_vin: agent.block };
            vendorAgentNotes.push(agent.summary, ...agent.notes.slice(0, 4));
            // Servisa vizītes paliek ģenēriskajam Copilot (auto_records), ja tas ir ieslēgts.
            if (!allowedSet.has("auto_records")) vendorHandledFiles.add(pdf.fileName);
          } else if (agent.summary) {
            vendorAgentNotes.push(agent.summary);
          }
        } catch (ccVinErr) {
          const detail = ccVinErr instanceof Error ? ccVinErr.message : "unknown";
          console.warn(`${LOG_PREFIX} cc_vin_pdf_failed`, { fileName: pdf.fileName, detail });
          vendorAgentNotes.push(`„${pdf.fileName}” — CC.VIN parseris neizdevās (${detail}).`);
        }
      }
    }

    if (allowedSet.has("csdd") && pdfs.length > 0) {
      for (const pdf of pdfs) {
        if (vendorHandledFiles.has(pdf.fileName)) continue;
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

    // Avota aģents jau izlasīja šos PDF — ģenēriskajam Copilot tos vairs nedodam (nedublējam rindas).
    const remainingPdfs = pdfs.filter((p) => !vendorHandledFiles.has(p.fileName));
    let finnikPasteNote = "";
    if (allowedSet.has("finnik") && looksLikeFinnikReport(message)) {
      const applied = applyFinnikReportToBlock(workingBlocks.finnik, message);
      if (applied) {
        workingBlocks = { ...workingBlocks, finnik: applied.block };
        finnikPasteNote = applied.summary;
      }
    }
    const carinfoPasteActions =
      allowedSet.has("carinfo") && looksLikeCarinfoDump(message) ? buildCarinfoCopilotActions(message) : [];
    const skipGenericCopilot =
      photos.length === 0 &&
      ((allowedSet.has("csdd") &&
        allowedSources.length === 1 &&
        pdfs.length > 0 &&
        csddImportNotes.some((n) => n.includes("aizpildīti"))) ||
        (!message && remainingPdfs.length === 0 && vendorHandledFiles.size > 0) ||
        (carinfoPasteActions.length > 0 && remainingPdfs.length === 0) ||
        (finnikPasteNote.length > 0 && remainingPdfs.length === 0));

    /** Copilotam jāredz tas pats audits, ko redz FLASH MAX: kopsavilkumi, sludinājums, operatora piezīmes. */
    let auditContextText = "";
    if (!skipGenericCopilot) {
      try {
        auditContextText = buildAiOrderContextText(
          parseAuditContextInput(auditContextRaw, workingBlocks, sessionId),
        );
      } catch (ctxErr) {
        console.warn(`${LOG_PREFIX} audit_context_failed`, ctxErr instanceof Error ? ctxErr.message : "unknown");
      }
    }

    const ai = skipGenericCopilot
      ? {
          reply:
            finnikPasteNote
              ? `${finnikPasteNote} Pārbaudi NĪDERLANDES REĢISTRI bloku.`
              : carinfoPasteActions.length > 0
              ? "car.info teksts ielasīts: nobraukums, īpašnieki, statusi un RED FLAG. Pārbaudi ZVIEDRIJAS REĢISTRI bloku."
              : [...vendorAgentNotes, ...csddImportNotes].filter(Boolean).join("\n") ||
                "PDF apstrādāts — pārbaudi avota laukus, ja kaut kas trūkst.",
          actions: carinfoPasteActions,
          clarificationNeeded: "",
        }
      : await runOrderCopilotAi({
          message,
          sourceBlocks: workingBlocks,
          allowedSources,
          history,
          pdfs: remainingPdfs,
          photos,
          auditContext: auditContextText,
        });

    const blocked = ai.actions.filter((a) => !allowedSet.has(a.source));
    const allowedActions = ai.actions.filter((a) => allowedSet.has(a.source));

    const autoResult = applyCopilotActions(workingBlocks, allowedActions, {
      onlyAuto: true,
      clarificationNeeded: ai.clarificationNeeded,
    });
    workingBlocks = autoResult.sourceBlocks;

    const changedKeys = new Set<CopilotSourceKey>(autoResult.changedKeys);
    for (const key of COPILOT_SOURCE_KEYS) {
      if (workingBlocks[key] !== sourceBlocks[key]) changedKeys.add(key);
    }

    const needsConfirm = autoResult.skipped.filter((s) => s.reason === "needs_confirm").map((s) => s.action);
    const hardSkipped = [
      ...autoResult.skipped.filter((s) => s.reason !== "needs_confirm"),
      ...blocked.map((action) => ({ action, reason: "source_disabled" as const })),
    ];

    const shouldPatch = applyMode === "auto" && (autoResult.applied.length > 0 || changedKeys.size > 0);
    const replyParts = [ai.reply.trim()];
    if (!skipGenericCopilot) {
      if (vendorAgentNotes.length > 0) replyParts.push(vendorAgentNotes.filter(Boolean).join("\n"));
      if (csddImportNotes.length > 0) replyParts.push(csddImportNotes.join("\n"));
    }

    console.info(`${LOG_PREFIX} ok`, {
      sessionId: sessionId.slice(0, 12),
      actions: ai.actions.length,
      allowedSources,
      auto: autoResult.applied.length,
      confirm: needsConfirm.length,
      destructiveProposed: ai.actions.filter(isDestructiveCopilotAction).length,
      pdfCount: pdfs.length,
      photoCount: photos.length,
      auditContextChars: auditContextText.length,
      vendorAgentPdfs: vendorHandledFiles.size,
      vendorAgentApplied: vendorAgentApplied.length,
      csddImports: csddImportNotes.length,
    });

    const changedList = [...changedKeys];
    const replyText = replyParts.filter(Boolean).join("\n\n");

    // Saruna glabājas serverī, lai neizzustu, mainot ierīci vai pārlūku.
    const attachmentLabel = [
      pdfs.length ? `${pdfs.length} PDF` : "",
      photos.length ? `${photos.length} foto` : "",
    ]
      .filter(Boolean)
      .join(" + ");
    void appendCopilotChatMessages(
      sessionId,
      [
        { role: "user", content: message || `(${attachmentLabel || "pielikums"})` },
        { role: "assistant", content: replyText },
      ],
      allowedSources,
    ).catch((chatErr) => {
      console.warn(`${LOG_PREFIX} chat_persist_failed`, chatErr instanceof Error ? chatErr.message : "unknown");
    });

    return NextResponse.json({
      ok: true,
      reply: replyText,
      clarificationNeeded: ai.clarificationNeeded,
      actions: ai.actions.map((a) => ({ ...a, label: describeAction(a) })),
      autoApplied: shouldPatch
        ? [...vendorAgentApplied, ...autoResult.applied].map((a) => ({ ...a, label: describeAction(a) }))
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
    if (msg === "missing_ai_key") {
      return NextResponse.json({ error: "missing_ai_key" }, { status: 503 });
    }
    if (msg === "ai_invalid_json") {
      return NextResponse.json({ error: "extraction_failed", detail: "AI atgrieza nederīgu JSON" }, { status: 502 });
    }
    return NextResponse.json({ error: "generation_failed", detail: msg }, { status: 502 });
  } finally {
    await deleteSourcePdfBlobs(blobRefs.map((r) => r.url));
  }
  });
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

  const guard = await assertAiAllowedForSession(sessionId);
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
  const { parseCopilotAiPayload } = await import("@/lib/admin-copilot-parse");
  let actions: CopilotAction[] = [];
  try {
    const parsed = parseCopilotAiPayload(
      JSON.stringify({ reply: "", clarificationNeeded: "", actions: actionsRaw }),
    );
    actions = parsed.actions;
  } catch {
    return NextResponse.json({ error: "invalid_actions" }, { status: 400 });
  }

  const allowedSet = new Set<CopilotSourceKey>(allowedSources);
  const allowedActions = actions.filter((a) => allowedSet.has(a.source));
  const blocked = actions.filter((a) => !allowedSet.has(a.source));
  // Apstiprinājuma ceļš ir vienīgais, kas drīkst dzēst.
  const result = applyCopilotActions(sourceBlocks, allowedActions, {
    onlyAuto: false,
    allowDestructive: true,
  });
  return NextResponse.json({
    ok: true,
    destructiveApplied: result.applied.filter(isDestructiveCopilotAction).length,
    autoApplied: result.applied.map((a) => ({ ...a, label: describeAction(a) })),
    skipped: [
      ...result.skipped.map((s) => ({ ...s.action, label: describeAction(s.action), reason: s.reason })),
      ...blocked.map((a) => ({ ...a, label: describeAction(a), reason: "source_disabled" })),
    ],
    patchedSourceBlocks: Object.fromEntries(result.changedKeys.map((k) => [k, result.sourceBlocks[k]])),
    changedKeys: result.changedKeys,
  });
}
