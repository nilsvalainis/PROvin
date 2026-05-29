/**
 * AUTO RECORDS — elastīgi datuma / odometra tokeni no netīra PDF teksta.
 */
import { cleanDateInput } from "@/lib/clean-date-str";
import {
  extractCountryFromLocation,
  formatAutoRecordsDateForOutput,
  normalizeAutoRecordsOdometer,
  type AutoRecordsServiceRow,
} from "@/lib/auto-records-paste-parse";
import { normalizeCountryNameLv } from "@/lib/country-names-lv";

const DATE_TOKEN =
  /(\d{4}-\d{2}-\d{2}|\d{1,2}[./]\d{1,2}[./]\d{4}|\d{1,2}-\d{1,2}-\d{4})/;

const ODOMETER_TOKEN =
  /(\d{1,3}(?:[,.]\d{3})*|\d{4,7})\s*(?:km)?(?:\s*ServiceVisit)?/i;

export function parseFlexibleDateToken(raw: string): string {
  const t = cleanDateInput(raw);
  if (!t) return "";
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return formatAutoRecordsDateForOutput(t);
  const slash = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    return formatAutoRecordsDateForOutput(`${slash[1]}.${slash[2]}.${slash[3]}`);
  }
  const dash = t.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dash) {
    return formatAutoRecordsDateForOutput(`${dash[1]}.${dash[2]}.${dash[3]}`);
  }
  return formatAutoRecordsDateForOutput(t);
}

export function extractOdometerFromFragment(fragment: string): string {
  const m = fragment.match(ODOMETER_TOKEN);
  if (!m?.[1]) return "";
  return normalizeAutoRecordsOdometer(m[1]) || m[1].replace(/[^\d]/g, "");
}

export function findDateInString(s: string): string | null {
  const m = s.match(DATE_TOKEN);
  if (!m?.[1]) return null;
  const d = parseFlexibleDateToken(m[1]);
  return d || null;
}

export function rowFromDateKmFragment(
  dateRaw: string,
  context: string,
): AutoRecordsServiceRow | null {
  const date = parseFlexibleDateToken(dateRaw);
  const odometer = extractOdometerFromFragment(context);
  if (!date || !odometer) return null;
  const country = extractCountryFromLocation(context).replace(/\s+/g, " ").trim();
  return {
    date,
    odometer,
    country: country ? normalizeCountryNameLv(country) : "",
  };
}

/** Globāla skenēšana: datums + km pat pie pielīgušiem tokeniem. */
export function scanAutoRecordsDateOdometerPairs(text: string): AutoRecordsServiceRow[] {
  const out: AutoRecordsServiceRow[] = [];
  const seen = new Set<string>();
  const re =
    /(\d{4}-\d{2}-\d{2}|\d{1,2}[./]\d{1,2}[./]\d{4})[^\d]{0,160}?(\d{1,3}(?:[,.]\d{3})*|\d{4,7})\s*(?:km)?(?:\s*ServiceVisit)?/gi;

  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const dateRaw = m[1] ?? "";
    const kmRaw = m[2] ?? "";
    const ctx = text.slice(Math.max(0, m.index - 30), m.index + m[0].length + 40);
    const row = rowFromDateKmFragment(dateRaw, `${kmRaw} km ${ctx}`);
    if (!row?.date || !row.odometer) continue;
    const key = `${row.date}|${row.odometer}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}
