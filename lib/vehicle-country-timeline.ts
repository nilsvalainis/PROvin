/**
 * Transportlīdzekļa „dzīves cikls pa valstīm” — valsts noteikšana konkrētam datumam.
 *
 * Avoti: CarVertical „Laikposms” (Transportlīdzekļa ierakstu laikposms), AutoDNA
 * vēstures notikumi ar „Valsts …”, CSDD reģistrācijas dati. Ja periods ir neviennozīmīgs
 * (pirms/pēc atšķiras valstis), atgriež tukšu — valsti neizdomājam.
 */

import { normalizeCountryNameLv } from "@/lib/country-names-lv";

export type CountryTimelineEntry = {
  /** DD.MM.YYYY */
  date: string;
  /** Latviskais valsts nosaukums; tukšs = „Nezināma valsts”. */
  country: string;
};

type Point = { ms: number; monthKey: string; country: string };

export type CountryTimeline = {
  points: Point[];
  /** Vai vispār ir kāda valsts. */
  hasData: boolean;
};

function dateToMs(date: string): number | null {
  const m = date.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!m) return null;
  const d = Number.parseInt(m[1]!, 10);
  const mo = Number.parseInt(m[2]!, 10);
  const y = Number.parseInt(m[3]!, 10);
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 1900 || y > 2100) return null;
  return Date.UTC(y, mo - 1, d);
}

function monthKeyOf(date: string): string {
  const m = date.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!m) return "";
  return `${m[3]}-${m[2]!.padStart(2, "0")}`;
}

export function buildCountryTimeline(entries: CountryTimelineEntry[]): CountryTimeline {
  const points: Point[] = [];
  for (const e of entries) {
    const country = normalizeCountryNameLv(e.country.trim()) || e.country.trim();
    if (!country || /nezināma/i.test(country)) continue;
    const ms = dateToMs(e.date);
    const monthKey = monthKeyOf(e.date);
    if (ms == null || !monthKey) continue;
    points.push({ ms, monthKey, country });
  }
  points.sort((a, b) => a.ms - b.ms);
  return { points, hasData: points.length > 0 };
}

/**
 * Valsts konkrētam datumam:
 * 1) tā paša mēneša ieraksti, ja tie visi norāda vienu valsti;
 * 2) tuvākais ieraksts pirms un pēc — ja abi sakrīt;
 * 3) pēdējais zināmais ieraksts, ja datums ir pēc visas vēstures.
 * Pirms pirmā zināmā ieraksta valsti neizdomājam (ražošana/reģistrācija var būt citur) — tukšs.
 */
export function resolveCountryForDate(timeline: CountryTimeline, date: string): string {
  if (!timeline.hasData) return "";
  const ms = dateToMs(date);
  const monthKey = monthKeyOf(date);
  if (ms == null || !monthKey) return "";

  const sameMonth = timeline.points.filter((p) => p.monthKey === monthKey);
  if (sameMonth.length > 0) {
    const unique = [...new Set(sameMonth.map((p) => p.country))];
    return unique.length === 1 ? unique[0]! : "";
  }

  const before = [...timeline.points].filter((p) => p.ms < ms).pop();
  const after = timeline.points.find((p) => p.ms > ms);

  if (before && after) return before.country === after.country ? before.country : "";
  if (before) return before.country;
  return "";
}

/** Aizpilda tukšos valsts laukus rindām (datums + valsts). Aizpildītos nemaina. */
export function fillCountriesFromTimeline<T extends { date: string; country: string }>(
  rows: T[],
  timeline: CountryTimeline,
): T[] {
  if (!timeline.hasData) return rows;
  return rows.map((r) => {
    if (r.country.trim()) return r;
    const resolved = resolveCountryForDate(timeline, r.date);
    return resolved ? { ...r, country: resolved } : r;
  });
}
