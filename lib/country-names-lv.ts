/**
 * Valstu nosaukumi latviešu valodā — normalizācija no angļu / ISO / CSDD raw teksta.
 */

import { CSDD_MILEAGE_COUNTRY_UNKNOWN_LABEL } from "@/lib/admin-source-blocks";

function normalizeCountryKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/** ISO 3166-1 alpha-2 → latviski (oficiālais / PROVIN admin saraksts). */
export const ISO2_TO_LV_NAME: Record<string, string> = {
  LV: "Latvija",
  LT: "Lietuva",
  EE: "Igaunija",
  DE: "Vācija",
  BE: "Beļģija",
  FR: "Francija",
  DK: "Dānija",
  NL: "Nīderlande",
  ES: "Spānija",
  IT: "Itālija",
  FI: "Somija",
  SE: "Zviedrija",
  PL: "Polija",
  AT: "Austrija",
  US: "ASV",
  GB: "Apvienotā Karaliste",
  CH: "Šveice",
  CZ: "Čehija",
  SK: "Slovākija",
  HU: "Ungārija",
  RO: "Rumānija",
  HR: "Horvātija",
  SI: "Slovēnija",
  IE: "Īrija",
  PT: "Portugāle",
  GR: "Grieķija",
  NO: "Norvēģija",
  RU: "Krievija",
  UA: "Ukraina",
  BY: "Baltkrievija",
  LU: "Luksemburga",
  IS: "Islande",
  CA: "Kanāda",
  AU: "Austrālija",
  JP: "Japāna",
  CN: "Ķīna",
  TR: "Turcija",
  BG: "Bulgārija",
  RS: "Serbija",
  BA: "Bosnija un Hercegovina",
  ME: "Melnkalne",
  MK: "Ziemeļmaķedonija",
  AL: "Albānija",
  MD: "Moldova",
  AD: "Andora",
  MC: "Monako",
  LI: "Lihtenšteina",
};

/** Normalizēti sinonīmi → ISO2 (paplašināts no PDF karogu kartes). */
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
  schweiz: "CH",
  cz: "CZ",
  cehija: "CZ",
  czechia: "CZ",
  czech: "CZ",
  czechrepublic: "CZ",
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
  luksemburga: "LU",
  ru: "RU",
  krievija: "RU",
  russia: "RU",
  ua: "UA",
  ukrai: "UA",
  ukraine: "UA",
  ukrajina: "UA",
  by: "BY",
  baltkrievija: "BY",
  belarus: "BY",
  us: "US",
  usa: "US",
  unitedstates: "US",
  america: "US",
  asv: "US",
  gb: "GB",
  uk: "GB",
  unitedkingdom: "GB",
  england: "GB",
  scotland: "GB",
  wales: "GB",
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
  tr: "TR",
  turcija: "TR",
  turkey: "TR",
  turkiye: "TR",
  bg: "BG",
  bulgarija: "BG",
  bulgaria: "BG",
  rs: "RS",
  serbia: "RS",
  serbija: "RS",
  ba: "BA",
  bosnia: "BA",
  me: "ME",
  montenegro: "ME",
  melnkalne: "ME",
  mk: "MK",
  macedonia: "MK",
  al: "AL",
  albania: "AL",
  albanija: "AL",
  md: "MD",
  moldova: "MD",
  ad: "AD",
  andora: "AD",
  mc: "MC",
  monako: "MC",
  li: "LI",
  lihtensteina: "LI",
};

let unknownKeyCache: string | null = null;
function unknownLabelKey(): string {
  if (unknownKeyCache == null) {
    unknownKeyCache = normalizeCountryKey(CSDD_MILEAGE_COUNTRY_UNKNOWN_LABEL);
  }
  return unknownKeyCache;
}

/** Atpazīst valsti no brīva teksta / ISO2 / angļu nosaukuma. */
export function countryLabelToIso2(label: string): string | null {
  const t = label.trim();
  if (!t || t === "—" || t === "-") return null;
  if (/^[A-Za-z]{2}$/.test(t)) {
    const lower = t.toLowerCase();
    if (NAME_TO_ISO2[lower]) return NAME_TO_ISO2[lower].toUpperCase();
    return lower.toUpperCase();
  }
  const key = normalizeCountryKey(t);
  if (!key || key === unknownLabelKey()) return null;
  if (key.length === 2 && /^[a-z]{2}$/.test(key) && NAME_TO_ISO2[key]) return NAME_TO_ISO2[key].toUpperCase();
  if (key.length === 2 && /^[a-z]{2}$/.test(key)) return key.toUpperCase();
  return NAME_TO_ISO2[key]?.toUpperCase() ?? null;
}

/** Pārtulko / normalizē valsts nosaukumu latviski; nezināms → tukšs. */
export function normalizeCountryNameLv(raw: string): string {
  const t = raw.trim();
  if (!t || t === "—" || t === "-") return "";
  const iso = countryLabelToIso2(t);
  if (iso && ISO2_TO_LV_NAME[iso]) return ISO2_TO_LV_NAME[iso];
  const key = normalizeCountryKey(t);
  if (ISO2_TO_LV_NAME[t.toUpperCase()]) return ISO2_TO_LV_NAME[t.toUpperCase()];
  if (key && NAME_TO_ISO2[key] && ISO2_TO_LV_NAME[NAME_TO_ISO2[key]]) {
    return ISO2_TO_LV_NAME[NAME_TO_ISO2[key]];
  }
  return t.replace(/\s+/g, " ");
}

export function isLatviaCountryName(raw: string): boolean {
  return countryLabelToIso2(raw) === "LV";
}
