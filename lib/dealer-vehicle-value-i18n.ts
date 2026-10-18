/**
 * Dīlera transportlīdzekļa vispārīgās vērtības (kārba, virsbūve, piedziņa, degviela,
 * krāsa, salons) → atskaites valoda. Modeļa nosaukumus, VIN un rūpnīcas kodus neatskār.
 */
import type { ClientReportLang } from "@/lib/client-report-i18n";
import { normalizeCountryName } from "@/lib/country-names-lv";
import type { OutvinVehicleInfo } from "@/lib/outvin-dealer-types";

type LangMap = Record<ClientReportLang, string>;

const EXACT: { keys: string[]; out: LangMap }[] = [
  {
    keys: ["automatic", "automatik", "automatiskā", "automātiskā", "автоматическая"],
    out: { lv: "automātiskā", en: "automatic", ru: "автоматическая", de: "Automatik" },
  },
  {
    keys: ["automatic transmission", "automatikgetriebe", "automātiskā ātrumkārba", "автоматическая коробка"],
    out: {
      lv: "automātiskā ātrumkārba",
      en: "automatic transmission",
      ru: "автоматическая коробка передач",
      de: "Automatikgetriebe",
    },
  },
  {
    keys: ["manual", "schaltgetriebe", "mehāniskā", "механическая"],
    out: { lv: "mehāniskā", en: "manual", ru: "механическая", de: "Schaltgetriebe" },
  },
  {
    keys: ["manual transmission", "mehāniskā ātrumkārba", "механическая коробка"],
    out: {
      lv: "mehāniskā ātrumkārba",
      en: "manual transmission",
      ru: "механическая коробка передач",
      de: "Schaltgetriebe",
    },
  },
  {
    keys: [
      "7-speed automatic dual-clutch transmission",
      "7 speed automatic dual clutch transmission",
      "7-pakāpju automātiskā divsajūgu",
    ],
    out: {
      lv: "7 pakāpju automātiskā divsajūgu ātrumkārba",
      en: "7-speed automatic dual-clutch transmission",
      ru: "7-ступенчатая автоматическая коробка с двумя сцеплениями",
      de: "7-Gang-Doppelkupplungsgetriebe",
    },
  },
  {
    keys: ["dual-clutch", "dual clutch", "dct", "dsg", "doppelkupplung", "divsajūgu"],
    out: { lv: "divsajūgu", en: "dual-clutch", ru: "с двумя сцеплениями", de: "Doppelkupplung" },
  },
  {
    keys: ["front-wheel drive", "front wheel drive", "fwd", "front", "priekšējā piedziņa", "передний привод", "vorderradantrieb"],
    out: {
      lv: "priekšējā piedziņa",
      en: "front-wheel drive",
      ru: "передний привод",
      de: "Vorderradantrieb",
    },
  },
  {
    keys: ["rear-wheel drive", "rear wheel drive", "rwd", "heck", "aizmugurējā piedziņa", "задний привод", "hinterradantrieb"],
    out: {
      lv: "aizmugurējā piedziņa",
      en: "rear-wheel drive",
      ru: "задний привод",
      de: "Hinterradantrieb",
    },
  },
  {
    keys: ["all-wheel drive", "all wheel drive", "awd", "4wd", "allr", "pilnpiedziņa", "полный привод", "allradantrieb"],
    out: { lv: "pilnpiedziņa", en: "all-wheel drive", ru: "полный привод", de: "Allradantrieb" },
  },
  {
    keys: ["coupe", "coupé", "kupeja", "купе"],
    out: { lv: "kupeja", en: "coupe", ru: "купе", de: "Coupé" },
  },
  {
    keys: ["sedan", "limousine", "lim", "sedans", "седан"],
    out: { lv: "sedans", en: "sedan", ru: "седан", de: "Limousine" },
  },
  {
    keys: ["estate", "wagon", "touring", "tou", "universālis", "универсал", "kombi"],
    out: { lv: "universālis", en: "estate", ru: "универсал", de: "Kombi" },
  },
  {
    keys: ["suv", "sav", "apvidus", "внедорожник", "geländewagen"],
    out: { lv: "apvidus", en: "SUV", ru: "внедорожник", de: "SUV" },
  },
  {
    keys: ["hatchback", "hečbeks", "хэтчбек"],
    out: { lv: "hečbeks", en: "hatchback", ru: "хэтчбек", de: "Schrägheck" },
  },
  {
    keys: ["petrol", "gasoline", "benzin", "benzīns", "бензин"],
    out: { lv: "benzīns", en: "petrol", ru: "бензин", de: "Benzin" },
  },
  {
    keys: ["diesel", "dīzelis", "дизель"],
    out: { lv: "dīzelis", en: "diesel", ru: "дизель", de: "Diesel" },
  },
  {
    keys: ["hybrid", "hibrīds", "гибрид"],
    out: { lv: "hibrīds", en: "hybrid", ru: "гибрид", de: "Hybrid" },
  },
  {
    keys: ["electric", "elektro", "электрический", "elektroantrieb"],
    out: { lv: "elektrisks", en: "electric", ru: "электрический", de: "Elektro" },
  },
  {
    keys: ["left-hand drive", "left hand drive", "lhd", "ll", "kreisā stūre", "левый руль", "linkslenker"],
    out: { lv: "kreisā stūre", en: "left-hand drive", ru: "левый руль", de: "Linkslenker" },
  },
  {
    keys: ["right-hand drive", "right hand drive", "rhd", "rl", "labā stūre", "правый руль", "rechtslenker"],
    out: { lv: "labā stūre", en: "right-hand drive", ru: "правый руль", de: "Rechtslenker" },
  },
];

