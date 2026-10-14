/**
 * Auto1 / Autobid / Openlane / Mobile.de → eCarsTrade kritēriju kartes.
 * ET URL atbalsta mark/model/gadu/km/cenu/kW/degvielu/kārbu/virsbūvi/krāsu/
 * durvis/vietas/cm³/VAT/emission. Piedziņa, aprīkojums un izslēgumi paliek
 * `iriss_*` vaicājumā (ingest post-filtrs; future_api tos nenodod).
 */

import { AUTOBID_BRAND_ID_TO_NAME, resolveEcarstradeMake } from "@/lib/iriss-listings-ecarstrade-catalog";

export const ECARSTRADE_COLOR = {
  beige: "Beige",
  black: "Black",
  blue: "Blue",
  brown: "Brown",
  gold: "Gold",
  green: "Green",
  grey: "Grey",
  lightBlue: "Light Blue",
  orange: "Orange",
  pink: "Pink",
  purple: "Purple",
  red: "Red",
  silver: "Silver",
  violet: "Violet",
  white: "White",
  yellow: "Yellow",
} as const;

export const ECARSTRADE_DRIVE = {
  awd: "awd",
  fwd: "fwd",
  rwd: "rwd",
} as const;

export type EcarstradeDrive = (typeof ECARSTRADE_DRIVE)[keyof typeof ECARSTRADE_DRIVE];

export type UnmappedCriterion = {
  key: string;
  value: string;
  reason: string;
};

/**
 * mobile.de consumer `ms=MAKEID;MODELID` (`qsmakeBuy` / suchen.mobile.de).
 * 24100 = Toyota (ne Suzuki), 17700 = Mitsubishi (ne Mini), 17500 = MINI, 23600 = Suzuki.
 * 20700 = Renault; Porsche ir 20100. 13900 = KTM, Lexus ir 15200. 1400 = Other (ne Alpine).
 */
export const MOBILE_DE_MAKE_ID_TO_NAME: Record<string, string> = {
  "3": "Cupra",
  "4": "Polestar",
  "135": "Tesla",
  "900": "Alfa Romeo",
  "1100": "ALPINA",
  "1900": "Audi",
  "3500": "BMW",
  "4700": "Cadillac",
  "5600": "Chevrolet",
  "5900": "Citroen",
  "6600": "Dacia",
  "8800": "Fiat",
  "9000": "Ford",
  "11000": "Honda",
  "11600": "Hyundai",
  "11650": "Infiniti",
  "12400": "Jaguar",
  "12600": "Jeep",
  "13200": "Kia",
  "14800": "Land Rover",
  "15200": "Lexus",
  "16600": "Maserati",
  "16800": "Mazda",
  "17200": "Mercedes-Benz",
  "17300": "MG",
  "17500": "MINI",
  "17700": "Mitsubishi",
  "18700": "Nissan",
  "19000": "Opel",
  "19300": "Peugeot",
  "20100": "Porsche",
  "20700": "Renault",
  "22500": "Seat",
  "22900": "Skoda",
  "23000": "Smart",
  "23500": "Subaru",
  "23600": "Suzuki",
  "24100": "Toyota",
  "25100": "Volvo",
  "25200": "Volkswagen",
};

const COLOR_ALIASES: Record<string, string> = {
  beige: ECARSTRADE_COLOR.beige,
  beza: ECARSTRADE_COLOR.beige,
  black: ECARSTRADE_COLOR.black,
  schwarz: ECARSTRADE_COLOR.black,
  zwart: ECARSTRADE_COLOR.black,
  melns: ECARSTRADE_COLOR.black,
  noir: ECARSTRADE_COLOR.black,
  blue: ECARSTRADE_COLOR.blue,
  blau: ECARSTRADE_COLOR.blue,
  blauw: ECARSTRADE_COLOR.blue,
  zils: ECARSTRADE_COLOR.blue,
  brown: ECARSTRADE_COLOR.brown,
  braun: ECARSTRADE_COLOR.brown,
  bruns: ECARSTRADE_COLOR.brown,
  gold: ECARSTRADE_COLOR.gold,
  green: ECARSTRADE_COLOR.green,
  grun: ECARSTRADE_COLOR.green,
  groen: ECARSTRADE_COLOR.green,
  zals: ECARSTRADE_COLOR.green,
  grey: ECARSTRADE_COLOR.grey,
  gray: ECARSTRADE_COLOR.grey,
  grau: ECARSTRADE_COLOR.grey,
  grijs: ECARSTRADE_COLOR.grey,
  pelēks: ECARSTRADE_COLOR.grey,
  peleks: ECARSTRADE_COLOR.grey,
  anthracite: ECARSTRADE_COLOR.grey,
  "light blue": ECARSTRADE_COLOR.lightBlue,
  lightblue: ECARSTRADE_COLOR.lightBlue,
  hellblau: ECARSTRADE_COLOR.lightBlue,
  orange: ECARSTRADE_COLOR.orange,
  pink: ECARSTRADE_COLOR.pink,
  purple: ECARSTRADE_COLOR.purple,
  lila: ECARSTRADE_COLOR.purple,
  red: ECARSTRADE_COLOR.red,
  rot: ECARSTRADE_COLOR.red,
  rood: ECARSTRADE_COLOR.red,
  sarkans: ECARSTRADE_COLOR.red,
  silver: ECARSTRADE_COLOR.silver,
  silber: ECARSTRADE_COLOR.silver,
  sudrabs: ECARSTRADE_COLOR.silver,
  violet: ECARSTRADE_COLOR.violet,
  white: ECARSTRADE_COLOR.white,
  weiss: ECARSTRADE_COLOR.white,
  wit: ECARSTRADE_COLOR.white,
  balts: ECARSTRADE_COLOR.white,
  yellow: ECARSTRADE_COLOR.yellow,
  gelb: ECARSTRADE_COLOR.yellow,
  geel: ECARSTRADE_COLOR.yellow,
  dzeltens: ECARSTRADE_COLOR.yellow,
};

