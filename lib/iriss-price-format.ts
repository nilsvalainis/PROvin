/**
 * IRISS cenu lauki paliek string. Šeit tikai formāta brīdinājums PDF dēļ.
 */

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
