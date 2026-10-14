/**
 * IRISS LIST valstu filtrs: paturam tikai BE / NL / LU / DE.
 * Nezināma valsts paliek (kā nezināma jauda Volvo izslēgšanas noteikumos).
 * eCarsTrade meklēšanas vaicājumā valsts ir BEL / NET / LUX / GER.
 */

export const IRISS_LISTING_ALLOWED_COUNTRY_CODES = ["BE", "NL", "LU", "DE"] as const;
export type IrissListingAllowedCountry = (typeof IRISS_LISTING_ALLOWED_COUNTRY_CODES)[number];

/** eCarsTrade `country[]` vērtības, kas atbilst atļautajām ISO kodēm. */
export const ECARSTRADE_ALLOWED_COUNTRY_QUERY = ["BEL", "NET", "LUX", "GER"] as const;

const NAME_TO_ISO: Record<string, string> = {
  be: "BE",
  bel: "BE",
  belgium: "BE",
  belgie: "BE",
  belgië: "BE",
  belgique: "BE",
  beļģija: "BE",
  nl: "NL",
  net: "NL",
  nld: "NL",
  netherlands: "NL",
  "the netherlands": "NL",
  holland: "NL",
  nederland: "NL",
  nīderlande: "NL",
  lu: "LU",
  lux: "LU",
  luxemburg: "LU",
  luxembourg: "LU",
  luksemburga: "LU",
  de: "DE",
  ger: "DE",
  deu: "DE",
  germany: "DE",
  deutschland: "DE",
  vācija: "DE",
  vacija: "DE",
  fr: "FR",
  fra: "FR",
  france: "FR",
  frankreich: "FR",
  francija: "FR",
  es: "ES",
  esp: "ES",
  spain: "ES",
  espana: "ES",
  españa: "ES",
  spānija: "ES",
  spanija: "ES",
  it: "IT",
  ita: "IT",
  italy: "IT",
  italia: "IT",
  itālija: "IT",
};

export function normalizeListingCountryCode(raw: string | null | undefined): string {
  const t = String(raw ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
  if (!t) return "";
  return NAME_TO_ISO[t] || (/^[a-z]{2}$/.test(t) ? t.toUpperCase() : "");
}

/** Tukšs / nezināms kods: atstājam. Zināmām valstīm ārpus BE/NL/LU/DE: nē. */
export function listingCountryAllowed(
  countryCode: string | null | undefined,
  allowed: readonly string[] = IRISS_LISTING_ALLOWED_COUNTRY_CODES,
): boolean {
  const code = normalizeListingCountryCode(countryCode);
  if (!code) return true;
  return allowed.includes(code);
}

export function rejectListingsOutsideAllowedCountries<T extends { countryCode?: string | null }>(
  items: readonly T[],
  allowed: readonly string[] = IRISS_LISTING_ALLOWED_COUNTRY_CODES,
): T[] {
  return items.filter((item) => listingCountryAllowed(item.countryCode, allowed));
}