/** Parametri, kas nav meklēšanas kritērijs (kanāls, lapa, valoda, analitika). */
export const IGNORED_SEARCH_PARAM_KEYS = new Set([
  "channel",
  "page",
  "currentpage",
  "start",
  "perpage",
  "sort",
  "order",
  "lang",
  "language",
  "locale",
  "tab",
  "view",
  "mode",
  "ref",
  "referrer",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "fbclid",
  "clid",
  "_ga",
  "session",
  "token",
  "csrf",
  "id",
  "searchid",
  "powerunit",
  "dir",
  "dam",
  "od",
  "sb",
  "st",
  "cn",
  "ssid",
  "issearchrequest",
  "s",
  "vc",
  "radiussearchzipcode",
  "sortingtype",
  "accidents",
  "countryoforigin",
  "refid",
  "ref",
  "sr",
  "e70",
  "carlist-e70",
  "categoryid-category",
  "carlist-category",
]);

/** Openlane `fuelTypes=100003` (IRISS: 100003 dīzelis, 100001 benzīns, 100013 hibrīds). */
export const OPENLANE_FUEL_ID_TO_NAME: Record<string, string> = {
  "100001": "petrol",
  "100003": "diesel",
  "100013": "hybrid",
};

/** Autobid `e17` (IRISS: 2 benzīns, 3 dīzelis, 6/12/14 hibrīds). */
export const AUTOBID_FUEL_ID_TO_NAME: Record<string, string> = {
  "2": "petrol",
  "3": "diesel",
  "6": "hybrid",
  "12": "hybrid",
  "14": "hybrid",
};

function fold(raw: string): string {
  return raw
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_./,+]+/g, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** `all` / `any` kā vesels tokens, ne substrings (`automatic`, `all wheel`). */
export function isWildcardCriterion(raw: string): boolean {
  const s = fold(raw);
  return !s || /^(all|any|alle|tous|todo|jebkur\w*)$/.test(s);
}

export function mapEcarstradeColor(raw: string): string | null {
  const s = fold(raw);
  if (isWildcardCriterion(s)) return null;
  return COLOR_ALIASES[s] ?? COLOR_ALIASES[s.replace(/\s+/g, "")] ?? null;
}

export function mapEcarstradeDrive(raw: string): EcarstradeDrive | null {
  const s = fold(raw);
  if (!s) return null;
  if (
    /awd|4x4|4wd|four wd|four wheel|all wheel|allrad|quattro|xdrive|4matic|4 motion|4motion|syncro|haldex|pilnpiedzin|integral/.test(
      s,
    )
  ) {
    return ECARSTRADE_DRIVE.awd;
  }
  if (isWildcardCriterion(s)) return null;
  if (/fwd|front wheel|front drive|priekseja|prieksejo|voorwiel|frontantrieb|^front$/.test(s)) return ECARSTRADE_DRIVE.fwd;
  if (/rwd|rear wheel|rear drive|aizmugureja|heck|achterwiel|hinterrad|^rear$/.test(s)) return ECARSTRADE_DRIVE.rwd;
  if (/front/.test(s) && /wheel|drive|piedzin/.test(s)) return ECARSTRADE_DRIVE.fwd;
  if (/rear/.test(s) && /wheel|drive|piedzin/.test(s)) return ECARSTRADE_DRIVE.rwd;
  return null;
}

