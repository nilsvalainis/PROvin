/**
 * PDF atskaitei - valsts nosaukuma → karoga emocijzīme (vienots Unicode reģionālā indikatora stils).
 * Nezināma valsts vai neatpazīts teksts → nav karoga (neitrāla ikona), nekad ES karogs.
 */

import { countryLabelToIso2 } from "@/lib/country-names-lv";

/** @deprecated Neizmantot neatpazītai valstij - neatpazīts teksts rāda tukšu / neitrālu ikonu. */
export const PDF_COUNTRY_FLAG_EU = "\u{1F1EA}\u{1F1FA}";

/** Neitrāla vietas ikona, kad ISO nav atpazīts (nav ES karogs). */
export const PDF_COUNTRY_FLAG_NEUTRAL = "";

function iso2ToRegionalFlag(iso: string): string {
  const c = iso.toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return PDF_COUNTRY_FLAG_NEUTRAL;
  const base = 0x1f1e6;
  const a = c.codePointAt(0)! - 65 + base;
  const b = c.codePointAt(1)! - 65 + base;
  if (a < 0x1f1e6 || a > 0x1f1ff || b < 0x1f1e6 || b > 0x1f1ff) return PDF_COUNTRY_FLAG_NEUTRAL;
  return String.fromCodePoint(a, b);
}

/**
 * Atgriež vienu reģionālā indikatora karoga emocijzīmi vai tukšu, ja valsts nav atpazīta.
 */
export function pdfCountryFlagEmoji(countryLabel: string): string {
  const iso = countryLabelToIso2(countryLabel);
  if (!iso) return PDF_COUNTRY_FLAG_NEUTRAL;
  return iso2ToRegionalFlag(iso);
}

/**
 * ISO 3166-1 alpha-2 burti (lielie), lai rādītu blakus karogam PDF/UI.
 * Neatpazīta valsts → tukšs (nav `EU`).
 */
export function pdfCountryCodeLetters(countryLabel: string): string {
  const iso = countryLabelToIso2(countryLabel);
  if (!iso) return "";
  return iso;
}