const TOKEN: { re: RegExp; out: LangMap }[] = [
  { re: /\bfabric\b/gi, out: { lv: "audums", en: "fabric", ru: "ткань", de: "Stoff" } },
  { re: /\bimitation leather\b/gi, out: { lv: "mākslīgā āda", en: "imitation leather", ru: "искусственная кожа", de: "Kunstleder" } },
  { re: /\bmicrofiber\b/gi, out: { lv: "mikrošķiedra", en: "microfiber", ru: "микрофибра", de: "Mikrofaser" } },
  { re: /\bleather\b/gi, out: { lv: "āda", en: "leather", ru: "кожа", de: "Leder" } },
  { re: /\bstandard finish\b/gi, out: { lv: "standarta apdare", en: "standard finish", ru: "стандартное покрытие", de: "Standardlackierung" } },
  { re: /\bmetallic\b/gi, out: { lv: "metāliskā", en: "metallic", ru: "металлик", de: "Metallic" } },
  { re: /\banthracite\b/gi, out: { lv: "antracīts", en: "anthracite", ru: "антрацит", de: "Anthrazit" } },
  { re: /\bnight black\b/gi, out: { lv: "nakts melns", en: "night black", ru: "ночной чёрный", de: "Nachtschwarz" } },
  { re: /\bblack\b/gi, out: { lv: "melns", en: "black", ru: "чёрный", de: "schwarz" } },
  { re: /\bwhite\b/gi, out: { lv: "balts", en: "white", ru: "белый", de: "weiß" } },
  { re: /\bgrey\b|\bgray\b/gi, out: { lv: "pelēks", en: "grey", ru: "серый", de: "grau" } },
  { re: /\bsilver\b/gi, out: { lv: "sudrabs", en: "silver", ru: "серебристый", de: "silber" } },
  { re: /\bblue\b/gi, out: { lv: "zils", en: "blue", ru: "синий", de: "blau" } },
  { re: /\bred\b/gi, out: { lv: "sarkans", en: "red", ru: "красный", de: "rot" } },
  { re: /\bgreen\b/gi, out: { lv: "zaļš", en: "green", ru: "зелёный", de: "grün" } },
  { re: /\bbrown\b/gi, out: { lv: "brūns", en: "brown", ru: "коричневый", de: "braun" } },
  { re: /\bbeige\b/gi, out: { lv: "bežs", en: "beige", ru: "бежевый", de: "beige" } },
  { re: /\borange\b/gi, out: { lv: "oranžs", en: "orange", ru: "оранжевый", de: "orange" } },
  { re: /\byellow\b/gi, out: { lv: "dzeltens", en: "yellow", ru: "жёлтый", de: "gelb" } },
  { re: /\b7-speed\b|\b7 speed\b/gi, out: { lv: "7 pakāpju", en: "7-speed", ru: "7-ступенчатая", de: "7-Gang" } },
  { re: /\bdual-clutch\b|\bdual clutch\b/gi, out: { lv: "divsajūgu", en: "dual-clutch", ru: "с двумя сцеплениями", de: "Doppelkupplung" } },
  { re: /\bautomatic\b/gi, out: { lv: "automātiskā", en: "automatic", ru: "автоматическая", de: "Automatik" } },
  { re: /\btransmission\b/gi, out: { lv: "ātrumkārba", en: "transmission", ru: "коробка передач", de: "Getriebe" } },
  { re: /\bcoupe\b|\bcoupé\b/gi, out: { lv: "kupeja", en: "coupe", ru: "купе", de: "Coupé" } },
];

