/**
 * Šveices / AutoDNA importi bieži lieto dienu `00` (mēnesis bez dienas, piem. `00.01.2026`).
 * Pirms `Date` / sortēšanas normalizē uz `01.`, lai nebūtu Invalid Date vai NaN.
 */

/** Ja datums sākas ar `00.`, aizstāj dienu ar `01.` */
export function cleanDateStr(dateStr: string): string {
  if (typeof dateStr !== "string") return "";
  const t = dateStr.trim();
  if (t.startsWith("00.")) {
    return `01.${t.substring(3)}`;
  }
  return t;
}

export function cleanDateInput(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return cleanDateStr(raw.trim());
}

/** DD.MM.YYYY, YYYY-MM-DD vai ISO → ms (UTC). 0, ja nederīgs. Nekad nemest. */
export function parseDotOrIsoDateToMs(raw: unknown): number {
  const t = cleanDateInput(raw);
  if (!t) return 0;
  try {
    const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) {
      const y = Number(iso[1]);
      const m = Number(iso[2]);
      const d = Number(iso[3]);
      if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return 0;
      if (d < 1 || d > 31 || m < 1 || m > 12 || y < 1900 || y > 2100) return 0;
      const ms = Date.UTC(y, m - 1, d);
      return Number.isFinite(ms) ? ms : 0;
    }
    const lv = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (lv) {
      const d = Number(lv[1]);
      const m = Number(lv[2]);
      const y = Number(lv[3]);
      if (!Number.isFinite(d) || !Number.isFinite(m) || !Number.isFinite(y)) return 0;
      if (d < 1 || d > 31 || m < 1 || m > 12 || y < 1900 || y > 2100) return 0;
      const ms = Date.UTC(y, m - 1, d);
      return Number.isFinite(ms) ? ms : 0;
    }
    const parsed = Date.parse(t);
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
}

/** Kā `parseDotOrIsoDateToMs`, bet nederīgam — `-Infinity` (nobraukuma kārtošanai). */
export function parseMileageSortTime(raw: unknown): number {
  const ms = parseDotOrIsoDateToMs(raw);
  return ms > 0 ? ms : Number.NEGATIVE_INFINITY;
}
