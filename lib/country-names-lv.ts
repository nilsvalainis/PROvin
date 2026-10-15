/**
 * Valstu nosaukumi latviešu valodā. Atpazīst ISO2/ISO3 un LV/EN/LT/DE/FR/PL/RU
 * (un citu Intl valodu) nosaukumus; izeja ir PROVIN LV forma + ISO2 karogam.
 */

import { CSDD_MILEAGE_COUNTRY_UNKNOWN_LABEL } from "@/lib/admin-source-blocks";
import { ISO3_TO_ISO2, iso3ToIso2 } from "@/lib/iso3166-alpha3";

function normalizeCountryKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "");
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
    "connecticut", "konektikuta", "delaware", "delavera", "florida",
    /* „Georgia” ir arī valsts (GE / Gruzija); štats paliek caur (GA) / pilsēta, GA. */
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

function textLooksLikeUsTerritoryNotCountry(raw: string): boolean {
  return /virgin|samoa|outlying|minor|aizjuras|virdzin|микронез/i.test(raw);
}

function textHasUnitedStatesMarker(raw: string): boolean {
  if (textLooksLikeUsTerritoryNotCountry(raw)) return false;
  if (/\(asv\)/i.test(raw)) return true;
  if (/\b(asv|usa|united\s*states)\b/i.test(raw)) return true;
  const key = normalizeCountryKey(raw);
  return (
    key.includes("amerikassavienotasvalst") ||
    key.includes("jungtinesvalstij") ||
    key.includes("jungtinesamerikosvalst") ||
    key.includes("vereinigtestaat") ||
    key.includes("etatsunis") ||
    key.includes("stanyzjednoczone") ||
    key.includes("soedinennyeshtat") ||
    key.includes("соединенны") ||
    key === "сша"
  );
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
  liechtenstein: "LI",
};

/** Oficiali gari / citu valodu īsie nosaukumi, ko Intl dažkārt neatgriež. */
const EXTRA_ALIASES: Record<string, string> = {
  amerikassavienotasvalstis: "US",
  amerikassavienotasvalstisofamerica: "US",
  unitedstatesofamerica: "US",
  unitedstatesofamericathe: "US",
  jungtinesvalstijos: "US",
  jungtinesamerikosvalstijos: "US",
  vereinigtestaten: "US",
  vereinigtestaatenvonamerika: "US",
  etatsunis: "US",
  etatsunisdamerique: "US",
  stanyzjednoczone: "US",
  stanyzjednoczoneameryki: "US",
  soedinennyeshtaty: "US",
  soedinennyeshtatyameriki: "US",
  соединенныештаты: "US",
  соединенныештатыамерики: "US",
  сша: "US",
  usofa: "US",
  usofamerica: "US",
  канада: "CA",
  lielbritanija: "GB",
  lielbritanijaunziemenirija: "GB",
  unitedkingdomofgreatbritainandnorthernireland: "GB",
  jungtinekaralyste: "GB",
  vereinigteskonigreich: "GB",
  royaumeuni: "GB",
  wielkabrytania: "GB",
  великобритания: "GB",
  southkorea: "KR",
  korearepublicof: "KR",
  republicofkorea: "KR",
  dienvidkoreja: "KR",
  northkorea: "KP",
  koredpr: "KP",
  ziemelkoreja: "KP",
  ivorycoast: "CI",
  cotedivoire: "CI",
  kotdivuara: "CI",
  burma: "MM",
  mjanma: "MM",
  swaziland: "SZ",
  esvatini: "SZ",
  persia: "IR",
  iran: "IR",
  gruzija: "GE",
  sakartvelo: "GE",
  georgiathecountry: "GE",
  unitedstatesvirginislands: "VI",
  usvirginislands: "VI",
  virginislandsus: "VI",
  americansamoa: "AS",
  unitedstatesminoroutlyingislands: "UM",
  usoutlyingislands: "UM",
  vacijasfederativarepublika: "DE",
  vokietija: "DE",
  allemagne: "DE",
  niemcy: "DE",
  германия: "DE",
  nyderlandai: "NL",
  paysbas: "NL",
  holandia: "NL",
  нидерланды: "NL",
  cehijasrepublika: "CZ",
  tschechien: "CZ",
  tschechischerepublik: "CZ",
  tchequie: "CZ",
  czechy: "CZ",
  чехия: "CZ",
  lietuvosrespublika: "LT",
  litauen: "LT",
  lituanie: "LT",
  litwa: "LT",
  литва: "LT",
  igaunijasrepublika: "EE",
  eesti: "EE",
  estland: "EE",
  estonie: "EE",
  эстония: "EE",
  latvijasrepublika: "LV",
  lettland: "LV",
  lettonie: "LV",
  lotwa: "LV",
  латвия: "LV",
};

const DISPLAY_NAME_LOCALES = [
  "lv",
  "en",
  "lt",
  "de",
  "fr",
  "pl",
  "ru",
  "es",
  "it",
  "nl",
  "da",
  "sv",
  "fi",
  "cs",
  "sk",
  "hu",
  "ro",
  "bg",
  "uk",
  "et",
  "pt",
  "el",
  "tr",
  "nb",
  "hr",
  "sl",
] as const;

