/**
 * PDF atskaitei — valsts nosaukuma → karoga emocijzīme (vienots Unicode reģionālā indikatora stils).
 * Nezināma valsts vai neatpazīts teksts → ES karogs (🇪🇺).
 */

import { CSDD_MILEAGE_COUNTRY_UNKNOWN_LABEL } from "@/lib/admin-source-blocks";

/** Eiropas Savienība — zils karogs (nezināmas valsts vietā). */
export const PDF_COUNTRY_FLAG_EU = "\u{1F1EA}\u{1F1FA}";

function normalizeCountryKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function iso2ToRegionalFlag(iso: string): string {
  const c = iso.toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return PDF_COUNTRY_FLAG_EU;
  const base = 0x1f1e6;
  const a = c.codePointAt(0)! - 65 + base;
  const b = c.codePointAt(1)! - 65 + base;
  if (a < 0x1f1e6 || a > 0x1f1ff || b < 0x1f1e6 || b > 0x1f1ff) return PDF_COUNTRY_FLAG_EU;
  return String.fromCodePoint(a, b);
}

/** Normalizēti nosaukumi / sinonīmi → ISO 3166-1 alpha-2. */
const NAME_TO_ISO2: Record<string, string> = {
  lv: "LV",
  latvija: "LV",
  latvia: "LV",
  lt: "LT",
  lietuva: "LT",
  lithuania: "LT",
  ee: "EE",
  igaunija: "EE",
  estonia: "EE",
  estija: "EE",
  pl: "PL",
  polija: "PL",
  poland: "PL",
  de: "DE",
  vacija: "DE",
  germany: "DE",
  deutschland: "DE",
  fr: "FR",
  francija: "FR",
  france: "FR",
  se: "SE",
  zviedrija: "SE",
  sweden: "SE",
  no: "NO",
  norvegija: "NO",
  norway: "NO",
  fi: "FI",
  somija: "FI",
  finland: "FI",
  dk: "DK",
  danija: "DK",
  denmark: "DK",
  es: "ES",
  spanija: "ES",
  spain: "ES",
  it: "IT",
  italija: "IT",
  italy: "IT",
  nl: "NL",
  niderlande: "NL",
  netherlands: "NL",
  holande: "NL",
  holland: "NL",
  be: "BE",
  belgija: "BE",
  belgium: "BE",
  at: "AT",
  austrija: "AT",
  austria: "AT",
  ch: "CH",
  sveice: "CH",
  switzerland: "CH",
  cz: "CZ",
  cehija: "CZ",
  czechia: "CZ",
  czech: "CZ",
  sk: "SK",
  slovakija: "SK",
  slovakia: "SK",
  hu: "HU",
  ungarija: "HU",
  hungary: "HU",
  ro: "RO",
  rumanija: "RO",
  romania: "RO",
  hr: "HR",
  horvatija: "HR",
  croatia: "HR",
  si: "SI",
  slovenija: "SI",
  slovenia: "SI",
  ie: "IE",
  irija: "IE",
  ireland: "IE",
  pt: "PT",
  portugale: "PT",
  portugal: "PT",
  gr: "GR",
  grikija: "GR",
  greece: "GR",
  lu: "LU",
  luxembourg: "LU",
  mt: "MT",
  malta: "MT",
  cy: "CY",
  bg: "BG",
  bulgarija: "BG",
  bulgaria: "BG",
  ru: "RU",
  krievija: "RU",
  russia: "RU",
  ua: "UA",
  ukrai: "UA",
  ukraine: "UA",
  by: "BY",
  baltkrievija: "BY",
  belarus: "BY",
  md: "MD",
  moldova: "MD",
  rs: "RS",
  serbia: "RS",
  serbija: "RS",
  ba: "BA",
  bosnia: "BA",
  me: "ME",
  montenegro: "ME",
  mk: "MK",
  macedonia: "MK",
  al: "AL",
  albania: "AL",
  tr: "TR",
  turcija: "TR",
  turkey: "TR",
  gb: "GB",
  uk: "GB",
  unitedkingdom: "GB",
  england: "GB",
  scotland: "GB",
  wales: "GB",
  us: "US",
  usa: "US",
  unitedstates: "US",
  america: "US",
  ca: "CA",
  kanada: "CA",
  canada: "CA",
  au: "AU",
  australija: "AU",
  australia: "AU",
  jp: "JP",
  japana: "JP",
  japan: "JP",
  cn: "CN",
  kina: "CN",
  china: "CN",
  is: "IS",
  islande: "IS",
  iceland: "IS",
  li: "LI",
  lihtensteina: "LI",
  ad: "AD",
  mc: "MC",
  monako: "MC",
  sm: "SM",
  va: "VA",
  xk: "XK",
  kosovo: "XK",
};

let unknownKeyCache: string | null = null;
function unknownLabelKey(): string {
  if (unknownKeyCache == null) unknownKeyCache = normalizeCountryKey(CSDD_MILEAGE_COUNTRY_UNKNOWN_LABEL);
  return unknownKeyCache;
}

function countryLabelToIso2(label: string): string | null {
  const t = label.trim();
  if (!t || t === "—" || t === "-") return null;
  if (/^[A-Za-z]{2}$/.test(t)) {
    const lower = t.toLowerCase();
    if (NAME_TO_ISO2[lower]) return NAME_TO_ISO2[lower].toUpperCase();
    return lower.toUpperCase();
  }
  const key = normalizeCountryKey(t);
  if (!key) return null;
  if (key === unknownLabelKey()) return null;
  if (key.length === 2 && /^[a-z]{2}$/.test(key) && NAME_TO_ISO2[key]) return NAME_TO_ISO2[key].toUpperCase();
  if (key.length === 2 && /^[a-z]{2}$/.test(key)) return key.toUpperCase();
  const mapped = NAME_TO_ISO2[key];
  if (mapped) return mapped;
  return null;
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
