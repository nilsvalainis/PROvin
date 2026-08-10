/**
 * Copilot — iemet ekstrahēto PDF tekstu 100% (cik ietilpst limitā) atbilstošā avota RAW.
 */
import {
  ADMIN_MILEAGE_PASTE_RAW_MAX_LEN,
  ADMIN_PDF_IMPORT_RAW_MAX_LEN,
  ADMIN_RAW_UNPROCESSED_MAX_LEN,
} from "@/lib/admin-raw-field-limits";
import { clipGeminiContextRaw } from "@/lib/admin-gemini-context-raw";
import {
  emptyVendorAvotuBlock,
  mergeSourceBlocksWithDefaults,
  type WorkspaceSourceBlocks,
} from "@/lib/admin-source-blocks";
import type { SourcePdfIngestTarget } from "@/lib/pdf-source-ingest";

function appendText(existing: string, incoming: string, maxLen: number): string {
  const add = incoming.trim();
  if (!add) return existing;
  const base = existing.trim();
  if (!base) return add.slice(0, maxLen);
  // Already have this PDF chunk (or a long prefix) — skip duplicate dumps.
  const marker = add.slice(0, Math.min(add.length, 240));
  if (marker && base.includes(marker)) return base.slice(0, maxLen);
  return `${base}\n\n${add}`.slice(0, maxLen);
}

export function formatCopilotPdfRawChunk(fileName: string, text: string): string {
  const body = text.trim();
  if (!body) return "";
  return `=== PDF: ${fileName.trim() || "report.pdf"} ===\n${body}`;
}

/**
 * Ieraksta pilnu ekstrahēto PDF tekstu avota RAW laukā.
 * AutoDNA/CarVertical → mileagePasteRaw (+ geminiContextRaw AI kontekstam).
 */
export function appendCopilotFullPdfRaw(
  blocks: WorkspaceSourceBlocks,
  target: SourcePdfIngestTarget,
  fileName: string,
  text: string,
): { blocks: WorkspaceSourceBlocks; changed: boolean; chars: number } {
  const chunk = formatCopilotPdfRawChunk(fileName, text);
  if (!chunk) return { blocks, changed: false, chars: 0 };

  const b = mergeSourceBlocksWithDefaults(blocks);

  if (target === "csdd") {
    const prev = b.csdd.rawUnprocessedData ?? "";
    const rawUnprocessedData = appendText(prev, chunk, ADMIN_RAW_UNPROCESSED_MAX_LEN);
    if (rawUnprocessedData === prev) return { blocks: b, changed: false, chars: 0 };
    return {
      changed: true,
      chars: chunk.length,
      blocks: { ...b, csdd: { ...b.csdd, rawUnprocessedData } },
    };
  }

  if (target === "autodna" || target === "carvertical") {
    const cur = { ...emptyVendorAvotuBlock(), ...b[target] };
    const mileagePasteRaw = appendText(cur.mileagePasteRaw ?? "", chunk, ADMIN_MILEAGE_PASTE_RAW_MAX_LEN);
    const geminiContextRaw = clipGeminiContextRaw(
      appendText(cur.geminiContextRaw ?? "", chunk, ADMIN_MILEAGE_PASTE_RAW_MAX_LEN),
    );
    if (mileagePasteRaw === (cur.mileagePasteRaw ?? "") && geminiContextRaw === (cur.geminiContextRaw ?? "")) {
      return { blocks: b, changed: false, chars: 0 };
    }
    return {
      changed: true,
      chars: chunk.length,
      blocks: {
        ...b,
        [target]: { ...cur, mileagePasteRaw, geminiContextRaw },
      },
    };
  }

  if (target === "ltab") {
    const prev = b.ltab.pdfImportRaw ?? "";
    const pdfImportRaw = appendText(prev, chunk, ADMIN_PDF_IMPORT_RAW_MAX_LEN);
    if (pdfImportRaw === prev) return { blocks: b, changed: false, chars: 0 };
    return {
      changed: true,
      chars: chunk.length,
      blocks: { ...b, ltab: { ...b.ltab, pdfImportRaw } },
    };
  }

  if (target === "auto_records") {
    const prev = b.auto_records.rawUnprocessedData ?? "";
    const rawUnprocessedData = appendText(prev, chunk, ADMIN_RAW_UNPROCESSED_MAX_LEN);
    if (rawUnprocessedData === prev) return { blocks: b, changed: false, chars: 0 };
    return {
      changed: true,
      chars: chunk.length,
      blocks: { ...b, auto_records: { ...b.auto_records, rawUnprocessedData } },
    };
  }

  const sections = [...(b.citi_avoti.sections ?? [])];
  if (sections.length === 0) {
    sections.push({
      ...emptyVendorAvotuBlock(),
      rawUnprocessedData: chunk.slice(0, ADMIN_RAW_UNPROCESSED_MAX_LEN),
      label: fileName.replace(/\.pdf$/i, "").slice(0, 80),
    });
  } else {
    const s0 = sections[0]!;
    const prev = s0.rawUnprocessedData ?? "";
    const rawUnprocessedData = appendText(prev, chunk, ADMIN_RAW_UNPROCESSED_MAX_LEN);
    if (rawUnprocessedData === prev) return { blocks: b, changed: false, chars: 0 };
    sections[0] = { ...s0, rawUnprocessedData };
  }
  return {
    changed: true,
    chars: chunk.length,
    blocks: { ...b, citi_avoti: { sections } },
  };
}
