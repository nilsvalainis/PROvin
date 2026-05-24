/**
 * PDF atskaitei — valsts nosaukuma → karoga emocijzīme (vienots Unicode reģionālā indikatora stils).
 * Nezināma valsts vai neatpazīts teksts → ES karogs (🇪🇺).
 */

import { countryLabelToIso2 } from "@/lib/country-names-lv";

/** Eiropas Savienība — zils karogs (nezināmas valsts vietā). */
export const PDF_COUNTRY_FLAG_EU = "\u{1F1EA}\u{1F1FA}";

function iso2ToRegionalFlag(iso: string): string {
  const c = iso.toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return PDF_COUNTRY_FLAG_EU;
  const base = 0x1f1e6;
  const a = c.codePointAt(0)! - 65 + base;
  const b = c.codePointAt(1)! - 65 + base;
  if (a < 0x1f1e6 || a > 0x1f1ff || b < 0x1f1e6 || b > 0x1f1ff) return PDF_COUNTRY_FLAG_EU;
  return String.fromCodePoint(a, b);
}

/**
 * Atgriež vienu reģionālā indikatora karoga emocijzīmi vai ES karogu, ja valsts nav atpazīta.
 */
export function pdfCountryFlagEmoji(countryLabel: string): string {
  const iso = countryLabelToIso2(countryLabel);
  if (!iso) return PDF_COUNTRY_FLAG_EU;
  return iso2ToRegionalFlag(iso);
}

/**
 * ISO 3166-1 alpha-2 burti (lielie), lai rādītu blakus karogam PDF/UI.
 * Neatpazīta valsts → `EU` (saskan ar ES karoga emocijzīmi).
 */
export function pdfCountryCodeLetters(countryLabel: string): string {
  const iso = countryLabelToIso2(countryLabel);
  if (!iso) return "EU";
  return iso;
}
