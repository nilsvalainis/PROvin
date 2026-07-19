/**
 * AUTO RECORDS — servisa vēstures parseris (ODOMETER CHECK + tabulas rindas).
 */

import {
  extractOdometerFromFragment,
  findDateInString,
  parseFlexibleDateToken,
} from "@/lib/auto-records-date-odometer-parse";
import { cleanDateStr, parseDotOrIsoDateToMs } from "@/lib/clean-date-str";
import { parseAutoRecordsOdometerTable } from "@/lib/auto-records-odometer-table-parse";
import { sanitizePdfTextForParsing } from "@/lib/pdf-text-sanitize-for-parse";
import { normalizeCountryNameLv } from "@/lib/country-names-lv";

export type AutoRecordsServiceRow = {
  date: string;
  odometer: string;
  country: string;
};

/** Pēdējais vārds pēc pēdējā komata Event Location laukā (piem. „Germany”). */
export function extractCountryFromLocation(location: string): string {
  const t = location.trim();
  if (!t || /^-+$|^(—|–)$/.test(t)) return "";
  const lastComma = t.lastIndexOf(",");
  const segment = lastComma >= 0 ? t.slice(lastComma + 1).trim() : t;
  const words = segment.split(/\s+/).filter(Boolean);
  if (!words.length) return "";
  const lastWord = words[words.length - 1]!;
  if (/^[\d\s,.]+$/.test(lastWord)) return "";
  return sanitizeMileageCountryField(lastWord);
}

/** Noņem komatus un „km”, atstāj tikai ciparus. */
export function normalizeAutoRecordsOdometer(raw: string): string {
  const t = raw.replace(/\s*km\s*/gi, " ").trim();
  return t.replace(/,/g, "").replace(/\s/g, "").replace(/\D/g, "");
}

/** Valsts lauks — tikai teksts; cipari (piem. nobraukuma atliekas) netiek rādīti. */
export function sanitizeMileageCountryField(raw: string): string {
  const t = raw.replace(/\s+/g, " ").trim();
  if (!t || t === "—" || t === "-" || /^[\d\s,.]+$/.test(t)) return "";
  const normalized = normalizeCountryNameLv(t);
  if (!normalized || /^[\d\s,.]+$/.test(normalized)) return "";
  return normalized;
}

/** ISO (YYYY-MM-DD) → DD.MM.YYYY; jau DD.MM.YYYY → normalizē padding; nezināma diena `00.` → `01.`. */
export function formatAutoRecordsDateForOutput(raw: string): string {
  const t = cleanDateStr(raw.trim());
  if (!t) return "";
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const y = +iso[1];
    const m = +iso[2];
    let d = +iso[3];
    if (d === 0) d = 1;
    return `${String(d).padStart(2, "0")}.${String(m).padStart(2, "0")}.${y}`;
  }
  const lv = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (lv) {
    let d = +lv[1];
    const m = +lv[2];
    const y = +lv[3];
    if (d === 0) d = 1;
    return `${String(d).padStart(2, "0")}.${String(m).padStart(2, "0")}.${y}`;
  }
  return t;
}

/** Kārtošanai: ISO vai DD.MM.YYYY → laika zīmogs (ms). */
export function autoRecordsDateSortKey(s: string): number {
  return parseDotOrIsoDateToMs(s);
}

function isHeaderLine(line: string): boolean {
  const l = line.toLowerCase();
  if (l.includes("event date") && l.includes("event location")) return true;
  if (/^status\b/.test(l) && l.includes("event date")) return true;
  return false;
}

function lineHasDateToken(s: string): boolean {
  return Boolean(findDateInString(s));
}