export function driveTokensForMatch(drive: EcarstradeDrive): string[] {
  if (drive === ECARSTRADE_DRIVE.awd) {
    return ["awd", "4x4", "4wd", "quattro", "xdrive", "4matic", "4motion", "allrad", "all wheel"];
  }
  if (drive === ECARSTRADE_DRIVE.fwd) return ["fwd", "front wheel", "front", "priekšēj", "voorwiel"];
  return ["rwd", "rear wheel", "rear", "heck", "aizmugur"];
}

/** `2.0` / `2000 cm3` / `1998cc` → cm³. */
export function mapEngineCc(raw: string): number | null {
  const s = raw.trim().replace(/,/g, ".");
  if (!s) return null;
  const cc = s.match(/(\d{3,5})\s*(?:cm3|cm³|cc|ccm)\b/i);
  if (cc) {
    const n = Number.parseInt(cc[1] ?? "", 10);
    return n >= 600 && n <= 9000 ? n : null;
  }
  const liters = s.match(/\b(\d)\.(\d)\b/);
  if (liters) {
    const n = Number.parseInt(liters[1] ?? "", 10) * 1000 + Number.parseInt(liters[2] ?? "", 10) * 100;
    return n >= 600 && n <= 9000 ? n : null;
  }
  const digits = s.match(/\b(\d{3,4})\b/);
  if (digits) {
    const n = Number.parseInt(digits[1] ?? "", 10);
    return n >= 600 && n <= 9000 ? n : null;
  }
  return null;
}

export function mapEmissionClass(raw: string): string | null {
  const s = fold(raw).replace(/\s+/g, "");
  if (!s) return null;
  const m = s.match(/euro?(6dtemp|6d|6c|6e|6|5|4|3|2|1|7)/i);
  if (!m) return null;
  const token = (m[1] ?? "").toLowerCase();
  const map: Record<string, string> = {
    "1": "Euro1",
    "2": "Euro2",
    "3": "Euro3",
    "4": "Euro4",
    "5": "Euro5",
    "6": "Euro6",
    "6c": "Euro6c",
    "6dtemp": "Euro6d-TEMP",
    "6d": "Euro6d",
    "6e": "Euro 6e",
    "7": "Euro 7",
  };
  return map[token] ?? null;
}

export function mapVat(raw: string): string | null {
  const s = fold(raw);
  if (!s) return null;
  if (/not.?reclaim|non.?deduct|nav pvn|margin|marge|ohne mwst/.test(s)) return "not_reclaimable";
  if (/reclaim|deduct|pvn|vat|mwst|btw/.test(s)) return "reclaimable";
  return null;
}

export function resolveMakeFromAutobidBrandId(brandId: string): string | null {
  const name = AUTOBID_BRAND_ID_TO_NAME[String(brandId).trim()];
  return name ?? null;
}

/**
 * suchen.mobile.de `ms=MAKEID;MODELID;;` vai `MAKEID;MODELID;;NAME`.
 * Tikai pārbaudīti modeļu ID (neuzminēt 19/20: Toyota 19 nav tas pats kas Mitsubishi 19).
 * Volvo 25100;29 ir XC60 (Nils radars + ET model[]=1866).
 */
export const MOBILE_DE_MODEL_ID_TO_NAME: Record<string, Record<string, string>> = {
  "25100": { "29": "XC60" },
};

/** mobile.de Wohnmobil/Evado/Westfalia ir kemperu kategorija, ne auto marka (arī ja ms=20700 Renault). */
const MOBILE_CAMPER_MODEL = /wohnmobil|reisemobil|evado|westfalia|generation|camping/i;

export function resolveMakeFromMobileMs(ms: string): { make: string | null; model: string; modelId: string } {
  const parts = ms.split(";").map((p) => p.trim());
  const makeId = parts[0] ?? "";
  const modelId = parts[1] ?? "";
  const modelName = parts[3] || "";
  if (MOBILE_CAMPER_MODEL.test(modelName)) {
    return { make: null, model: "", modelId: "" };
  }
  const make = MOBILE_DE_MAKE_ID_TO_NAME[makeId] ?? null;
  const mapped = modelId ? MOBILE_DE_MODEL_ID_TO_NAME[makeId]?.[modelId] ?? "" : "";
  return { make, model: modelName || mapped, modelId };
}

export function makeFromMobileMakeId(id: string): string | null {
  return MOBILE_DE_MAKE_ID_TO_NAME[id.trim()] ?? (resolveEcarstradeMake(id) ? id : null);
}

