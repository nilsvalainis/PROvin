/**
 * auto-records.com ODOMETER CHECK — specifisks PDF teksta formāts (kolonnas bieži sapludinātas).
 *
 * Piemēri no PDF:
 * - `2026-03-28-295,298 kmServiceVisit` (nav atrašanās vietas)
 * - `2025-05-15Vicenza, Italy281,122 kmServiceVisit` (pilsēta, valsts + km)
 */
import {
  autoRecordsRowHasData,
  extractCountryFromLocation,
  formatAutoRecordsDateForOutput,
  normalizeAutoRecordsOdometer,
  sortAutoRecordsDescending,
  type AutoRecordsServiceRow,
} from "@/lib/auto-records-paste-parse";
import { normalizeCountryNameLv } from "@/lib/country-names-lv";

const PLACEHOLDER_LOCATION = /^-+$|^(—|–)$/;

/** Rinda bez atstarpes starp datumu, vietu un km. */
const ROW_NO_LOCATION =
  /^(\d{4}-\d{2}-\d{2})-([\d]{1,3}(?:,\d{3})+)\s*km\s*Service\s*Visit/i;

/** Datums + pilsēta/valsts (var saturēt komatus) + km. */
const ROW_WITH_LOCATION =
  /^(\d{4}-\d{2}-\d{2})([A-Za-zÀ-ž][^0-9]*?)([\d]{1,3}(?:,\d{3})+)\s*km\s*Service\s*Visit/i;

function normalizeLocation(raw: string): string {
  const t = raw.replace(/\s+/g, " ").trim();
  if (!t || PLACEHOLDER_LOCATION.test(t)) return "";
  return extractCountryFromLocation(t).replace(/\s+/g, " ").trim();
}

function parseOdometerTableLine(line: string): AutoRecordsServiceRow | null {
  const trimmed = line.trim();
  if (!trimmed || /^(status|event\s+date|odometer)/i.test(trimmed)) return null;
  if (!/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return null;

  let m = trimmed.match(ROW_NO_LOCATION);
  if (m) {
    const date = formatAutoRecordsDateForOutput(m[1] ?? "");
    const odometer = normalizeAutoRecordsOdometer(m[2] ?? "");
    if (!date || !odometer) return null;
    return { date, odometer, country: "" };
  }

  m = trimmed.match(ROW_WITH_LOCATION);
  if (m) {
    const date = formatAutoRecordsDateForOutput(m[1] ?? "");
    const locRaw = (m[2] ?? "").trim();
    const odometer = normalizeAutoRecordsOdometer(m[3] ?? "");
    if (!date || !odometer) return null;
    const country = normalizeLocation(locRaw);
    return { date, odometer, country: country ? normalizeCountryNameLv(country) : "" };
  }

  return null;
}

/**
 * Parsē ODOMETER CHECK sadaļu no auto-records PDF teksta (pēc sanitizācijas, bez digit-space collapse).
 */
export function parseAutoRecordsOdometerTable(text: string): AutoRecordsServiceRow[] {
  const lines = text.split(/\r?\n/);
  let i = 0;
  while (i < lines.length && !/ODOMETER\s+CHECK/i.test(lines[i]!)) i++;
  if (i >= lines.length) return [];
  i++;

  const out: AutoRecordsServiceRow[] = [];
  const seen = new Set<string>();

  for (; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line) continue;
    if (/^vehicle\s+information/i.test(line)) break;
    if (/^status\s*event\s+date/i.test(line)) continue;

    const row = parseOdometerTableLine(line);
    if (!row || !autoRecordsRowHasData(row)) continue;
    const key = `${row.date}|${row.odometer}|${row.country}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }

  return sortAutoRecordsDescending(out);
}
