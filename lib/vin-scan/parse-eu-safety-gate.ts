/**
 * ES Safety Gate (bij. RAPEX) brīdinājumi par mehāniskajiem transportlīdzekļiem.
 * Tas ir MODEĻA līmeņa avots: Safety Gate nezina konkrētu VIN, tāpēc rezultāts nekad nav
 * "šim auto ir atsaukums", un `flags.recallCount` šeit apzināti netiek likts.
 * Dati: Eiropas Komisija, Safety Gate (CC BY 4.0), vietnes publiskais JSON.
 */

import type { VinScanParse, VinScanRecall } from "@/lib/vin-scan/types";

export const SAFETY_GATE_SEARCH_URL = "https://ec.europa.eu/safety-gate-alerts/public/api/search";
export const SAFETY_GATE_DETAIL_URL = "https://ec.europa.eu/safety-gate-alerts/public/api/notification";
export const SAFETY_GATE_BROWSER_URL = "https://ec.europa.eu/safety-gate-alerts/screen/search?resetSearch=true";
/** Cik gadus atpakaļ meklējam (ieskaitot tekošo). */
export const SAFETY_GATE_YEARS = 5;
/** Vienā lapā prasāmo brīdinājumu skaits (jaunākie vispirms). */
export const SAFETY_GATE_PAGE_SIZE = 100;
/** Cik brīdinājumus rādām un kuriem ielādējam detaļas. */
export const SAFETY_GATE_MAX_ALERTS = 8;
export const SAFETY_GATE_MODEL_LEVEL_NOTE = "var neattiekties uz šo auto";

const MOTOR_VEHICLES_CATEGORY = "product.category.motor.vehicles";

export type SafetyGateAlert = {
  id: number;
  reference: string;
  /** Publicēšanas diena, YYYY-MM-DD. */
  date: string;
  productName: string;
  /** Brīdinājumā nosauktie modeļi (brīvs teksts). */
  models: string;
  brands: string[];
  riskTypes: string[];
};

export type SafetyGateSearch =
  | { ok: true; alerts: SafetyGateAlert[]; total: number; truncated: boolean }
  | { ok: false; summary: string };

export type SafetyGateDetail = {
  /** Produkta kategorijas atslēga, piem. `product.category.motor.vehicles`. */
  category: string;
  productName: string;
  riskText: string;
  /** Ražošanas datumu lauks, kā publicēts. */
  production: string;
  yearFrom: number | null;
  yearTo: number | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Atstarpes, tabulācijas un garās domuzīmes no avota teksta -> viena rinda ar īso defisi. */
function clean(value: unknown): string {
  return str(value)
    .replace(/[‒-―]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function shorten(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 3);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:.]+$/, "")}...`;
}

/** Mazie burti, bez diakritikas, viss kas nav burts/cipars -> atstarpe. */
function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Markas rakstības, ko uzskatām par to pašu marku. Atslēga un vērtība jau ir `fold` formā. */
const BRAND_ALIASES: Record<string, string> = {
  vw: "volkswagen",
  "volkswagen nutzfahrzeuge": "volkswagen",
  "volkswagen commercial vehicles": "volkswagen",
  "vw nutzfahrzeuge": "volkswagen",
  mercedes: "mercedes benz",
  "mercedes amg": "mercedes benz",
  "skoda auto": "skoda",
  landrover: "land rover",
  "alfa romeo": "alfa romeo",
  alfa: "alfa romeo",
  "rolls royce": "rolls royce",
};

/** Kanoniskā markas atslēga salīdzināšanai (reģistrs, diakritika, VW/Volkswagen, Mercedes/Mercedes-Benz). */
export function safetyGateBrandKey(brand: string): string {
  const key = fold(brand);
  return BRAND_ALIASES[key] ?? key;
}

/** Visas markas, ko nosauc viens Safety Gate markas lauks, piem. "Volkswagen (VW)" vai "Mercedes-Benz, Mercedes-AMG". */
function brandKeysOf(raw: string): string[] {
  const inParens = [...raw.matchAll(/\(([^)]*)\)/g)].map((m) => m[1] ?? "");
  const outside = raw.replace(/\([^)]*\)/g, " ");
  return [...outside.split(/[,;/]/), ...inParens].map(safetyGateBrandKey).filter(Boolean);
}

/** Meklēšanas vārds Safety Gate pilnteksta laukam: marka bez diakritikas (avots raksta "Skoda", "Citroen"). */
export function safetyGateSearchTerm(make: string): string {
  const key = safetyGateBrandKey(make);
  if (key === "volkswagen") return "Volkswagen";
  if (key === "mercedes benz") return "Mercedes-Benz";
  return make
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function safetyGateAlertUrl(id: number): string {
  return `https://ec.europa.eu/safety-gate-alerts/screen/webReport/alertDetail/${id}?lang=lv`;
}

