/**
 * Copilot — iemet ekstrahēto PDF tekstu 100% atbilstošā avota RAW
 * (neatkarīgi no tā, vai tabulas jau aizpildītas). Upsert pēc faila nosaukuma.
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

/**
 * Ieraksta / pārraksta pilnu ekstrahēto PDF tekstu avota RAW laukā.
 * AutoDNA/CarVertical → mileagePasteRaw + geminiContextRaw (komentāru ģenerācijai).
 * CSDD / dīleris / citi → rawUnprocessedData (+ geminiContextRaw, ja ir).
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
    const prev = b.csdd.rawUnprocessedData ?? "";
    const rawUnprocessedData = upsertPdfRawChunk(prev, fileName, body, ADMIN_RAW_UNPROCESSED_MAX_LEN);
    const geminiContextRaw = clipGeminiContextRaw(
      upsertPdfRawChunk(b.csdd.geminiContextRaw ?? "", fileName, body, ADMIN_MILEAGE_PASTE_RAW_MAX_LEN),
    );
    if (rawUnprocessedData === prev && geminiContextRaw === (b.csdd.geminiContextRaw ?? "")) {
      return { blocks: b, changed: false, chars: 0 };
    }
    return {
      changed: true,
      chars: chunkLen,
      blocks: { ...b, csdd: { ...b.csdd, rawUnprocessedData, geminiContextRaw } },
    };
  }

  if (target === "autodna" || target === "carvertical") {
    const cur = { ...emptyVendorAvotuBlock(), ...b[target] };
    const mileagePasteRaw = upsertPdfRawChunk(
      cur.mileagePasteRaw ?? "",
      fileName,
      body,
      ADMIN_MILEAGE_PASTE_RAW_MAX_LEN,
    );
    const geminiContextRaw = clipGeminiContextRaw(
      upsertPdfRawChunk(cur.geminiContextRaw ?? "", fileName, body, ADMIN_MILEAGE_PASTE_RAW_MAX_LEN),
    );
    if (mileagePasteRaw === (cur.mileagePasteRaw ?? "") && geminiContextRaw === (cur.geminiContextRaw ?? "")) {
      return { blocks: b, changed: false, chars: 0 };
    }
    return {
      changed: true,
      chars: chunkLen,
      blocks: {
        ...b,
        [target]: { ...cur, mileagePasteRaw, geminiContextRaw },
      },
    };
  }

  if (target === "ltab") {
    const prev = b.ltab.pdfImportRaw ?? "";
    const pdfImportRaw = upsertPdfRawChunk(prev, fileName, body, ADMIN_PDF_IMPORT_RAW_MAX_LEN);
    const geminiContextRaw = clipGeminiContextRaw(
      upsertPdfRawChunk(b.ltab.geminiContextRaw ?? "", fileName, body, ADMIN_MILEAGE_PASTE_RAW_MAX_LEN),
    );
    if (pdfImportRaw === prev && geminiContextRaw === (b.ltab.geminiContextRaw ?? "")) {
      return { blocks: b, changed: false, chars: 0 };
    }
    return {
      changed: true,
      chars: chunkLen,
      blocks: { ...b, ltab: { ...b.ltab, pdfImportRaw, geminiContextRaw } },
    };
  }

  if (target === "auto_records") {
    const prev = b.auto_records.rawUnprocessedData ?? "";
    const rawUnprocessedData = upsertPdfRawChunk(prev, fileName, body, ADMIN_RAW_UNPROCESSED_MAX_LEN);
    const geminiContextRaw = clipGeminiContextRaw(
      upsertPdfRawChunk(b.auto_records.geminiContextRaw ?? "", fileName, body, ADMIN_MILEAGE_PASTE_RAW_MAX_LEN),
    );
    if (rawUnprocessedData === prev && geminiContextRaw === (b.auto_records.geminiContextRaw ?? "")) {
      return { blocks: b, changed: false, chars: 0 };
    }
    return {
      changed: true,
      chars: chunkLen,
      blocks: { ...b, auto_records: { ...b.auto_records, rawUnprocessedData, geminiContextRaw } },
    };
  }

  // citi_avoti
  const sections = [...(b.citi_avoti.sections ?? [])];
  if (sections.length === 0) {
    const chunk = formatCopilotPdfRawChunk(fileName, body).slice(0, ADMIN_RAW_UNPROCESSED_MAX_LEN);
    sections.push({
      ...emptyVendorAvotuBlock(),
      rawUnprocessedData: chunk,
      geminiContextRaw: clipGeminiContextRaw(chunk.slice(0, ADMIN_MILEAGE_PASTE_RAW_MAX_LEN)),
      label: fileName.replace(/\.pdf$/i, "").slice(0, 80),
    });
  } else {
    const s0 = sections[0]!;
    const prev = s0.rawUnprocessedData ?? "";
    const rawUnprocessedData = upsertPdfRawChunk(prev, fileName, body, ADMIN_RAW_UNPROCESSED_MAX_LEN);
    const geminiContextRaw = clipGeminiContextRaw(
      upsertPdfRawChunk(s0.geminiContextRaw ?? "", fileName, body, ADMIN_MILEAGE_PASTE_RAW_MAX_LEN),
    );
    if (rawUnprocessedData === prev && geminiContextRaw === (s0.geminiContextRaw ?? "")) {
      return { blocks: b, changed: false, chars: 0 };
    }
    sections[0] = { ...s0, rawUnprocessedData, geminiContextRaw };
  }
  return {
    changed: true,
    chars: chunkLen,
    blocks: { ...b, citi_avoti: { sections } },
  };
}
