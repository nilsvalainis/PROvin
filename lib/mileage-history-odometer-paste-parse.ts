/**
 * „Mileage history / Reported odometer readings” — iekopēts teksts (inspection + km + ISO datums).
 * Izmanto Citi avoti RAW žurnālu un līdzīgus avotus.
 */

import type { AutoRecordsServiceRow } from "@/lib/auto-records-paste-parse";
import {
  formatAutoRecordsDateForOutput,
  normalizeAutoRecordsOdometer,
  sortAutoRecordsDescending,
} from "@/lib/auto-records-paste-parse";

const HEADER_RE =
  /^(mileage\s+history|reported\s+odometer\s+readings|odometer\s+readings?)$/i;
const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const ODOMETER_KM_RE = /^([\d,]+)\s*km\s*$/i;

function normalizeSpaces(s: string): string {
  return s.replace(/\u00a0/g, " ").replace(/[;]+$/g, "").trim();
}

function splitRawLines(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .flatMap((line) => line.split(/;/))
    .map((line) => normalizeSpaces(line))
    .filter(Boolean);
}

function parseIsoDateLine(line: string): string {
  const m = line.match(ISO_DATE_RE);
  if (!m) return "";
  const y = Number.parseInt(m[1] ?? "", 10);
  const mo = Number.parseInt(m[2] ?? "", 10);
  const d = Number.parseInt(m[3] ?? "", 10);
  if (y < 1900 || y > 2100 || mo < 1 || mo > 12 || d < 0 || d > 31) return "";
  return formatAutoRecordsDateForOutput(`${m[1]}-${m[2]}-${m[3]}`);
}

function parseOdometerKmLine(line: string): string {
  const m = line.match(ODOMETER_KM_RE);
  if (!m) return "";
  return normalizeAutoRecordsOdometer(m[1] ?? "");
}

/** Vai teksts izskatās pēc Mileage history odometra žurnāla. */
export function looksLikeMileageHistoryOdometerPaste(raw: string): boolean {
  const t = raw.trim();
  if (!t) return false;
  if (/mileage\s+history/i.test(t) && /reported\s+odometer\s+readings/i.test(t)) return true;
  const lines = splitRawLines(t);
  let isoDates = 0;
  let kmLines = 0;
  for (const line of lines) {
    if (ISO_DATE_RE.test(line)) isoDates += 1;
    if (ODOMETER_KM_RE.test(line)) kmLines += 1;
  }
  return isoDates >= 2 && kmLines >= 2;
}

/** Parsē odometra + ISO datuma trīs rindu blokus (event, km, date). */
export function parseMileageHistoryOdometerPaste(raw: string): AutoRecordsServiceRow[] {
  const lines = splitRawLines(raw);
  const rows: AutoRecordsServiceRow[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (HEADER_RE.test(line)) continue;

    const date = parseIsoDateLine(line);
    if (!date) continue;

    const prev = lines[i - 1] ?? "";
    const odometer = parseOdometerKmLine(prev);
    if (odometer === "") continue;

    const key = `${date}|${odometer}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ date, odometer, country: "" });
  }

  return sortAutoRecordsDescending(rows.filter((r) => Boolean(r.date.trim() && r.odometer !== "")));
}
