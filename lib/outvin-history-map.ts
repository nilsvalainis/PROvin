/**
 * Outvin GET /history/{VIN}/{type} → AUTO RECORDS nobraukuma rindas.
 */
import type { AutoRecordsServiceRow } from "@/lib/auto-records-paste-parse";
import {
  autoRecordsRowHasData,
  formatAutoRecordsDateForOutput,
  normalizeAutoRecordsOdometer,
  sortAutoRecordsDescending,
} from "@/lib/auto-records-paste-parse";
import { normalizeCountryNameLv } from "@/lib/country-names-lv";

type OutvinLocation = {
  countryName?: string;
  countryCode?: string;
  label?: string;
};

type OutvinHistoryEvent = {
  date?: string;
  mileage?: { unit?: string; value?: number };
  location?: { countryName?: string; countryCode?: string; label?: string; city?: string; state?: string } | boolean;
  type?: string;
};

function locationCountry(loc: OutvinHistoryEvent["location"]): string {
  if (!loc || typeof loc === "boolean") return "";
  const name = typeof loc.countryName === "string" ? loc.countryName.trim() : "";
  if (name) return normalizeCountryNameLv(name);
  const code = typeof loc.countryCode === "string" ? loc.countryCode.trim() : "";
  if (code) return normalizeCountryNameLv(code);
  const label = typeof loc.label === "string" ? loc.label.trim() : "";
  return label ? normalizeCountryNameLv(label) : "";
}

function mileageKmValue(mileage: OutvinHistoryEvent["mileage"]): string {
  if (!mileage || typeof mileage !== "object") return "";
  const raw = mileage.value;
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) return "";
  const unit = (mileage.unit ?? "km").toString().toLowerCase();
  if (unit.includes("mi")) {
    return normalizeAutoRecordsOdometer(String(Math.round(raw * 1.60934)));
  }
  return normalizeAutoRecordsOdometer(String(Math.round(raw)));
}

function rowKey(r: AutoRecordsServiceRow): string {
  return `${formatAutoRecordsDateForOutput(r.date)}|${r.odometer}|${r.country}`;
}

export function extractEventsFromPayload(payload: unknown): OutvinHistoryEvent[] {
  if (!payload || typeof payload !== "object") return [];
  const data = (payload as { data?: unknown }).data;
  if (!data || typeof data !== "object") return [];
  const history = (data as { history?: unknown }).history;
  if (!history || typeof history !== "object") return [];
  const events = (history as { events?: unknown }).events;
  return Array.isArray(events) ? (events as OutvinHistoryEvent[]) : [];
}

export function mapOutvinHistoryEventsToServiceRows(events: OutvinHistoryEvent[]): AutoRecordsServiceRow[] {
  const rows: AutoRecordsServiceRow[] = [];
  for (const ev of events) {
    const dateRaw = typeof ev.date === "string" ? ev.date.trim() : "";
    if (!dateRaw) continue;
    const odometer = mileageKmValue(ev.mileage);
    const country = locationCountry(ev.location);
    if (!odometer && !country) continue;
    const row: AutoRecordsServiceRow = {
      date: formatAutoRecordsDateForOutput(dateRaw),
      odometer,
      country,
    };
    if (autoRecordsRowHasData(row)) rows.push(row);
  }
  return sortAutoRecordsDescending(rows);
}

export function mapOutvinHistoryPayloadToServiceRows(payload: unknown): AutoRecordsServiceRow[] {
  return mapOutvinHistoryEventsToServiceRows(extractEventsFromPayload(payload));
}

/** Apvieno vairāku Outvin atbilžu rindas (type 1 + 2) bez dublikātiem. */
export function mergeOutvinServiceRows(batches: AutoRecordsServiceRow[][]): AutoRecordsServiceRow[] {
  const seen = new Set<string>();
  const out: AutoRecordsServiceRow[] = [];
  for (const batch of batches) {
    for (const r of batch) {
      if (!autoRecordsRowHasData(r)) continue;
      const key = rowKey(r);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(r);
    }
  }
  return sortAutoRecordsDescending(out);
}