export function safetyGateSearchBody(make: string, nowYear: number): string {
  const year = Array.from({ length: SAFETY_GATE_YEARS }, (_, i) => nowYear - i);
  // Vietnes pašas meklēšanas forma: bez visiem šiem laukiem serveris atbild ar 405.
  return JSON.stringify({
    criteria: { year },
    searchCriteriaForNotification: false,
    isLaunched: true,
    isLaunchSearch: true,
    pagination: { sortField: "PUBLICATION_DATE", sortOrder: "DESC", totalElements: 0, numberElements: SAFETY_GATE_PAGE_SIZE, page: 0 },
    fullTextSearch: safetyGateSearchTerm(make),
    language: "en",
    displayDefaultResults: false,
    isForMostRecent: false,
  });
}

export function parseSafetyGateSearch(status: number, text: string): SafetyGateSearch {
  if (status !== 200) return { ok: false, summary: `ES Safety Gate: HTTP ${status}` };
  let data: unknown;
  try {
    data = JSON.parse(text) as unknown;
  } catch {
    return { ok: false, summary: "ES Safety Gate: atbilde nav JSON" };
  }
  const page = asRecord(data);
  if (!Array.isArray(page.content)) return { ok: false, summary: "ES Safety Gate: atbildes forma nav atpazīta" };
  const alerts: SafetyGateAlert[] = [];
  for (const item of page.content) {
    const row = asRecord(item);
    const id = typeof row.id === "number" && Number.isFinite(row.id) ? row.id : 0;
    if (!id) continue;
    const product = asRecord(row.product);
    alerts.push({
      id,
      reference: clean(row.reference),
      date: str(row.publicationDate).slice(0, 10),
      productName: clean(product.name),
      models: clean(product.nameSpecific),
      brands: asArray(product.brands)
        .map((b) => clean(asRecord(b).brand))
        .filter(Boolean),
      riskTypes: asArray(asRecord(row.risk).riskType)
        .map((r) => str(asRecord(r).name))
        .filter(Boolean),
    });
  }
  alerts.sort((a, b) => b.date.localeCompare(a.date));
  const total = typeof page.totalElements === "number" ? page.totalElements : alerts.length;
  return { ok: true, alerts, total, truncated: page.last === false || total > page.content.length };
}

const DATE_YEAR_PATTERNS = [
  /\b\d{1,2}[./-]\d{1,2}[./-]((?:19|20)\d{2})\b/g,
  /\b((?:19|20)\d{2})-\d{1,2}-\d{1,2}\b/g,
  /\b\d{1,2}[./]((?:19|20)\d{2})\b/g,
  /\b((?:19|20)\d{2})[./]\d{1,2}\b/g,
];

/** Gadu diapazons no ražošanas datumu teksta, piem. "04.09.2013 - 01.07.2024" -> 2013..2024. */
export function safetyGateYearRange(text: string): { from: number; to: number } | null {
  const years: number[] = [];
  for (const pattern of DATE_YEAR_PATTERNS) {
    for (const m of text.matchAll(pattern)) years.push(Number(m[1]));
  }
  if (!years.length && /^\s*(?:19|20)\d{2}(?:\s*-\s*(?:19|20)\d{2})?\s*$/.test(text)) {
    for (const m of text.matchAll(/(?:19|20)\d{2}/g)) years.push(Number(m[0]));
  }
  if (!years.length) return null;
  return { from: Math.min(...years), to: Math.max(...years) };
}

