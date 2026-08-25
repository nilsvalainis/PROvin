/** Kopīgi JSON palīgi Dānijas reģistru atbildēm (tjekbil / nummerplade). */

export const DK_COUNTRY_LV = "Dānija";

export const str = (v: unknown): string => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");

export const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

export function asArray(v: unknown): unknown[] {
  if (Array.isArray(v)) return v;
  const rec = asRecord(v);
  for (const key of ["items", "data", "results", "alerts", "rapporter", "historik", "rows"]) {
    if (Array.isArray(rec[key])) return rec[key] as unknown[];
  }
  return [];
}

/** DMR / tjekbil datumi: ISO vai da-DK `dd-mm-yyyy` — kalendāra diena bez joslas nobīdes. */
export function isoDay(value: unknown): string {
  const s = str(value).trim();
  if (!s) return "";
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dk = /^(\d{2})[-.](\d{2})[-.](\d{4})$/.exec(s);
  if (dk) return `${dk[3]}-${dk[2]}-${dk[1]}`;
  const dkSlash = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (dkSlash) return `${dkSlash[3]}-${dkSlash[2]}-${dkSlash[1]}`;
  return "";
}

export function pickStr(rec: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const v = str(rec[key]).trim();
    if (v) return v;
  }
  return "";
}

export function pickNum(rec: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const n = num(rec[key]);
    if (n != null) return n;
    const parsed = Number(str(rec[key]).replace(/[^\d.-]/g, ""));
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}
