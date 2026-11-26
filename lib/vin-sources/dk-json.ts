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

/** Gads-mēnesis-diena -> `YYYY-MM-DD`, ja tāda kalendāra diena eksistē; citādi "". */
export function validIsoDay(y: number, m: number, d: number): string {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return "";
  if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return "";
  const t = new Date(Date.UTC(y, m - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return "";
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export type IsoDayOptions = {
  /**
   * Kā lasīt `a/b/yyyy`, ja abas daļas ≤ 12. tjekbil Bilbogen (`debtData.dato`) un `leasingPeriode` ir ASV
   * formātā `MM/DD/YYYY` (piem. „10/24/2022”), tāpēc tur jāpadod „mdy”. Noklusējums „dmy” (da-DK).
   */
  slashOrder?: "dmy" | "mdy";
};

/**
 * DMR / tjekbil datumi: ISO, da-DK `dd-mm-yyyy` / `dd.mm.yyyy` vai `a/b/yyyy` - kalendāra diena bez joslas nobīdes.
 * 26.11: mēnesis > 12 nekad netiek atgriezts kā ISO (bija „2022-24-10” no „10/24/2022”). Ja pirmā secība
 * nav derīga, mēģina otru (diena/mēnesis samainīti); ja neder neviena - "".
 */
export function isoDay(value: unknown, opts: IsoDayOptions = {}): string {
  const s = str(value).trim();
  if (!s) return "";
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})(?!\d)/.exec(s);
  if (iso) {
    const [y, a, b] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
    // „2022-24-10” (jau sabojāts saglabātajos datos) -> YYYY-DD-MM.
    return validIsoDay(y, a, b) || validIsoDay(y, b, a);
  }
  const dk = /^(\d{1,2})[-.](\d{1,2})[-.](\d{4})(?!\d)/.exec(s);
  if (dk) {
    const [a, b, y] = [Number(dk[1]), Number(dk[2]), Number(dk[3])];
    return validIsoDay(y, b, a) || validIsoDay(y, a, b);
  }
  const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?!\d)/.exec(s);
  if (slash) {
    const [a, b, y] = [Number(slash[1]), Number(slash[2]), Number(slash[3])];
    const dmy = validIsoDay(y, b, a);
    const mdy = validIsoDay(y, a, b);
    return opts.slashOrder === "mdy" ? mdy || dmy : dmy || mdy;
  }
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
