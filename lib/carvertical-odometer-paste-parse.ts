/**
 * CarVertical „Odometra rādījumu ieraksti” — iekopēts teksts → servisa vēstures rindas.
 * Atbalsta MM.YYYY. un DD.MM.YYYY., tūkstošu atdalītājs (atstarpe), rindas ar/bez „km”.
 */

import type { AutoRecordsServiceRow } from "@/lib/auto-records-paste-parse";
import {
  formatAutoRecordsDateForOutput,
  normalizeAutoRecordsOdometer,
  sortAutoRecordsDescending,
} from "@/lib/auto-records-paste-parse";

const HEADER_RE = /^\s*Odometra\s+rād[īi]jumu\s+ieraksti\s*$/i;

function normalizeSpaces(s: string): string {
  return s.replace(/\u00a0/g, " ").trim();
}

function parseKmToken(raw: string): string {
  const t = normalizeSpaces(raw);
  if (!t) return "";
  return normalizeAutoRecordsOdometer(t) || t.replace(/\D/g, "");
}

/**
 * Viena rinda: DD.MM.YYYY. … km vai MM.YYYY. … km.
 * Starp datumu un km drīkst būt em/en dash vai atstarpes.
 */
function tryParseLine(line: string): AutoRecordsServiceRow | null {
  const s = normalizeSpaces(line).replace(/[;\s]+$/g, "");
  if (!s || HEADER_RE.test(s)) return null;

  const ddmmyyyy = s.match(
    /^(\d{1,2})\.(\d{1,2})\.(\d{4})\.?\s*[-–—]?\s*([\d\s]+)\s*km\b/i,
  );
  if (ddmmyyyy) {
    const d = Number.parseInt(ddmmyyyy[1] ?? "", 10);
    const m = Number.parseInt(ddmmyyyy[2] ?? "", 10);
    const y = Number.parseInt(ddmmyyyy[3] ?? "", 10);
    if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1980 || y > 2100) return null;
    const km = parseKmToken(ddmmyyyy[4] ?? "");
    if (!km) return null;
    const date = `${String(d).padStart(2, "0")}.${String(m).padStart(2, "0")}.${y}`;
    return { date, odometer: km, country: "" };
  }

  const mmyyyy = s.match(/^(\d{1,2})\.(\d{4})\.?\s*[-–—]?\s*([\d\s]+)\s*km\b/i);
  if (mmyyyy) {
    const mo = Number.parseInt(mmyyyy[1] ?? "", 10);
    const y = Number.parseInt(mmyyyy[2] ?? "", 10);
    if (mo < 1 || mo > 12 || y < 1980 || y > 2100) return null;
    const km = parseKmToken(mmyyyy[3] ?? "");
    if (!km) return null;
    const date = `01.${String(mo).padStart(2, "0")}.${y}`;
    return { date, odometer: km, country: "" };
  }

  return null;
}

/** Parsē visu žurnālu; dublikātus (datums+km) izlaiž; kārto kā AUTO RECORDS (jaunākais augšā). */
export function parseCarverticalOdometerPaste(raw: string): AutoRecordsServiceRow[] {
  const lines = raw.split(/\r?\n/);
  const out: AutoRecordsServiceRow[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    const row = tryParseLine(line);
    if (!row) continue;
    const key = `${row.date}|${row.odometer}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  const sorted = sortAutoRecordsDescending(out);
  return sorted.map((r) => ({
    date: formatAutoRecordsDateForOutput(r.date),
    odometer: normalizeAutoRecordsOdometer(r.odometer) || r.odometer.replace(/\D/g, ""),
    country: "",
  }));
}