function pickVersion(versions: unknown): Record<string, unknown> {
  const rows = asArray(versions).map(asRecord);
  const byLang = (key: string) => rows.find((v) => str(asRecord(v.language).key).toUpperCase() === key);
  return byLang("LV") ?? byLang("EN") ?? rows[0] ?? {};
}

export function parseSafetyGateDetail(status: number, text: string): SafetyGateDetail | null {
  if (status !== 200) return null;
  let data: unknown;
  try {
    data = JSON.parse(text) as unknown;
  } catch {
    return null;
  }
  const root = asRecord(data);
  const product = asRecord(root.product);
  if (!root.id || !Object.keys(product).length) return null;
  const production = asArray(product.batchNumbers)
    .map((b) => clean(asRecord(b).batchNumber))
    .filter(Boolean)
    .join("; ");
  const range = safetyGateYearRange(production);
  return {
    category: str(asRecord(product.productCategory).key),
    productName: clean(pickVersion(product.versions).name),
    riskText: clean(pickVersion(asRecord(root.risk).versions).riskDescription),
    production,
    yearFrom: range?.from ?? null,
    yearTo: range?.to ?? null,
  };
}

function modelKey(model: string): string {
  return fold(model).replace(/\bklasse\b/g, "class");
}

/** Vai brīdinājuma modeļu teksts nosauc šo modeli kā veselu vārdu ("Golf" der "Golf Variant 7", neder "Golfer"). */
function alertNamesModel(alert: SafetyGateAlert, key: string): boolean {
  return ` ${modelKey(alert.models)} `.includes(` ${key} `);
}

export type SafetyGateSelection = {
  /** Brīdinājumi ar precīzi šo marku. */
  brandCount: number;
  modelKnown: boolean;
  /** Kandidāti rādīšanai, jaunākie vispirms: ar modeli - tikai tie, kas to nosauc. */
  candidates: SafetyGateAlert[];
};

export function selectSafetyGateAlerts(
  alerts: readonly SafetyGateAlert[],
  vehicle: { make: string; model: string },
): SafetyGateSelection {
  const brand = safetyGateBrandKey(vehicle.make);
  const sameBrand = brand ? alerts.filter((a) => a.brands.some((raw) => brandKeysOf(raw).includes(brand))) : [];
  const key = modelKey(vehicle.model);
  const modelKnown = key.length >= 2;
  return {
    brandCount: sameBrand.length,
    modelKnown,
    candidates: modelKnown ? sameBrand.filter((a) => alertNamesModel(a, key)) : sameBrand,
  };
}

const RISK_LV: Record<string, string> = {
  INJURIES: "traumu risks",
  FIRE: "ugunsgrēka risks",
  BURNS: "apdegumu risks",
  CHEMICAL: "ķīmiskais risks",
  ENVIRONMENT: "vides risks",
  ELECTRIC_SHOCK: "elektrošoka risks",
  ASPHYXIATION: "nosmakšanas risks",
  SUFFOCATION: "nosmakšanas risks",
  DAMAGE_TO_HEARING: "dzirdes bojājumu risks",
  DAMAGE_TO_SIGHT: "redzes bojājumu risks",
  ENTRAPMENT: "iesprūšanas risks",
  CUTS: "griezumu risks",
};

function riskLabel(types: readonly string[]): string {
  return types.map((t) => RISK_LV[t] ?? t.toLowerCase().replace(/_/g, " ")).join(", ");
}

function plural(n: number): string {
  return n % 10 === 1 && n % 100 !== 11 ? "brīdinājums" : "brīdinājumi";
}

function vinYear(raw: string, nowYear: number): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1980 && n <= nowYear + 1 ? n : null;
}

/** Ražošanas diapazons neder šim gadam. VIN modeļa gads var atšķirties no ražošanas gada par 1. */
function outsideYears(detail: SafetyGateDetail, year: number): boolean {
  if (detail.yearFrom == null || detail.yearTo == null) return false;
  return year < detail.yearFrom - 1 || year > detail.yearTo + 1;
}