export function splitListTokens(raw: string): string[] {
  return raw
    .split(/[,|;/]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isNoiseSearchParam(key: string): boolean {
  const k = key.toLowerCase();
  if (IGNORED_SEARCH_PARAM_KEYS.has(k)) return true;
  if (k.startsWith("utm")) return true;
  return false;
}

export type MakeModelPair = { make: string; model: string };

/** Auto1 `manufacturers=MAKE|MODEL|VARIANT;MAKE|MODEL` - nesagriezt visus `|` kā atsevišķas markas. */
export function parseAuto1Manufacturers(raw: string): MakeModelPair[] {
  const out: MakeModelPair[] = [];
  for (const group of raw.split(";")) {
    const parts = group.split("|").map((s) => s.trim()).filter(Boolean);
    if (!parts[0]) continue;
    out.push({ make: parts[0], model: parts[1] ?? "" });
  }
  return out;
}

/** Openlane `makesModels=Make,Model|Make,Model`. */
export function parseAutobidCarlistManufacturerModel(raw: string): MakeModelPair[] {
  const out: MakeModelPair[] = [];
  for (const group of raw.split(/[|]/)) {
    const t = group.trim();
    if (!t) continue;
    const sep = t.includes(";") ? ";" : t.includes(",") ? "," : "";
    if (!sep) {
      if (/^\d+$/.test(t)) {
        const make = resolveMakeFromAutobidBrandId(t);
        if (make) out.push({ make, model: "" });
      } else {
        out.push({ make: t, model: "" });
      }
      continue;
    }
    const i = t.indexOf(sep);
    const makeRaw = t.slice(0, i).trim();
    const model = t.slice(i + 1).trim();
    const make = /^\d+$/.test(makeRaw) ? resolveMakeFromAutobidBrandId(makeRaw) ?? "" : makeRaw;
    if (make) out.push({ make, model });
  }
  return out;
}

export function parseOpenlaneMakesModels(raw: string): MakeModelPair[] {
  const out: MakeModelPair[] = [];
  for (const group of raw.split("|")) {
    const t = group.trim();
    if (!t) continue;
    const comma = t.indexOf(",");
    if (comma < 0) {
      out.push({ make: t, model: "" });
      continue;
    }
    out.push({ make: t.slice(0, comma).trim(), model: t.slice(comma + 1).trim() });
  }
  return out;
}

export function parseZeroUnboundedRange(raw: string): { from: number | null; to: number | null } {
  const s = raw.trim();
  if (!s) return { from: null, to: null };
  const pair = s.match(/^(\d*)\s*[,:]\s*(\d*)$/);
  if (pair) {
    const a = pair[1] ? Number.parseInt(pair[1], 10) : null;
    const b = pair[2] ? Number.parseInt(pair[2], 10) : null;
    return {
      from: a != null && Number.isFinite(a) && a > 0 ? a : null,
      to: b != null && Number.isFinite(b) && b > 0 ? b : null,
    };
  }
  const n = Number.parseInt(s.replace(/[^\d]/g, ""), 10);
  if (!Number.isFinite(n) || n <= 0) return { from: null, to: null };
  return { from: n, to: n };
}

export function mapOpenlaneFuelToken(raw: string): string | null {
  const id = OPENLANE_FUEL_ID_TO_NAME[raw.trim()];
  return id ?? null;
}

export function mapAutobidFuelToken(raw: string): string | null {
  return AUTOBID_FUEL_ID_TO_NAME[raw.trim()] ?? null;
}

/**
 * Viena auto kartīte (ne meklēšanas filtrs). Auto1 `id=` kopā ar manufacturers paliek meklējums.
 */
export function isSingleVehicleListingUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    const host = u.hostname.toLowerCase();
    const path = u.pathname.toLowerCase();
    if (/\/(details\.html|fahrzeugangebot|offer\/|vehicle\/\d|item\/\d)/.test(path)) return true;
    if (host.includes("auto1.com")) {
      const id = (u.searchParams.get("id") ?? "").trim();
      if (!id) return false;
      const hasSearch =
        u.searchParams.has("manufacturers") ||
        u.searchParams.has("manufacturer") ||
        u.searchParams.has("makes") ||
        u.searchParams.has("make") ||
        u.searchParams.has("makesModels");
      return !hasSearch;
    }
    if (host.includes("openlane.")) {
      if (/\/(car|detail|vehicle)\//.test(path)) return true;
      const auctionId = (u.searchParams.get("auctionId") ?? u.searchParams.get("auctionid") ?? "").trim();
      if (auctionId) return true;
    }
    if (host.includes("autobid.") && /\/(offer|auction-item)\//.test(path)) return true;
    return false;
  } catch {
    return false;
  }
}
