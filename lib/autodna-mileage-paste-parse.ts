/**
 * AutoDNA „TRANSPORTLĪDZEKĻA VĒSTURE” — iekopēts teksts → servisa vēstures rindas.
 * Atbalsta DD.MM.YYYY un MM.YYYY (→ 00.MM.YYYY), odometru ar atstarpem, valsti latviski.
 */

import type { AutoRecordsServiceRow } from "@/lib/auto-records-paste-parse";
import {
  autoRecordsMileageRowHasData,
  formatAutoRecordsDateForOutput,
  normalizeAutoRecordsOdometer,
  sortAutoRecordsDescending,
} from "@/lib/auto-records-paste-parse";
import { normalizeCountryNameLv } from "@/lib/country-names-lv";
import {
  looksLikeMileageHistoryOdometerPaste,
  parseMileageHistoryOdometerPaste,
} from "@/lib/mileage-history-odometer-paste-parse";

const HEADER_RE = /^\s*TRANSPORTLĪDZEKĻA\s+VĒSTURE\s*$/i;
const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/i;
const YEAR_HEADER_RE = /^(19|20)\d{2}$/;
const FOOTER_RE =
  /^[0-9a-f-]{8,}[\s-][0-9a-f-]{4,}.*\d{4}-\d{2}-\d{2}.*(?:Lapa|Page)\s*\d+/i;

function normalizeSpaces(s: string): string {
  return s.replace(/\u00a0/g, " ").trim();
}

function isNoiseLine(line: string): boolean {
  const s = normalizeSpaces(line);
  if (!s) return true;
  if (HEADER_RE.test(s)) return true;
  if (YEAR_HEADER_RE.test(s)) return true;
  if (VIN_RE.test(s)) return true;
  if (FOOTER_RE.test(s)) return true;
  if (/^Auto\s+Vēstures\s+Atskaite/i.test(s)) return true;
  if (/^Lapa\s+\d+$/i.test(s)) return true;
  if (/^Rezultāts\s/i.test(s)) return true;
  if (/^Atrašanās\s+vieta\s/i.test(s)) return true;
  if (/^Tehniskā\s+apskate\s+derīga\s+līdz/i.test(s)) return true;
  if (/^Regulārā\s+apkope$/i.test(s)) return true;
  if (/^(Degvielas|Salona|Dzinēja|Eļļas|Bremžu)\s/i.test(s)) return true;
  return false;
}

function isDateLine(line: string): boolean {
  const s = normalizeSpaces(line);
  return /^\d{1,2}\.\d{1,2}\.\d{4}$/.test(s) || /^\d{1,2}\.\d{4}$/.test(s);
}

/** DD.MM.YYYY vai MM.YYYY → DD.MM.YYYY (bez dienas → 00). */
function parseAutodnaDateLine(line: string): string {
  const s = normalizeSpaces(line);
  const ddmmyyyy = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (ddmmyyyy) {
    const d = Number.parseInt(ddmmyyyy[1] ?? "", 10);
    const m = Number.parseInt(ddmmyyyy[2] ?? "", 10);
    const y = ddmmyyyy[3] ?? "";
    if (m < 1 || m > 12 || d < 0 || d > 31) return "";
    return `${String(d).padStart(2, "0")}.${String(m).padStart(2, "0")}.${y}`;
  }
  const mmyyyy = s.match(/^(\d{1,2})\.(\d{4})$/);
  if (mmyyyy) {
    const mo = Number.parseInt(mmyyyy[1] ?? "", 10);
    const y = mmyyyy[2] ?? "";
    if (mo < 1 || mo > 12) return "";
    return `00.${String(mo).padStart(2, "0")}.${y}`;
  }
  return "";
}

function parseKmFromLine(line: string): string {
  const s = normalizeSpaces(line);
  const kmOnly = s.match(/^([\d\s]+)\s*km\s*$/i);
  if (kmOnly) {
    return normalizeAutoRecordsOdometer(kmOnly[1] ?? "") || (kmOnly[1] ?? "").replace(/\D/g, "");
  }
  const inline = s.match(/Odometra\s+rād[īi]jums\s*([\d\s]+)\s*km\b/i);
  if (inline) {
    return normalizeAutoRecordsOdometer(inline[1] ?? "") || (inline[1] ?? "").replace(/\D/g, "");
  }
  return "";
}

function parseCountryFromLine(line: string): string {
  const s = normalizeSpaces(line);
  const m = s.match(/^Valsts\s+(.+)$/i);
  if (!m) return "";
  return normalizeCountryNameLv(m[1]!.trim());
}

type EntryDraft = { date: string; lines: string[] };

function finalizeEntry(draft: EntryDraft): AutoRecordsServiceRow | null {
  if (!draft.date) return null;
  let odometer = "";
  let country = "";
  for (const line of draft.lines) {
    if (!odometer) odometer = parseKmFromLine(line);
    if (!country) country = parseCountryFromLine(line);
  }
  return {
    date: draft.date,
    odometer,
    country,
  };
}

function rowDedupeKey(r: AutoRecordsServiceRow): string {
  return `${r.date}|${r.odometer}|${r.country.trim().toLowerCase()}`;
}

/** Parsē AutoDNA vēstures iekopējumu; dublikātus izlaiž; kārto jaunākais augšā. */
export function parseAutodnaMileagePaste(raw: string): AutoRecordsServiceRow[] {
  const lines = raw.split(/\r?\n/);
  const out: AutoRecordsServiceRow[] = [];
  const seen = new Set<string>();
  let current: EntryDraft | null = null;

  const flush = () => {
    if (!current) return;
    const row = finalizeEntry(current);
    current = null;
    if (!row) return;
    const key = rowDedupeKey(row);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(row);
  };

  for (const rawLine of lines) {
    const line = normalizeSpaces(rawLine);
    if (isNoiseLine(line)) continue;

    if (isDateLine(line)) {
      flush();
      const date = parseAutodnaDateLine(line);
      if (!date) continue;
      current = { date, lines: [] };
      continue;
    }

    if (current) current.lines.push(line);
  }
  flush();

  if (out.length === 0 && looksLikeMileageHistoryOdometerPaste(raw)) {
    return parseMileageHistoryOdometerPaste(raw);
  }

  const sorted = sortAutoRecordsDescending(out);
  return sorted
    .map((r) => ({
      date: formatAutoRecordsDateForOutput(r.date),
      odometer: normalizeAutoRecordsOdometer(r.odometer) || r.odometer.replace(/\D/g, ""),
      country: r.country.trim(),
    }))
    .filter(autoRecordsMileageRowHasData);
}