export function buildSafetyGateResult(input: {
  make: string;
  model: string;
  year: string;
  search: Extract<SafetyGateSearch, { ok: true }>;
  /** Detaļas pēc brīdinājuma id; trūkstoša vai null = detaļas neizdevās nolasīt. */
  details?: ReadonlyMap<number, SafetyGateDetail | null>;
  nowYear?: number;
}): VinScanParse {
  const { make, search } = input;
  const nowYear = input.nowYear ?? new Date().getFullYear();
  const openUrl = SAFETY_GATE_BROWSER_URL;
  const period = `pēdējie ${SAFETY_GATE_YEARS} gadi`;
  const sel = selectSafetyGateAlerts(search.alerts, { make, model: input.model });
  const model = sel.modelKnown ? input.model.trim() : "";
  const car = [make, model].filter(Boolean).join(" ");
  // Lapā ir tikai jaunākie ieraksti: bez atbilstības nevar apgalvot, ka brīdinājumu nav.
  const incomplete = (): VinScanParse => ({
    status: "unknown",
    summary: `ES Safety Gate: ${car} nav starp ${search.alerts.length} jaunākajiem no ${search.total} rezultātiem, pārbaudi saitē`,
    openUrl,
  });

  if (sel.brandCount === 0) {
    if (search.truncated) return incomplete();
    return { status: "none", summary: `ES Safety Gate: brīdinājumu nav (${make}, ${period})`, openUrl };
  }
  if (sel.candidates.length === 0) {
    if (search.truncated) return incomplete();
    return {
      status: "none",
      summary: `ES Safety Gate: modelim ${model} brīdinājumu nav (markai ${make}: ${sel.brandCount}, ${period})`,
      openUrl,
    };
  }

  const year = vinYear(input.year, nowYear);
  const top = sel.candidates.slice(0, SAFETY_GATE_MAX_ALERTS);
  let otherYears = 0;
  const kept: { alert: SafetyGateAlert; detail: SafetyGateDetail | null }[] = [];
  for (const alert of top) {
    const detail = input.details?.get(alert.id) ?? null;
    if (detail?.category && detail.category !== MOTOR_VEHICLES_CATEGORY) continue;
    if (detail && year != null && outsideYears(detail, year)) {
      otherYears += 1;
      continue;
    }
    kept.push({ alert, detail });
  }

  if (kept.length === 0) {
    if (sel.candidates.length > top.length) return incomplete();
    return {
      status: "none",
      summary: otherYears
        ? `ES Safety Gate: ${year}. gada ${car} brīdinājumu nav (citiem ražošanas gadiem: ${otherYears}, ${period})`
        : `ES Safety Gate: brīdinājumu nav (${car}, ${period})`,
      openUrl,
    };
  }

  const level = model ? "modeļa līmeņa" : "markas līmeņa";
  const scope = model ? car : `${make}, modelis nav zināms`;
  const more = sel.candidates.length > top.length ? `, rādīti ${kept.length} jaunākie no ${sel.candidates.length}` : "";
  const lines = kept.map(({ alert, detail }) =>
    [
      alert.date,
      alert.reference,
      shorten(alert.models || detail?.productName || alert.productName, 140),
      shorten(detail?.riskText || riskLabel(alert.riskTypes), 180),
      detail?.production ? `ražots ${shorten(detail.production, 60)}` : "",
      safetyGateAlertUrl(alert.id),
    ]
      .filter(Boolean)
      .join(" · "),
  );
  const recalls: VinScanRecall[] = kept.map(({ alert }) => ({
    title: [alert.reference, shorten(alert.models || alert.productName, 60), riskLabel(alert.riskTypes)].filter(Boolean).join(", "),
    date: alert.date,
  }));
  return {
    status: "found",
    summary: `ES Safety Gate: ${kept.length} ${level} ${plural(kept.length)} - ${scope} (${SAFETY_GATE_MODEL_LEVEL_NOTE}${more})`,
    detail: [
      `Modeļa līmenis, ${SAFETY_GATE_MODEL_LEVEL_NOTE}. Avots: Eiropas Komisija, Safety Gate (CC BY 4.0).`,
      ...lines,
      otherYears ? `Izlaisti ${otherYears} brīdinājumi ar citu ražošanas gadu (VIN gads ${year}).` : "",
    ]
      .filter(Boolean)
      .join("\n"),
    openUrl,
    recalls,
  };
}
