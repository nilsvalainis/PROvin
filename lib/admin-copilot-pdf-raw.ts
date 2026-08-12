/**
 * Copilot — iemet ekstrahēto PDF tekstu 100% tikai avota AI konteksta laukā
 * (`geminiContextRaw`). RAW / paste laukus (mileagePasteRaw, rawUnprocessedData,
 * pdfImportRaw) NEskār — tie konfliktē ar tabulu aizpildi.
 */
import { ADMIN_MILEAGE_PASTE_RAW_MAX_LEN } from "@/lib/admin-raw-field-limits";
import { clipGeminiContextRaw } from "@/lib/admin-gemini-context-raw";
import {
  emptyVendorAvotuBlock,
  mergeSourceBlocksWithDefaults,
  type WorkspaceSourceBlocks,
} from "@/lib/admin-source-blocks";
import type { SourcePdfIngestTarget } from "@/lib/pdf-source-ingest";

const PDF_CHUNK_RE = /^=== PDF: (.+?) ===\n/;

export function formatCopilotPdfRawChunk(fileName: string, text: string): string {
  const body = text.trim();
  if (!body) return "";
  return `=== PDF: ${fileName.trim() || "report.pdf"} ===\n${body}`;
}

/** Noņem iepriekšējo chunk ar to pašu faila nosaukumu, tad pieliek jauno (100% saturs). */
export function upsertPdfRawChunk(existing: string, fileName: string, text: string, maxLen: number): string {
  const chunk = formatCopilotPdfRawChunk(fileName, text);
  if (!chunk) return existing.slice(0, maxLen);

  const targetName = (fileName.trim() || "report.pdf").toLowerCase();
  const base = existing.trim();
  if (!base) return chunk.slice(0, maxLen);

  const parts = base.split(/\n(?===== PDF: )/);
  const kept: string[] = [];
  for (const part of parts) {
    const m = part.match(PDF_CHUNK_RE);
    const name = (m?.[1] ?? "").trim().toLowerCase();
    if (name && name === targetName) continue;
    const t = part.trim();
    if (t) kept.push(t);
  }
  kept.push(chunk);
  return kept.join("\n\n").slice(0, maxLen);
}

function upsertContext(
  existing: string,
  fileName: string,
  body: string,
): string {
  return clipGeminiContextRaw(
    upsertPdfRawChunk(existing, fileName, body, ADMIN_MILEAGE_PASTE_RAW_MAX_LEN),
  );
}

/**
 * Ieraksta / pārraksta pilnu ekstrahēto PDF tekstu avota «Papildu AI konteksts» laukā.
 * Nekad neraksta mileagePasteRaw / rawUnprocessedData / pdfImportRaw.
 */
export function appendCopilotFullPdfRaw(
  blocks: WorkspaceSourceBlocks,
  target: SourcePdfIngestTarget,
  fileName: string,
  text: string,
): { blocks: WorkspaceSourceBlocks; changed: boolean; chars: number } {
  const body = text.trim();
  if (!body) return { blocks, changed: false, chars: 0 };

  const b = mergeSourceBlocksWithDefaults(blocks);
  const chunkLen = formatCopilotPdfRawChunk(fileName, body).length;

  if (target === "csdd") {
    const prev = b.csdd.geminiContextRaw ?? "";
    const geminiContextRaw = upsertContext(prev, fileName, body);
    if (geminiContextRaw === prev) return { blocks: b, changed: false, chars: 0 };
    return {
      changed: true,
      chars: chunkLen,
      blocks: { ...b, csdd: { ...b.csdd, geminiContextRaw } },
    };
  }

  if (target === "autodna" || target === "carvertical") {
    const cur = { ...emptyVendorAvotuBlock(), ...b[target] };
    const prev = cur.geminiContextRaw ?? "";
    const geminiContextRaw = upsertContext(prev, fileName, body);
    if (geminiContextRaw === prev) return { blocks: b, changed: false, chars: 0 };
    return {
      changed: true,
      chars: chunkLen,
      blocks: {
        ...b,
        [target]: { ...cur, geminiContextRaw },
      },
    };
  }

  if (target === "ltab") {
    const prev = b.ltab.geminiContextRaw ?? "";
    const geminiContextRaw = upsertContext(prev, fileName, body);
    if (geminiContextRaw === prev) return { blocks: b, changed: false, chars: 0 };
    return {
      changed: true,
      chars: chunkLen,
      blocks: { ...b, ltab: { ...b.ltab, geminiContextRaw } },
    };
  }

  if (target === "auto_records") {
    const prev = b.auto_records.geminiContextRaw ?? "";
    const geminiContextRaw = upsertContext(prev, fileName, body);
    if (geminiContextRaw === prev) return { blocks: b, changed: false, chars: 0 };
    return {
      changed: true,
      chars: chunkLen,
      blocks: { ...b, auto_records: { ...b.auto_records, geminiContextRaw } },
    };
  }

  // citi_avoti
  const sections = [...(b.citi_avoti.sections ?? [])];
  if (sections.length === 0) {
    const geminiContextRaw = upsertContext("", fileName, body);
    sections.push({
      ...emptyVendorAvotuBlock(),
      geminiContextRaw,
      label: fileName.replace(/\.pdf$/i, "").slice(0, 80),
    });
  } else {
    const s0 = sections[0]!;
    const prev = s0.geminiContextRaw ?? "";
    const geminiContextRaw = upsertContext(prev, fileName, body);
    if (geminiContextRaw === prev) return { blocks: b, changed: false, chars: 0 };
    sections[0] = { ...s0, geminiContextRaw };
  }
  return {
    changed: true,
    chars: chunkLen,
    blocks: { ...b, citi_avoti: { sections } },
  };
}
