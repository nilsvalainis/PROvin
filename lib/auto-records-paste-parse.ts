/**
 * AUTO RECORDS — servisa vēstures parseris (ODOMETER CHECK + tabulas rindas).
 */

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
  return words.length ? words[words.length - 1]! : "";
}

/** Noņem komatus un „km”, atstāj tikai ciparus. */
export function normalizeAutoRecordsOdometer(raw: string): string {
  const t = raw.replace(/\s*km\s*/gi, " ").trim();
  return t.replace(/,/g, "").replace(/\D/g, "");
}

function isHeaderLine(line: string): boolean {
  const l = line.toLowerCase();
  if (l.includes("event date") && l.includes("event location")) return true;
  if (/^status\b/.test(l) && l.includes("event date")) return true;
  return false;
}

function parseDataLine(line: string): AutoRecordsServiceRow | null {
  const parts = line.split(/\t/).map((p) => p.trim()).filter((p) => p.length > 0);
  if (parts.length >= 3) {
    const di = parts.findIndex((p) => /^\d{4}-\d{2}-\d{2}$/.test(p));
    if (di >= 0) {
      const date = parts[di];
      const loc = parts[di + 1] ?? "";
      const odoRaw = parts[di + 2] ?? "";
      if (/^\d{4}-\d{2}-\d{2}$/.test(loc)) return null;
      return {
        date,
        odometer: normalizeAutoRecordsOdometer(odoRaw),
        country: extractCountryFromLocation(loc),
      };
    }
  }
  const m = line.match(/^(\d{4}-\d{2}-\d{2})\s+(.+)$/);
  if (!m) return null;
  const date = m[1];
  const rest = m[2];
  const kmMatch = rest.match(/([\d,]+)\s*km\b/i);
  const odometer = kmMatch ? normalizeAutoRecordsOdometer(kmMatch[1]) : "";
  let locPart = rest;
  if (kmMatch && kmMatch.index !== undefined) {
    locPart = rest.slice(0, kmMatch.index).trim();
  }
  return { date, odometer, country: extractCountryFromLocation(locPart) };
}

/** Jaunākais augšā (pēc datuma, tad odometra); rindas bez datuma — apakšā. */
export function sortAutoRecordsDescending(rows: AutoRecordsServiceRow[]): AutoRecordsServiceRow[] {
  return [...rows].sort((a, b) => {
    const da = a.date.trim();
    const db = b.date.trim();
    if (!da && !db) return 0;
    if (!da) return 1;
    if (!db) return -1;
    const d = db.localeCompare(da);
    if (d !== 0) return d;
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
  const lines = raw.split(/\r?\n/);
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
  return sortAutoRecordsDescending(out);
}

export function autoRecordsRowHasData(r: AutoRecordsServiceRow): boolean {
  return Boolean(r.date.trim() || r.odometer.trim() || r.country.trim());
}
