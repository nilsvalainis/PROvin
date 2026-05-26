/**
 * AUTO RECORDS — servisa vēstures parseris (ODOMETER CHECK + tabulas rindas).
 */

import {
  extractOdometerFromFragment,
  findDateInString,
  parseFlexibleDateToken,
} from "@/lib/auto-records-date-odometer-parse";
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
  if (!t) return "";
  const lastComma = t.lastIndexOf(",");
  const segment = lastComma >= 0 ? t.slice(lastComma + 1).trim() : t;
  const words = segment.split(/\s+/).filter(Boolean);
  return words.length ? normalizeCountryNameLv(words[words.length - 1]!) : "";
}

/** Noņem komatus un „km”, atstāj tikai ciparus. */
export function normalizeAutoRecordsOdometer(raw: string): string {
  const t = raw.replace(/\s*km\s*/gi, " ").trim();
  return t.replace(/,/g, "").replace(/\D/g, "");
}

/** ISO (YYYY-MM-DD) → DD.MM.YYYY; jau DD.MM.YYYY → normalizē padding. */
export function formatAutoRecordsDateForOutput(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const y = +iso[1];
    const m = +iso[2];
    const d = +iso[3];
    return `${String(d).padStart(2, "0")}.${String(m).padStart(2, "0")}.${y}`;
  }
  const lv = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (lv) {
    const d = +lv[1];
    const m = +lv[2];
    const y = +lv[3];
    return `${String(d).padStart(2, "0")}.${String(m).padStart(2, "0")}.${y}`;
  }
  return t;
}

/** Kārtošanai: ISO vai DD.MM.YYYY → laika zīmogs (ms). */
export function autoRecordsDateSortKey(s: string): number {
  const t = s.trim();
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return Date.UTC(+iso[1], +iso[2] - 1, +iso[3]);
  const lv = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (lv) return Date.UTC(+lv[3], +lv[2] - 1, +lv[1]);
  return 0;
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
        const country =
          lineHasDateToken(loc) ? "" : extractCountryFromLocation(loc).replace(/\s+/g, " ").trim();
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
      const country = extractCountryFromLocation(beforeKm).replace(/\s+/g, " ").trim();
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
    country: extractCountryFromLocation(locPart).replace(/\s+/g, " ").trim(),
  };
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
  const lines = cleaned.split(/\r?\n/);
  let i = 0;
  while (i < lines.length && !/ODOMETER\s+CHECK/i.test(lines[i])) i++;
  if (i >= lines.length) return [];
  i++;
  const out: AutoRecordsServiceRow[] = [];
  for (; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (isHeaderLine(line)) continue;
    const row = parseDataLine(line);
    if (row && row.date) out.push(row);
  }
  const sorted = sortAutoRecordsDescending(out);
  return sorted.map((r) => ({
    date: formatAutoRecordsDateForOutput(r.date),
    odometer: normalizeAutoRecordsOdometer(r.odometer) || r.odometer.replace(/\D/g, ""),
    country: normalizeCountryNameLv(r.country.replace(/\s+/g, " ").trim()),
  }));
}

export function autoRecordsRowHasData(r: AutoRecordsServiceRow): boolean {
  return Boolean(r.date.trim() || r.odometer.trim() || r.country.trim());
}