const CODE_RE = /^(?:[A-Z0-9][A-Z0-9./-]{1,14})$/;
const VIN_RE = /^[A-HJ-NPR-Z0-9]{11,17}$/i;
const DATE_RE = /^(?:\d{1,2}\.\d{1,2}\.\d{4}|\d{4}(?:-\d{2}(?:-\d{2})?)?)$/;
const KEEP_FIELDS = new Set<keyof OutvinVehicleInfo>([
  "model",
  "modelSeries",
  "vinCode",
  "engineCode",
  "engineNumber",
  "integrationLevel",
  "currentILevel",
  "developmentCode",
  "modelCode",
  "productionDate",
  "firstRegistration",
  "warrantyStartDate",
  "colorCode",
  "interiorCode",
  "displacement",
]);

function collapse(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function normKey(s: string): string {
  return collapse(s).toLowerCase().replace(/[’']/g, "").replace(/ё/g, "е");
}

function looksLikeCode(s: string): boolean {
  const t = collapse(s);
  if (!t) return true;
  if (DATE_RE.test(t) || VIN_RE.test(t)) return true;
  if (CODE_RE.test(t) && /\d/.test(t)) return true;
  return false;
}

function localizePower(raw: string, lang: ClientReportLang): string {
  let t = collapse(raw);
  if (lang === "lv") t = t.replace(/\bhp\b/gi, "ZS").replace(/\bPS\b/g, "ZS");
  if (lang === "ru") {
    t = t.replace(/\bKW\b/gi, "кВт").replace(/\bkW\b/g, "кВт");
    t = t.replace(/\bhp\b/gi, "л.с.").replace(/\bPS\b/g, "л.с.").replace(/\bZS\b/g, "л.с.");
  }
  if (lang === "de") t = t.replace(/\bhp\b/gi, "PS").replace(/\bZS\b/g, "PS");
  if (lang === "en") t = t.replace(/\bZS\b/g, "hp").replace(/\bPS\b/g, "hp");
  return t;
}

function exactHit(raw: string, lang: ClientReportLang): string | null {
  const key = normKey(raw);
  let best: (typeof EXACT)[number] | null = null;
  for (const row of EXACT) {
    if (row.keys.some((k) => normKey(k) === key)) {
      if (!best || row.keys[0]!.length > best.keys[0]!.length) best = row;
    }
  }
  return best ? best.out[lang] : null;
}

function applyTokens(raw: string, lang: ClientReportLang): string {
  let t = raw;
  for (const row of TOKEN) t = t.replace(row.re, row.out[lang]);
  return collapse(t);
}

/** Vispārīga dīlera vērtība atskaites valodā. Kodiem / VIN / datumiem nemaina. */
export function translateDealerVehicleValue(
  field: keyof OutvinVehicleInfo | string,
  raw: string,
  lang: ClientReportLang,
): string {
  const t = collapse(raw);
  if (!t) return t;
  if (field === "model" || field === "modelSeries") return t;
  if (field === "countryRegion") return normalizeCountryName(t, lang) || t;
  if (field === "power") return localizePower(t, lang);
  if (KEEP_FIELDS.has(field as keyof OutvinVehicleInfo) && looksLikeCode(t.split(/\s+/)[0] ?? t)) {
    return t;
  }
  if (field === "vinCode" || field === "engineCode" || field === "engineNumber") return t;
  if (field === "colorCode" || field === "interiorCode" || field === "modelCode") return t;
  if (field === "productionDate" || field === "firstRegistration" || field === "warrantyStartDate") return t;
  if (looksLikeCode(t) && t === t.toUpperCase() && t.length <= 12) return t;

  const exact = exactHit(t, lang);
  if (exact) return exact;

  if (t.includes("(") && t.includes(")")) {
    const inner = t.replace(/^[^(]+\(/, "").replace(/\)\s*$/, "");
    const outer = t.slice(0, t.indexOf("(")).trim();
    const outerT = exactHit(outer, lang) ?? applyTokens(outer, lang);
    const innerT = exactHit(inner, lang) ?? applyTokens(inner, lang);
    if (outerT && innerT) return `${outerT} (${innerT})`;
  }

  const tokened = applyTokens(t, lang);
  return tokened || t;
}

export const DEALER_VEHICLE_VALUE_TRANSLATABLE_KEYS: (keyof OutvinVehicleInfo)[] = [
  "vehicleType",
  "transmission",
  "steeringSide",
  "body",
  "drive",
  "power",
  "countryRegion",
  "color",
  "interior",
  "fuel",
];