function parseDataLine(line: string): AutoRecordsServiceRow | null {
  const normalized = line.replace(/\|/g, " ").replace(/\s{2,}/g, " ").trim();
  if (!normalized) return null;

  const spaced = parseSpacedOdometerCheckLine(normalized);
  if (spaced) return spaced;

  const parts = normalized
    .split(/\t+|\s{2,}|\|/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  if (parts.length >= 2) {
    const di = parts.findIndex((p) => lineHasDateToken(p));
    if (di >= 0) {
      const dateRaw = findDateInString(parts[di]!) ?? parts[di]!;
      const date = parseFlexibleDateToken(dateRaw);
      const rest = parts.slice(di + 1).join(" ");
      const odometer = extractOdometerFromFragment(rest) || extractOdometerFromFragment(normalized);
      if (date && odometer) {
        const loc = parts[di + 1] ?? "";
        const country = lineHasDateToken(loc) || /^-+$/.test(loc.trim())
          ? ""
          : sanitizeMileageCountryField(extractCountryFromLocation(loc));
        return { date, odometer, country };
      }
    }
  }

  const dateInLine = findDateInString(normalized);
  if (dateInLine) {
    const odometer = extractOdometerFromFragment(normalized);
    if (odometer) {
      const date = parseFlexibleDateToken(dateInLine);
      const beforeKm = normalized.slice(0, normalized.toLowerCase().indexOf("km"));
      const country = sanitizeMileageCountryField(extractCountryFromLocation(beforeKm));
      return { date, odometer, country };
    }
  }

  const m = normalized.match(/^(\d{4}-\d{2}-\d{2}|\d{1,2}[./]\d{1,2}[./]\d{4})\s+(.+)$/);
  if (!m) return null;
  const date = parseFlexibleDateToken(m[1] ?? "");
  const rest = m[2] ?? "";
  const odometer = extractOdometerFromFragment(rest);
  if (!date || !odometer) return null;
  const kmIdx = rest.toLowerCase().indexOf("km");
  const locPart = kmIdx >= 0 ? rest.slice(0, kmIdx) : rest;
  return {
    date,
    odometer,
    country: sanitizeMileageCountryField(extractCountryFromLocation(locPart)),
  };
}

/** YYYY-MM-DD [vieta|-] odometrs km — atstarpēta ODOMETER CHECK tabula no portāla. */
function parseSpacedOdometerCheckLine(line: string): AutoRecordsServiceRow | null {
  const m = line.match(
    /^(\d{4}-\d{2}-\d{2})\s+(?:-\s*|([A-Za-zÀ-ž][^0-9]*?)\s+)?([\d]{1,3}(?:,\d{3})*|\d{1,7})\s*km(?:\s*Service\s*Visit)?/i,
  );
  if (!m) return null;
  const date = parseFlexibleDateToken(m[1] ?? "");
  const odometer = normalizeAutoRecordsOdometer(m[3] ?? "");
  if (!date || !odometer) return null;
  const locRaw = (m[2] ?? "").trim();
  const country = locRaw ? sanitizeMileageCountryField(extractCountryFromLocation(locRaw)) : "";
  return { date, odometer, country };
}

function mergeAutoRecordsParsedRows(rows: AutoRecordsServiceRow[]): AutoRecordsServiceRow[] {
  const byKey = new Map<string, AutoRecordsServiceRow>();
  for (const row of rows) {
    if (!row.date.trim() || !row.odometer.trim()) continue;
    const key = `${row.date}|${row.odometer}`;
    const existing = byKey.get(key);
    if (!existing || (!existing.country && row.country)) {
      byKey.set(key, row);
    }
  }
  return sortAutoRecordsDescending([...byKey.values()]);
}

function formatAutoRecordsParsedRows(rows: AutoRecordsServiceRow[]): AutoRecordsServiceRow[] {
  return mergeAutoRecordsParsedRows(rows).map((r) => ({
    date: formatAutoRecordsDateForOutput(r.date),
    odometer: normalizeAutoRecordsOdometer(r.odometer) || r.odometer.replace(/\D/g, ""),
    country: sanitizeMileageCountryField(r.country),
  }));
}

/** Jaunākais augšā (pēc datuma DD.MM.YYYY / ISO, tad odometra); rindas bez derīga datuma — apakšā. */
export function sortAutoRecordsDescending(rows: AutoRecordsServiceRow[]): AutoRecordsServiceRow[] {
  return [...rows].sort((a, b) => {
    const ka = autoRecordsDateSortKey(a.date);
    const kb = autoRecordsDateSortKey(b.date);
    if (ka !== kb) {
      if (ka === 0) return 1;
      if (kb === 0) return -1;
      return kb - ka;
    }
    const na = parseInt(a.odometer.replace(/\D/g, ""), 10) || 0;
    const nb = parseInt(b.odometer.replace(/\D/g, ""), 10) || 0;
    return nb - na;
  });
}

/**
 * Meklē tekstu no „ODOMETER CHECK”, parsē rindas ar YYYY-MM-DD.
 * Atbalsta tab-atdalītas kolonnas (Status, Event Date, Location, Odometer, Detail) vai brīvu formātu.
 */
export function parseAutoRecordsPaste(raw: string): AutoRecordsServiceRow[] {
  const cleaned = sanitizePdfTextForParsing(raw);
  if (!/ODOMETER\s+CHECK/i.test(cleaned)) return [];

  const tableRows = parseAutoRecordsOdometerTable(cleaned);

  const lines = cleaned.split(/\r?\n/);
  let i = 0;
  while (i < lines.length && !/ODOMETER\s+CHECK/i.test(lines[i]!)) i++;
  if (i >= lines.length) return formatAutoRecordsParsedRows(tableRows);
  i++;
  const lineRows: AutoRecordsServiceRow[] = [];
  for (; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line) continue;
    if (isHeaderLine(line)) continue;
    const row = parseDataLine(line);
    if (row && row.date) lineRows.push(row);
  }

  return formatAutoRecordsParsedRows([...tableRows, ...lineRows]);
}

export function autoRecordsRowHasData(r: AutoRecordsServiceRow): boolean {
  return Boolean(r.date.trim() || r.odometer.trim() || r.country.trim());
}

/** Nobraukuma tabulai — rinda tikai ar faktisku odometru (gads bez km neiet). */
export function autoRecordsMileageRowHasData(r: AutoRecordsServiceRow): boolean {
  const digits = r.odometer.replace(/\D/g, "");
  if (digits.length < 3) return false;
  return Boolean(r.date.trim() || r.country.trim());
}