function discoverIso2Codes(): string[] {
  const out: string[] = [];
  let dn: Intl.DisplayNames;
  try {
    dn = new Intl.DisplayNames(["en"], { type: "region" });
  } catch {
    return Object.keys(ISO2_TO_LV_NAME);
  }
  for (let a = 65; a <= 90; a++) {
    for (let b = 65; b <= 90; b++) {
      const iso = String.fromCharCode(a, b);
      try {
        const name = dn.of(iso);
        if (name && name !== iso) out.push(iso);
      } catch {
        /* nav derīgs reģions */
      }
    }
  }
  return out;
}

let worldNameToIso2: Map<string, string> | null = null;
let worldDisplayNames: string[] | null = null;

function worldNameIndex(): Map<string, string> {
  if (worldNameToIso2) return worldNameToIso2;
  const map = new Map<string, string>();
  const labels = new Set<string>();

  const put = (raw: string, iso: string, asLabel = false) => {
    const key = normalizeCountryKey(raw);
    if (!key) return;
    if (!map.has(key)) map.set(key, iso);
    if (asLabel) labels.add(raw);
  };

  for (const [k, v] of Object.entries(NAME_TO_ISO2)) map.set(k, v);
  for (const [iso3, iso2] of Object.entries(ISO3_TO_ISO2)) map.set(iso3.toLowerCase(), iso2);

  for (const iso of discoverIso2Codes()) {
    map.set(iso.toLowerCase(), iso);
    const official = ISO2_TO_LV_NAME[iso];
    if (official) labels.add(official);
    for (const locale of DISPLAY_NAME_LOCALES) {
      try {
        const name = new Intl.DisplayNames([locale], { type: "region" }).of(iso);
        if (!name || name === iso) continue;
        put(name, iso, true);
      } catch {
        /* locale nav DisplayNames */
      }
    }
  }

  for (const [k, v] of Object.entries(EXTRA_ALIASES)) map.set(k, v);
  worldNameToIso2 = map;
  worldDisplayNames = [...labels];
  return map;
}

function worldLeadingLabels(): string[] {
  worldNameIndex();
  return worldDisplayNames ?? [];
}

export function iso2ToLvDisplayName(iso: string): string {
  const code = iso.toUpperCase();
  if (ISO2_TO_LV_NAME[code]) return ISO2_TO_LV_NAME[code]!;
  try {
    const lv = new Intl.DisplayNames(["lv"], { type: "region" }).of(code);
    if (lv && lv !== code) return lv;
  } catch {
    /* nav lv DisplayNames */
  }
  return code;
}

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
  const world = worldNameIndex().get(lower);
  if (world) return world;
  return null;
}

/** Atpazīst valsti no brīva teksta / ISO2 / ISO3 / LV/EN/LT/DE/FR/PL/RU nosaukuma. */
export function countryLabelToIso2(label: string): string | null {
  const t = label.trim();
  if (!t || t === "—" || t === "-") return null;
  const fromLocation = iso2FromUsCaLocation(t);
  if (fromLocation) return fromLocation;
  if (/^[A-Za-z]{2}$/.test(t)) return iso2FromKnownTwoLetter(t);
  if (/^[A-Za-z]{3}$/.test(t)) {
    const iso3 = iso3ToIso2(t);
    if (iso3) return iso3;
  }
  const key = normalizeCountryKey(t);
  if (!key || key === unknownLabelKey()) return null;
  if (NAME_TO_ISO2[key]) return NAME_TO_ISO2[key]!.toUpperCase();
  if (EXTRA_ALIASES[key]) return EXTRA_ALIASES[key]!;
  const world = worldNameIndex().get(key);
  if (world) return world;
  if (US_STATE_NAME_KEYS.has(key)) return "US";
  if (CA_PROVINCE_NAME_KEYS.has(key)) return "CA";
  if (textHasUnitedStatesMarker(t)) return "US";
  if (key.length === 2) return iso2FromKnownTwoLetter(key);
  if (key.length === 3) {
    const iso3 = iso3ToIso2(key);
    if (iso3) return iso3;
  }
  return null;
}

/** Pārtulko / normalizē valsts nosaukumu latviski; neatpazīts → sākotnējais teksts. */
export function normalizeCountryNameLv(raw: string): string {
  const t = raw.trim();
  if (!t || t === "—" || t === "-") return "";
  const iso = countryLabelToIso2(t);
  if (iso) return iso2ToLvDisplayName(iso);
  return t.replace(/\s+/g, " ");
}

export function isLatviaCountryName(raw: string): boolean {
  return countryLabelToIso2(raw) === "LV";
}

/**
 * Nosaukumi, ar kuriem atskaitēs sākas valsts kolonna (garākie vispirms).
 * Slinkā inicializācija: `admin-source-blocks` imports ir ciklisks.
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
    "Amerikas Savienotās Valstis",
    "Jungtinės Valstijos",
    "United States of America",
    "United States",
    "Apvienotā Karaliste",
    "Bosnija un Hercegovina",
    ...Object.values(ISO2_TO_LV_NAME),
    ...worldLeadingLabels(),
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
