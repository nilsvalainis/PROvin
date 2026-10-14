/**
 * PRO pasūtījuma skata joslas: valstu laika josla (visi avoti) un vienots nobraukuma diapazons katram avotam.
 * Tikai attēlošana no jau ievadītajiem datiem; nekas netiek izdomāts.
 */

import { parseDotOrIsoDateToMs } from "@/lib/clean-date-str";
import { parseOdometerKm } from "@/lib/unified-mileage";
import type { CountryTimeline } from "@/lib/vehicle-country-timeline";

export type CountryTimelineSegment = {
  country: string;
  startMs: number;
  endMs: number;
  startYear: number;
  endYear: number;
  /** `2022` vai `2023-25` */
  yearLabel: string;
};

function yearRangeLabel(startYear: number, endYear: number): string {
  if (startYear === endYear) return String(startYear);
  const sameCentury = Math.floor(startYear / 100) === Math.floor(endYear / 100);
  return sameCentury ? `${startYear}-${String(endYear).slice(2)}` : `${startYear}-${endYear}`;
}

/** Secīgi viena valsts ieraksti → viens posms. */
export function buildCountryTimelineSegments(timeline: CountryTimeline): CountryTimelineSegment[] {
  const out: CountryTimelineSegment[] = [];
  for (const p of timeline.points) {
    const last = out[out.length - 1];
    if (last && last.country === p.country) {
      last.endMs = p.ms;
      continue;
    }
    out.push({ country: p.country, startMs: p.ms, endMs: p.ms, startYear: 0, endYear: 0, yearLabel: "" });
  }
  for (const s of out) {
    s.startYear = new Date(s.startMs).getUTCFullYear();
    s.endYear = new Date(s.endMs).getUTCFullYear();
    s.yearLabel = yearRangeLabel(s.startYear, s.endYear);
  }
  return out;
}

/** Posma platums: pēc laika līdz nākamā posma sākumam; vismaz 1 vienība, lai īss posms paliek redzams. */
export function countryTimelineSegmentWeights(segments: CountryTimelineSegment[]): number[] {
  const DAY = 24 * 60 * 60 * 1000;
  return segments.map((s, i) => {
    const next = segments[i + 1];
    const end = next ? next.startMs : s.endMs;
    return Math.max(1, Math.round((end - s.startMs) / (30 * DAY)));
  });
}

export type MileageRangeInput = { date: string; km: string };

export type MileageRange = {
  firstYear: number;
  lastYear: number;
  firstKm: number;
  lastKm: number;
  readings: number;
};

/** Pirmais un pēdējais derīgais rādījums pēc datuma. Bez derīga datuma + km rindām: `null`. */
export function summarizeMileageRange(rows: readonly MileageRangeInput[]): MileageRange | null {
  const valid = rows
    .map((r) => ({ ms: parseDotOrIsoDateToMs(r.date), km: parseOdometerKm(r.km ?? "") }))
    .filter((r): r is { ms: number; km: number } => r.ms > 0 && r.km != null)
    .sort((a, b) => a.ms - b.ms || a.km - b.km);
  if (valid.length === 0) return null;
  const first = valid[0]!;
  const last = valid[valid.length - 1]!;
  return {
    firstYear: new Date(first.ms).getUTCFullYear(),
    lastYear: new Date(last.ms).getUTCFullYear(),
    firstKm: first.km,
    lastKm: last.km,
    readings: valid.length,
  };
}

export function formatKmLv(km: number): string {
  return String(Math.round(km)).replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0");
}
