/**
 * IRISS cenu lauki paliek string. Šeit formāta brīdinājums un skaitļa nolasīšana.
 */

/**
 * Cenas teksts uz skaitli.
 * Noņem valūtu un citas zīmes. Ja ir gan punkts, gan komats, pēdējais ir decimāldaļa.
 * Viens atdalītājs ar grupām pa 3 cipariem (15.000, 1.234) ir tūkstoši.
 */
export function parsePriceLike(input: string): number {
  const cleaned = input.replace(/[^\d.,]/g, "");
  if (!cleaned || !/\d/.test(cleaned)) return 0;

  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  const lastSep = Math.max(lastComma, lastDot);
  if (lastSep < 0) {
    const n = Number.parseInt(cleaned, 10);
    return Number.isFinite(n) ? n : 0;
  }

  const both = lastComma >= 0 && lastDot >= 0;
  const thousandGrouped = !both && /^\d{1,3}([.,]\d{3})+$/.test(cleaned);
  const intDigits = cleaned.slice(0, lastSep).replace(/[.,]/g, "");
  const fracDigits = cleaned.slice(lastSep + 1).replace(/[.,]/g, "");

  if (thousandGrouped) {
    const n = Number.parseInt(`${intDigits}${fracDigits}`, 10);
    return Number.isFinite(n) ? n : 0;
  }

  const n = Number.parseFloat(`${intDigits || "0"}.${fracDigits}`);
  return Number.isFinite(n) ? n : 0;
}

const PLAIN = /^\d+([.,]\d{1,2})?$/;
const EU_THOUSANDS = /^\d{1,3}([. ]\d{3})+(,\d{1,2})?$/;
const US_THOUSANDS = /^\d{1,3}([, ]\d{3})+(\.\d{1,2})?$/;

export function irissPriceLooksNumeric(raw: string): boolean {
  const t = raw.trim();
  if (!t) return true;
  const compact = t.replace(/\s/g, "");
  if (PLAIN.test(compact)) return true;
  if (EU_THOUSANDS.test(t) || US_THOUSANDS.test(t)) return true;
  return false;
}

/** Mīksts brīdinājums. Tukšs lauks nav kļūda. */
export function irissPriceFormatWarning(raw: string): string | null {
  if (!raw.trim()) return null;
  if (irissPriceLooksNumeric(raw)) return null;
  return "Cena izskatās pēc brīva teksta. PDF labāk ar skaitli, piem. 15000.";
}

/** Tūkstošu atstarpe vienmēr, arī 4 ciparu summām (`lv-LV` 5500 atstāj bez atstarpes). */
function groupThousandsLv(intDigits: string): string {
  return intDigits.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** Vesela summa eiro: "5 500 €", "-4 001 €", "-" ja nav skaitļa. */
export function formatIrissEurWhole(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "-";
  const r = Math.round(n);
  const sign = r < 0 ? "-" : "";
  return `${sign}${groupThousandsLv(String(Math.abs(r)))} €`;
}

/** Summa ar centiem: "5 500,00 €". */
export function formatIrissEurCents(n: number): string {
  if (!Number.isFinite(n)) return "-";
  const sign = n < 0 ? "-" : "";
  const [int, frac] = Math.abs(n).toFixed(2).split(".");
  return `${sign}${groupThousandsLv(int!)},${frac} €`;
}
