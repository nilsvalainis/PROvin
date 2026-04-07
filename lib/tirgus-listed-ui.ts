/**
 * „Auto pārdošanā (dienas)” lauks — kritiskais slieksnis tirgus piedāvājuma brīdinājumam.
 */

/** Pirmā pilnā skaitliskā vērtība no teksta (piem. "22", "250", "250 dienas"). */
export function parseListedForSaleDays(raw: string): number | null {
  const m = raw.trim().match(/\d+/);
  if (!m) return null;
  const n = parseInt(m[0], 10);
  return Number.isFinite(n) ? n : null;
}

/** Slieksnis: virs šī skaita — sarkans brīdinājums (admin + PDF). */
export const LISTED_FOR_SALE_CRITICAL_DAYS = 200;

export function shouldShowListedForSaleCriticalBanner(raw: string): boolean {
  const n = parseListedForSaleDays(raw);
  return n !== null && n > LISTED_FOR_SALE_CRITICAL_DAYS;
}
