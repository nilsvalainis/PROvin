/**
 * OFICIĀLĀ DĪLERA DATI lauki no AutoDNA / CarVertical - tikai angļu valodā.
 * Ja tulkojums neizdodas, saīsina līdz kodam vai atstāj tukšu.
 */
import { countryLabelToIso2 } from "@/lib/country-names-lv";
import {
  emptyOutvinVehicleInfo,
  OUTVIN_VEHICLE_INFO_ROWS,
  type OutvinVehicleInfo,
} from "@/lib/outvin-dealer-types";

const LV_OR_CYRILLIC_RE = /[ĀāČčĒēĢģĪīĶķĻļŅņŠšŪūŽž]|[\u0400-\u04FF]/;

const PHRASE_REPLACEMENTS: [RegExp, string][] = [
  [/automašīna ar stūri kreisajā pusē/gi, "left-hand drive"],
  [/automašīna ar stūri labajā pusē/gi, "right-hand drive"],
  [/stūre kreisajā pusē/gi, "left-hand drive"],
  [/stūre labajā pusē/gi, "right-hand drive"],
  [/automātiskā ātrumkārba/gi, "automatic transmission"],
  [/automātiskās? transmisijas?/gi, "automatic transmission"],
  [/mehāniskā ātrumkārba/gi, "manual transmission"],
  [/mehāniskā/gi, "manual"],
  [/automātiskā/gi, "automatic"],
  [/\bpriekšējā piedziņa\b/gi, "front-wheel drive"],
  [/\baizmugurējā piedziņa\b/gi, "rear-wheel drive"],
  [/\bpilnpiedziņa\b/gi, "all-wheel drive"],
  [/\bbenzīns\b/gi, "petrol"],
  [/\bdīzelis\b/gi, "diesel"],
  [/\bhibrīds\b/gi, "hybrid"],
  [/\belektro\b/gi, "electric"],
  [/\bmetālisk[āa]s?\b/gi, "metallic"],
  [/\bgaiši\s+/gi, "light "],
  [/\btumši\s+/gi, "dark "],
  [/\bmelns\b/gi, "black"],
  [/\bbalts\b/gi, "white"],
  [/\bpelēks\b/gi, "grey"],
  [/\bsudrabs\b/gi, "silver"],
  [/\bzils\b/gi, "blue"],
  [/\bsarkans\b/gi, "red"],
  [/\bzaļš\b/gi, "green"],
  [/\bbrūns\b/gi, "brown"],
  [/\bbežs\b/gi, "beige"],
  [/\boranžs\b/gi, "orange"],
  [/\bdzeltens\b/gi, "yellow"],
  [/\bviolets\b/gi, "purple"],
  [/\(\s*(\d[\d.,]*)\s*ZS\s*\)/gi, " ($1 hp)"],
  [/(\d[\d.,]*)\s*ZS\b/gi, "$1 hp"],
  [/\bAutomatikgetriebe\b/gi, "automatic transmission"],
  [/\bSchaltgetriebe\b/gi, "manual transmission"],
  [/\bAllradantrieb\b/gi, "all-wheel drive"],
  [/\bLinkslenker\b/gi, "left-hand drive"],
  [/\bRechtslenker\b/gi, "right-hand drive"],
];

const ISO2_TO_EN: Record<string, string> = {
  LV: "Latvia",
  LT: "Lithuania",
  EE: "Estonia",
  DE: "Germany",
  BE: "Belgium",
  FR: "France",
  DK: "Denmark",
  NL: "Netherlands",
  ES: "Spain",
  IT: "Italy",
  FI: "Finland",
  SE: "Sweden",
  PL: "Poland",
  AT: "Austria",
  US: "USA",
  GB: "United Kingdom",
  CH: "Switzerland",
  CZ: "Czechia",
  SK: "Slovakia",
  HU: "Hungary",
  RO: "Romania",
  HR: "Croatia",
  SI: "Slovenia",
  IE: "Ireland",
  PT: "Portugal",
  GR: "Greece",
  NO: "Norway",
  RU: "Russia",
  UA: "Ukraine",
  BY: "Belarus",
  LU: "Luxembourg",
};

const DATE_RE = /^(?:\d{1,2}\.\d{1,2}\.\d{4}|\d{4}(?:-\d{2}(?:-\d{2})?)?)$/;
const VIN_RE = /^[A-HJ-NPR-Z0-9]{11,17}$/i;
const FACTORY_CODE_RE = /^(?:[A-Z]{2,8}|[A-Z0-9][A-Z0-9./-]{1,14})$/;

function looksLikeSpecToken(t: string): boolean {
  if (DATE_RE.test(t)) return true;
  if (VIN_RE.test(t) && /\d/.test(t)) return true;
  if (FACTORY_CODE_RE.test(t) && (/\d/.test(t) || t === t.toUpperCase())) return true;
  return false;
}

function collapseSpaces(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function hasNonEnglishScript(s: string): boolean {
  return LV_OR_CYRILLIC_RE.test(s);
}

function applyPhrases(raw: string): string {
  let t = raw;
  for (const [re, en] of PHRASE_REPLACEMENTS) t = t.replace(re, en);
  return collapseSpaces(t);
}

function shortenUntranslated(raw: string): string {
  const codeInParens = raw.match(/\(([A-Z0-9][A-Z0-9./-]{1,12})\)/i)?.[1];
  if (codeInParens) return codeInParens;
  const lead = raw.match(/^([A-Z][A-Z0-9-]{1,14})\b/)?.[1];
  if (lead && !hasNonEnglishScript(lead)) return lead;
  return "";
}

export function dealerCountryToEnglish(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  const iso = countryLabelToIso2(t);
  if (iso && ISO2_TO_EN[iso]) return ISO2_TO_EN[iso];
  if (!hasNonEnglishScript(t)) return t;
  return "";
}

/** AutoDNA/CarVertical vērtība → angļu. Tukšs, ja nevar iztulkot. */
export function toDealerVehicleInfoEnglish(key: keyof OutvinVehicleInfo, raw: string): string {
  const t = collapseSpaces(raw);
  if (!t || /^(-+|—|–|n\/?a)$/i.test(t)) return "";
  if (key === "countryRegion") return dealerCountryToEnglish(t);
  if (looksLikeSpecToken(t) && !hasNonEnglishScript(t)) return t;
  if (/^auto$/i.test(t) && (key === "transmission" || key === "drive")) return "automatic";

  const translated = applyPhrases(t);
  if (!translated) return "";
  if (!hasNonEnglishScript(translated)) return translated;
  return shortenUntranslated(translated);
}

export function sanitizeDealerVehicleInfo(
  input: Partial<OutvinVehicleInfo>,
): Partial<OutvinVehicleInfo> {
  const out: Partial<OutvinVehicleInfo> = {};
  for (const { key } of OUTVIN_VEHICLE_INFO_ROWS) {
    const value = toDealerVehicleInfoEnglish(key, input[key] ?? "");
    if (value) out[key] = value;
  }
  return out;
}

export function overlayNonemptyVehicleInfo(
  base: OutvinVehicleInfo,
  incoming: Partial<OutvinVehicleInfo>,
): OutvinVehicleInfo {
  const out: OutvinVehicleInfo = { ...emptyOutvinVehicleInfo(), ...base };
  for (const { key } of OUTVIN_VEHICLE_INFO_ROWS) {
    const value = (incoming[key] ?? "").trim();
    if (!value || /^(-+|—|–|n\/?a)$/i.test(value)) continue;
    out[key] = value.slice(0, 500);
  }
  return out;
}
