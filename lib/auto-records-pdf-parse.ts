/**
 * auto-records.com PDF → AUTO RECORDS `serviceHistory` + PDF checklist heuristika.
 */
import type { SourcePdfChecklist } from "@/lib/admin-source-blocks";
import type { PdfIngestEngine } from "@/lib/pdf-ingest-types";
import {
  rowFromDateKmFragment,
  scanAutoRecordsDateOdometerPairs,
} from "@/lib/auto-records-date-odometer-parse";
import {
  autoRecordsRowHasData,
  parseAutoRecordsPaste,
  sortAutoRecordsDescending,
  type AutoRecordsServiceRow,
} from "@/lib/auto-records-paste-parse";
import { sanitizePdfTextForParsing } from "@/lib/pdf-text-sanitize-for-parse";
import {
  formatSourcePdfComments,
  SOURCE_COMMENT_NO_ISSUES_LV,
} from "@/lib/source-summary-comment-format";
import { mergeOutvinServiceRows } from "@/lib/outvin-history-map";

export type AutoRecordsPdfParseResult = {
  serviceHistory: AutoRecordsServiceRow[];
  rawUnprocessedData: string;
  suggestedPdfChecklist: Partial<SourcePdfChecklist>;
  suggestedComments?: string;
  warnings: string[];
  meta: {
    charCount: number;
    rowCount: number;
    usedOdometerSection: boolean;
    engine?: PdfIngestEngine;
    textBackend?: "pdf-parse" | "pdfjs" | "none";
    /** @deprecated use meta.engine */
    extractionMethod?: "text_layer" | "gemini";
  };
};

const MAX_RAW_SNIPPET = 120_000;

const KM_AFTER_DATE =
  /(\d{4}-\d{2}-\d{2}|\d{1,2}[./]\d{1,2}[./]\d{4})[^\d]{0,220}?(\d{1,3}(?:[,.]?\d{3})*)\s*(?:km)?(?:\s*ServiceVisit)?/gi;

const DAMAGE_HINTS: RegExp[] = [
  /\bstructural\s+damage\b/i,
  /\bframe\s+damage\b/i,
  /\baccident\b/i,
  /\bcollision\b/i,
  /\btotal\s*loss\b/i,
  /\bdamage\s+record\b/i,
  /\bnegad[īi]jum/i,
  /\bav[āa]rij/i,
  /\bsalvage\b/i,
  /\bflood\b/i,
];

