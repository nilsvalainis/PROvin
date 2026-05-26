/**
 * auto-records.com PDF → AUTO RECORDS `serviceHistory` + PDF checklist heuristika.
 */
import type { SourcePdfChecklist } from "@/lib/admin-source-blocks";
import {
  autoRecordsRowHasData,
  extractCountryFromLocation,
  formatAutoRecordsDateForOutput,
  normalizeAutoRecordsOdometer,
  parseAutoRecordsPaste,
  sortAutoRecordsDescending,
  type AutoRecordsServiceRow,
} from "@/lib/auto-records-paste-parse";
import { mergeOutvinServiceRows } from "@/lib/outvin-history-map";
import { normalizeCountryNameLv } from "@/lib/country-names-lv";

export type AutoRecordsPdfParseResult = {
  serviceHistory: AutoRecordsServiceRow[];
  rawUnprocessedData: string;
  suggestedPdfChecklist: Partial<SourcePdfChecklist>;
  warnings: string[];
  meta: {
    charCount: number;
    rowCount: number;
    usedOdometerSection: boolean;
    extractionMethod?: "text_layer" | "gemini";
  };
};

const MAX_RAW_SNIPPET = 120_000;

const KM_AFTER_DATE =
  /(\d{4}-\d{2}-\d{2}|\d{1,2}\.\d{1,2}\.\d{4})[^\d]{0,220}?(\d{1,3}(?:[ \u00a0]?\d{3})*)\s*km\b/gi;

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

function normalizeDateToken(raw: string): string {
  const t = raw.trim();
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return formatAutoRecordsDateForOutput(t);
  const lv = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (lv) return formatAutoRecordsDateForOutput(t);
  return formatAutoRecordsDateForOutput(t);
}

function rowFromDateKmContext(dateRaw: string, kmRaw: string, context: string): AutoRecordsServiceRow | null {
  const date = normalizeDateToken(dateRaw);
  const odometer = normalizeAutoRecordsOdometer(kmRaw);
  if (!date || !odometer) return null;
  const country = extractCountryFromLocation(context).replace(/\s+/g, " ").trim();
  return {
    date,
    odometer,
    country: country ? normalizeCountryNameLv(country) : "",
  };
}

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
    push(rowFromDateKmContext(dateRaw, kmRaw, ctx));
  }

  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const tabParts = trimmed.split(/\t+/).map((p) => p.trim()).filter(Boolean);
    if (tabParts.length >= 3) {
      const di = tabParts.findIndex((p) => /^\d{4}-\d{2}-\d{2}$/.test(p) || /^\d{1,2}\.\d{1,2}\.\d{4}$/.test(p));
      if (di >= 0) {
        const dateRaw = tabParts[di]!;
        const loc = tabParts[di + 1] ?? "";
        const odo = tabParts[di + 2] ?? "";
        push(rowFromDateKmContext(dateRaw, odo, loc));
        continue;
      }
    }
    const isoLine = trimmed.match(/^(\d{4}-\d{2}-\d{2})\s+(.+)$/);
    if (isoLine) {
      const rest = isoLine[2];
      const kmMatch = rest.match(/([\d, \u00a0]+)\s*km\b/i);
      if (kmMatch) {
        push(rowFromDateKmContext(isoLine[1], kmMatch[1], rest));
      }
    }
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
  const trimmed = text.trim();
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
    warnings.push("Nobraukuma rindas netika atrastas — pārbaudi, vai PDF ir no auto-records.com un satur vēstures tabulu.");
  }

  const rawUnprocessedData = trimmed.slice(0, MAX_RAW_SNIPPET);
  const suggestedPdfChecklist = suggestPdfChecklist(trimmed, rows);

  return {
    serviceHistory: rows,
    rawUnprocessedData,
    suggestedPdfChecklist,
    warnings,
    meta: {
      charCount,
      rowCount: rows.length,
      usedOdometerSection,
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
