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

/**
 * ASV štatu kodi (ne ISO valsts). Lokācijas kontekstā LA ir Luiziāna, ne Laosa.
 * Kodi, kas sakrīt ar īstu valsti NAME_TO_ISO2 (CA, DE, AL, …), paliek valsts,
 * ja teksts ir tikai 2 burti; ar pilsētu / ZIP / nosaukumu → ASV.
 */
const US_STATE_CODES = new Set([
  "al", "ak", "az", "ar", "ca", "co", "ct", "de", "fl", "ga", "hi", "id", "il", "in", "ia",
  "ks", "ky", "la", "me", "md", "ma", "mi", "mn", "ms", "mo", "mt", "ne", "nv", "nh", "nj",
  "nm", "ny", "nc", "nd", "oh", "ok", "or", "pa", "ri", "sc", "sd", "tn", "tx", "ut", "vt",
  "va", "wa", "wv", "wi", "wy", "dc",
]);

/** Kanādas provinciju / teritoriju kodi. */
const CA_PROVINCE_CODES = new Set([
  "ab", "bc", "mb", "nb", "nl", "ns", "nt", "nu", "on", "pe", "qc", "sk", "yt",
]);

/** EN + LV štatu / provinciju nosaukumi (bez diakritikas pēc normalizeCountryKey). */
const US_STATE_NAME_KEYS = new Set(
  [
    "alabama", "alaska", "arizona", "arkansas", "california", "kalifornija", "colorado", "kolorado",
    "connecticut", "konektikuta", "delaware", "delavera", "florida", "georgia", "dzordzija",
    "hawaii", "havajas", "idaho", "aidaho", "illinois", "ilinoisa", "indiana", "indiana",
    "iowa", "aiova", "kansas", "kanzasa", "kentucky", "kentuki", "louisiana", "luiziana",
    "maine", "meina", "maryland", "merilenda", "massachusetts", "masacusetas", "masacusetsa",
    "michigan", "micigana", "minnesota", "minesota", "mississippi", "misisipi", "missouri",
    "misuri", "montana", "nebraska", "nevada", "newhampshire", "nuhempisira", "newjersey",
    "nudzersija", "newmexico", "numeksika", "newyork", "nujorka", "northcarolina",
    "ziemelkarolina", "northdakota", "ziemeldakota", "ohio", "ohaio", "oklahoma", "oregon",
    "oregona", "pennsylvania", "pensilvanija", "rhodeisland", "rodailenda", "southcarolina",
    "dienvidkarolina", "southdakota", "dienviddakota", "tennessee", "tenesi", "texas",
    "teksasa", "utah", "juta", "vermont", "vermonta", "virginia", "virdzinija", "washington",
    "washingtonstate", "vasingtona", "westvirginia", "rietumvirdzinija", "wisconsin",
    "viskonsina", "wyoming", "vaiominga", "districtofcolumbia", "washingtondc",
  ].map((s) => s),
);

const CA_PROVINCE_NAME_KEYS = new Set(
  [
    "alberta", "britishcolumbia", "britukolumbija", "manitoba", "newbrunswick", "nubransvika",
    "newfoundland", "newfoundlandandlabrador", "nufundlenda", "novascotia", "jaunskotija",
    "ontario", "princeedwardisland", "princaedvardasala", "quebec", "kvebeka", "saskatchewan",
    "saskacevana", "northwestterritories", "ziemelrietumuterritorijas", "yukon", "jukona",
    "nunavut", "nunavuta",
  ].map((s) => s),
);

/** Štatu kodi, kas nav NAME_TO_ISO2 valsts - lokācijā un atsevišķi → ASV (LA ≠ Laosa). */
function usStateCodeIsNotNamedCountry(code: string): boolean {
  return US_STATE_CODES.has(code) && NAME_TO_ISO2[code] == null;
}

function caProvinceCodeIsNotNamedCountry(code: string): boolean {
  return CA_PROVINCE_CODES.has(code) && NAME_TO_ISO2[code] == null;
}

