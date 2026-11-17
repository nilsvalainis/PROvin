/** Formāti Autoparka v2 UI (latviski, tikai "-" domuzīme). */

export function fmtDateLv(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  if (m) return `${m[3]}.${m[2]}.${m[1]}`;
  return /^\d{2}\.\d{2}\.\d{4}$/.test(iso ?? "") ? (iso as string) : "";
}

/** "20.10" - īsais datums failiem un posmiem. */
export function fmtDayMonth(iso: string | null | undefined): string {
  const d = fmtDateLv(iso);
  return d ? d.slice(0, 5) : "";
}

function group(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export function fmtKm(n: number | null | undefined): string {
  return n == null || !Number.isFinite(n) ? "" : `${group(n)} km`;
}

export function fmtCm3(n: number | null | undefined): string {
  return n == null || !Number.isFinite(n) ? "" : `${Math.round(n)} cm³`;
}

export function fmtKw(n: number | null | undefined): string {
  return n == null || !Number.isFinite(n) ? "" : `${Math.round(n)} kW`;
}

/** "11 064,90 €". */
export function fmtEur(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "";
  const [int, dec] = Math.abs(n).toFixed(2).split(".");
  return `${n < 0 ? "-" : ""}${group(Number(int))},${dec} €`;
}

/** Cenu lapai: "18 900 €" (bez centiem, ja to nav). */
export function fmtEurRound(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "";
  return Number.isInteger(n) ? `${group(n)} €` : fmtEur(n);
}

/**
 * Skaitļa lauks (nobraukums, tilpums, jauda): "171 048", "171048 km", "1,9" -> skaitlis; "" -> null (apzināti notīrīts);
 * nenolasāms -> "invalid" (nesaglabā - agrāk `type="number"` deva "" un lauks tika iztīrīts, Nils 28.10).
 */
export function parseNumberFieldInput(raw: string): number | null | "invalid" {
  const t = raw.replace(/[\s\u00a0]/g, "").replace(/(km|kw|cm3|cm³|ccm)$/i, "").replace(",", ".");
  if (!t) return null;
  if (!/^\d+(\.\d+)?$/.test(t)) return "invalid";
  return Number(t);
}

/** Lietotāja ievade "1 234,50" / "1234.5" / "258,40 €" -> skaitlis. */
export function parseEurInput(raw: string): number | null {
  let t = raw.replace(/[\s\u00a0€]/g, "").replace(/eur$/i, "");
  // "17.900" / "1.234.567" - punkts kā tūkstošu atdalītājs (LV ieradums), ne decimāldaļa.
  if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");
  t = t.replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

export function lapasLv(n: number): string {
  return n === 1 ? "1 lapa" : `${n} lapas`;
}

export function rekiniLv(n: number): string {
  return n === 1 ? "1 rēķins" : `${n} rēķini`;
}
