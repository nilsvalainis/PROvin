/**
 * Statute mile → kilometre. Owner 19.10.2026: PROVIN uses only km.
 * 1 mi = 1.609344 km. Swedish mil (10 km) is not this helper.
 */

export const MILES_TO_KM = 1.609344;

export function milesToKmRounded(miles: number): number {
  if (!Number.isFinite(miles) || miles <= 0) return 0;
  return Math.round(miles * MILES_TO_KM);
}

/** Latvian grouping: 128748 → "128 748". */
export function formatKmGrouped(km: number): string {
  const n = Math.round(km);
  if (!Number.isFinite(n)) return "";
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export function milesToKmGrouped(miles: number): string {
  return formatKmGrouped(milesToKmRounded(miles));
}