/** „Luiziāna (LA)”, „Baton Rouge, LA”, „LA 70817”, „Toronto, ON”. */
function iso2FromUsCaLocation(raw: string): string | null {
  const t = raw.replace(/\s+/g, " ").trim();
  if (!t) return null;

  const paren = t.match(/^(.+?)\s*\(([A-Za-z]{2})\)\s*$/);
  if (paren) {
    const nameKey = normalizeCountryKey(paren[1]!);
    const code = paren[2]!.toLowerCase();
    if (US_STATE_NAME_KEYS.has(nameKey) || US_STATE_CODES.has(code)) return "US";
    if (CA_PROVINCE_NAME_KEYS.has(nameKey) || CA_PROVINCE_CODES.has(code)) return "CA";
  }

  const commaCode = t.match(/,\s*([A-Za-z]{2})(?:\s+\d{5}(?:-\d{4})?)?$/);
  if (commaCode) {
    const code = commaCode[1]!.toLowerCase();
    if (US_STATE_CODES.has(code)) return "US";
    if (CA_PROVINCE_CODES.has(code)) return "CA";
  }

  const stZip = t.match(/^([A-Za-z]{2})\s+\d{5}(?:-\d{4})?$/);
  if (stZip && US_STATE_CODES.has(stZip[1]!.toLowerCase())) return "US";

  const caPost = t.match(/^([A-Za-z]{2})\s+[A-Za-z]\d[A-Za-z]/);
  if (caPost && CA_PROVINCE_CODES.has(caPost[1]!.toLowerCase())) return "CA";

  for (const part of t.split(/[,;/|]/)) {
    const key = normalizeCountryKey(part);
    if (US_STATE_NAME_KEYS.has(key)) return "US";
    if (CA_PROVINCE_NAME_KEYS.has(key)) return "CA";
  }

  const whole = normalizeCountryKey(t);
  if (US_STATE_NAME_KEYS.has(whole)) return "US";
  if (CA_PROVINCE_NAME_KEYS.has(whole)) return "CA";
  return null;
}

function textHasUnitedStatesMarker(raw: string): boolean {
  return /\b(asv|usa|united\s*states)\b/i.test(raw) || /\(asv\)/i.test(raw);
}

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
  cehijasrepublika: "CZ",
  ceskarepublika: "CZ",
  ceska: "CZ",
  sk: "SK",
  slovakija: "SK",
  slovakia: "SK",
  slovakijasrepublika: "SK",
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

function iso2FromKnownTwoLetter(code: string): string | null {
  const lower = code.toLowerCase();
  if (!/^[a-z]{2}$/.test(lower)) return null;
  // Lokācijas 2 burti, kas nav NAME_TO_ISO2 valsts: LA → ASV, ne Laosa.
  if (usStateCodeIsNotNamedCountry(lower)) return "US";
  if (caProvinceCodeIsNotNamedCountry(lower)) return "CA";
  if (NAME_TO_ISO2[lower]) return NAME_TO_ISO2[lower]!.toUpperCase();
  if (ISO2_TO_LV_NAME[lower.toUpperCase()]) return lower.toUpperCase();
  return null;
}

/** Atpazīst valsti no brīva teksta / ISO2 / angļu nosaukuma / ASV štata / Kanādas provinces. */
export function countryLabelToIso2(label: string): string | null {
  const t = label.trim();
  if (!t || t === "—" || t === "-") return null;
  const fromLocation = iso2FromUsCaLocation(t);
  if (fromLocation) return fromLocation;
  if (textHasUnitedStatesMarker(t)) return "US";
  if (/^[A-Za-z]{2}$/.test(t)) return iso2FromKnownTwoLetter(t);
  const key = normalizeCountryKey(t);
  if (!key || key === unknownLabelKey()) return null;
  if (US_STATE_NAME_KEYS.has(key)) return "US";
  if (CA_PROVINCE_NAME_KEYS.has(key)) return "CA";
  if (NAME_TO_ISO2[key]) return NAME_TO_ISO2[key]!.toUpperCase();
  if (key.length === 2) return iso2FromKnownTwoLetter(key);
  return null;
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

/**
 * Nosaukumi, ar kuriem atskaitēs sākas valsts kolonna (garākie vispirms).
 * Slinkā inicializācija — `admin-source-blocks` imports ir ciklisks.
 */
let leadingCountryLabelsCache: string[] | null = null;

function leadingCountryLabels(): string[] {
  if (leadingCountryLabelsCache) return leadingCountryLabelsCache;
  leadingCountryLabelsCache = [
    CSDD_MILEAGE_COUNTRY_UNKNOWN_LABEL,
    "Nezināma valsts",
    "Čehijas Republika",
    "Čehijas republika",
    "Slovākijas Republika",
    "Vācijas Federatīvā Republika",
    "Apvienotā Karaliste",
    "Bosnija un Hercegovina",
    ...Object.values(ISO2_TO_LV_NAME),
  ]
    .filter((label): label is string => Boolean(label))
    .sort((a, b) => b.length - a.length);
  return leadingCountryLabelsCache;
}

/**
 * Atdala valsts nosaukumu teksta sākumā („Čehijas RepublikaVeikta apskate”).
 * `country` ir normalizēts latviskais nosaukums; „Nezināma valsts” → tukšs.
 */
export function matchLeadingCountryNameLv(
  raw: string,
): { country: string; matched: string; rest: string } | null {
  const t = raw.replace(/^[\s.:·-]+/, "");
  if (!t) return null;
  const lower = t.toLowerCase();
  for (const label of leadingCountryLabels()) {
    if (!lower.startsWith(label.toLowerCase())) continue;
    const rest = t.slice(label.length).trim();
    const isUnknown = /nezināma/i.test(label);
    return {
      country: isUnknown ? "" : normalizeCountryNameLv(label),
      matched: label,
      rest,
    };
  }
  return null;
}