/** Regex fallback, ja PDF tekstā nav tabulu / ODOMETER CHECK bloka. */
function parseAutoRecordsPdfRegexFallback(text: string): AutoRecordsServiceRow[] {
  const out: AutoRecordsServiceRow[] = [];
  const seen = new Set<string>();

  const push = (row: AutoRecordsServiceRow | null) => {
    if (!row || !autoRecordsRowHasData(row)) return;
    const key = `${row.date}|${row.odometer}|${row.country}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(row);
  };

  let m: RegExpExecArray | null;
  KM_AFTER_DATE.lastIndex = 0;
  while ((m = KM_AFTER_DATE.exec(text)) !== null) {
    const dateRaw = m[1];
    const kmRaw = m[2];
    const start = Math.max(0, m.index - 20);
    const ctx = text.slice(start, m.index + m[0].length);
    push(rowFromDateKmFragment(dateRaw, `${kmRaw} km ${ctx}`));
  }

  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const tabParts = trimmed.split(/\t+/).map((p) => p.trim()).filter(Boolean);
    if (tabParts.length >= 3) {
      const di = tabParts.findIndex(
        (p) =>
          /^\d{4}-\d{2}-\d{2}$/.test(p) ||
          /^\d{1,2}\.\d{1,2}\.\d{4}$/.test(p) ||
          /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(p),
      );
      if (di >= 0) {
        const dateRaw = tabParts[di]!;
        const loc = tabParts[di + 1] ?? "";
        const odo = tabParts[di + 2] ?? "";
        push(rowFromDateKmFragment(dateRaw, `${odo} km ${loc}`));
        continue;
      }
    }
    const isoLine = trimmed.match(/^(\d{4}-\d{2}-\d{2}|\d{1,2}[./]\d{1,2}[./]\d{4})\s+(.+)$/);
    if (isoLine) {
      push(rowFromDateKmFragment(isoLine[1] ?? "", isoLine[2] ?? ""));
    }
  }

  for (const row of scanAutoRecordsDateOdometerPairs(text)) {
    push(row);
  }

  return sortAutoRecordsDescending(out);
}

function suggestPdfChecklist(text: string, rows: AutoRecordsServiceRow[]): Partial<SourcePdfChecklist> {
  const patch: Partial<SourcePdfChecklist> = {};
  if (rows.length > 0) {
    patch.mileageHistory = true;
    patch.mileageLine = true;
  }
  const sample = text.slice(0, 400_000);
  if (DAMAGE_HINTS.some((re) => re.test(sample))) {
    patch.incidents = true;
  }
  return patch;
}

/**
 * Parsē auto-records.com PDF izvilkto tekstu → tabulas rindas.
 */
export function parseAutoRecordsPdfText(text: string): AutoRecordsPdfParseResult {
  const warnings: string[] = [];
  const trimmed = sanitizePdfTextForParsing(text).trim();
  const charCount = trimmed.length;

  if (!charCount) {
    return {
      serviceHistory: [],
      rawUnprocessedData: "",
      suggestedPdfChecklist: {},
      warnings: ["PDF nesatur izvelkamu tekstu (iespējams skenēts attēls — mēģini iekopēt ODOMETER CHECK no portāla)."],
      meta: { charCount: 0, rowCount: 0, usedOdometerSection: false },
    };
  }

  const usedOdometerSection = /ODOMETER\s+CHECK/i.test(trimmed);
  let rows: AutoRecordsServiceRow[] = [];

  if (usedOdometerSection) {
    rows = parseAutoRecordsPaste(trimmed);
    if (rows.length === 0) {
      warnings.push("Atrasts ODOMETER CHECK, bet tabulas rindas netika atpazītas — mēģināju regex rezervi.");
      rows = parseAutoRecordsPdfRegexFallback(trimmed);
    }
  } else {
    warnings.push("PDF tekstā nav „ODOMETER CHECK” — izmantota rezerves parsēšana (datums + km).");
    rows = parseAutoRecordsPdfRegexFallback(trimmed);
  }

  if (rows.length === 0) {
    rows = scanAutoRecordsDateOdometerPairs(trimmed);
  }

  if (rows.length === 0) {
    warnings.push("Nobraukuma rindas netika atrastas — pārbaudi, vai PDF ir no auto-records.com un satur vēstures tabulu.");
  }

  const rawUnprocessedData = trimmed.slice(0, MAX_RAW_SNIPPET);
  const suggestedPdfChecklist = suggestPdfChecklist(trimmed, rows);
  const hasDamage = DAMAGE_HINTS.some((re) => re.test(trimmed));
  const suggestedComments =
    rows.length > 0 && !hasDamage ?
      SOURCE_COMMENT_NO_ISSUES_LV
    : hasDamage ?
      formatSourcePdfComments(["Iespējami bojājumi / negadījumi tekstā — pārbaudi tabulu"])
    : undefined;

  return {
    serviceHistory: rows,
    rawUnprocessedData,
    suggestedPdfChecklist,
    suggestedComments,
    warnings,
    meta: {
      charCount,
      rowCount: rows.length,
      usedOdometerSection,
      engine: "local_parser",
    },
  };
}

/** Apvieno esošās un no PDF importētās rindas bez dublikātiem. */
export function mergeAutoRecordsServiceHistory(
  existing: AutoRecordsServiceRow[],
  imported: AutoRecordsServiceRow[],
): AutoRecordsServiceRow[] {
  const batches: AutoRecordsServiceRow[][] = [];
  const cur = existing.filter(autoRecordsRowHasData);
  if (cur.length) batches.push(cur);
  if (imported.length) batches.push(imported);
  if (!batches.length) return existing;
  return mergeOutvinServiceRows(batches);
}
