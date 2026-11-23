/**
 * Neiespējami datumi (nākotnē) avotu ierakstos - Nila lēmums 23.11.2026.
 *
 * Gadījums: OneAuto `oe_service_history` (BMW i4, 2022) atdeva `"date_of_service_event": "2028-05-23"`
 * un `"2028-04-24"` (ISO, mūsu parseris tos nolasa pareizi - kļūda ir jau avotā). Pēc nobraukuma tie
 * iederas 2023. gadā. Sekas bija viltus odometra kritums, nākotnes „pēdējais ieraksts” un nepareizs
 * atsauksmes / AUDITS vērtējums.
 *
 * Likums: ieraksts ar datumu vēlāk par šodiena + 1 d nav fakts. To NEKOMENTĒ un NEATZĪMĒ - to izmet
 * ielasē un lasot saglabātos datus (admin, PDF, AI fakti, odometra / atsauksmes / AUDITS aprēķini).
 * Atļauts tikai servera žurnāls (avots + skaits, bez VIN / personas datiem).
 */
import { parseDotOrIsoDateToMs } from "@/lib/clean-date-str";

/** Pielaide laika joslām (avots UTC, Rīga UTC+2/+3) - „šodiena + 1 diena”. */
export const FUTURE_DATE_GRACE_MS = 24 * 60 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Agrākais brīdis, ko ieraksts var aprakstīt (perioda sākums) - ms UTC vai 0, ja datums nav nolasāms. */
function earliestMsOfDate(raw: string): number {
  const t = (raw ?? "").trim().replace(/\.$/, "");
  if (!t) return 0;
  const full = parseDotOrIsoDateToMs(t);
  if (full > 0) return full;
  const monthYear = t.match(/^(\d{1,2})[./](\d{4})$/);
  if (monthYear) {
    const m = Number(monthYear[1]);
    const y = Number(monthYear[2]);
    if (m >= 1 && m <= 12 && y >= 1900 && y <= 2100) return Date.UTC(y, m - 1, 1);
    return 0;
  }
  const isoMonth = t.match(/^(\d{4})-(\d{1,2})$/);
  if (isoMonth) {
    const y = Number(isoMonth[1]);
    const m = Number(isoMonth[2]);
    if (m >= 1 && m <= 12 && y >= 1900 && y <= 2100) return Date.UTC(y, m - 1, 1);
    return 0;
  }
  const year = t.match(/^(\d{4})$/);
  if (year) {
    const y = Number(year[1]);
    if (y >= 1900 && y <= 2100) return Date.UTC(y, 0, 1);
  }
  return 0;
}

/**
 * true = datums ir nākotnē (vēlāk par šodiena + 1 d). Mēneša / gada precizitātei salīdzina perioda
 * sākumu (tekošais mēnesis / gads nav nākotne). Nenolasāms vai tukšs datums - false (to risina citur).
 */
export function isImpossibleFutureDate(raw: string, nowMs: number = Date.now()): boolean {
  const ms = earliestMsOfDate(raw);
  if (!ms) return false;
  // Dienas sākums (UTC) + pielaide: šodienas un rītdienas ieraksti paliek.
  const todayStart = Math.floor(nowMs / DAY_MS) * DAY_MS;
  return ms > todayStart + FUTURE_DATE_GRACE_MS;
}

/**
 * Izmet rindas ar nākotnes datumu. `source` - tikai diagnostikai servera žurnālā (piem. „oneauto”);
 * žurnālā nonāk avots un skaits, nekad VIN vai rindas saturs.
 */
export function dropFutureDatedRows<T extends { date: string }>(
  rows: readonly T[],
  opts?: { nowMs?: number; source?: string },
): T[] {
  const nowMs = opts?.nowMs ?? Date.now();
  let dropped = 0;
  const kept: T[] = [];
  for (const r of rows ?? []) {
    if (r && isImpossibleFutureDate(String(r.date ?? ""), nowMs)) {
      dropped += 1;
      continue;
    }
    kept.push(r);
  }
  if (dropped > 0 && opts?.source && typeof window === "undefined") {
    console.warn("[future-date-guard] izmesti ieraksti ar datumu nākotnē", { source: opts.source, count: dropped });
  }
  return kept;
}
