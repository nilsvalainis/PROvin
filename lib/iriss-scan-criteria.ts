/**
 * Radara (IRISS SCAN) strukturētie meklējuma kritēriji.
 * Tā pati `IrissCriteriaV1` shēma kā pasūtījumam (#822), lai tirgus vaicājums, izsoļu saites
 * un ✓/✕ atzīmes kartītē strādātu vienādi.
 *
 * Atšķirība no pasūtījuma: Radara «Cena» ir sludinājuma cena (salonam nav klienta budžeta ar izmaksām),
 * tāpēc tirgus vaicājumā tā iet tieši, bez «budžets mīnus 2 000 €».
 *
 * Vecie Radari bez `criteria` paliek kā bija: shēmu nolasa atmiņā no teksta laukiem un neraksta atpakaļ.
 * Ieteikums no nosaukuma tikai parāda vērtības; ierakstā tās nonāk tikai pēc operatora «Saglabāt kritērijus».
 */

import { readIrissCriteria } from "@/lib/iriss-criteria-migrate";
import {
  emptyIrissCriteria,
  irissCriteriaIsOperatorAuthored,
  irissCriteriaValue,
  parseIrissCriteriaV1,
  type IrissCriteriaFilter,
  type IrissCriteriaV1,
} from "@/lib/iriss-criteria-types";
import { formatIrissRangePair, parseDisplacementCc, parsePowerKwInput } from "@/lib/iriss-order-range-fields";
import { irissSpecMultiGroups, toggleIrissSpecMulti } from "@/lib/iriss-order-spec-selects";
import type { IrissScanRecord } from "@/lib/iriss-scan-types";

export const IRISS_SCAN_RANGE_FIELDS = [
  "yearFrom",
  "yearTo",
  "mileageFrom",
  "mileageTo",
  "priceFrom",
  "priceTo",
  "kwFrom",
  "kwTo",
  "ccFrom",
  "ccTo",
] as const;

export type IrissScanRangeField = (typeof IRISS_SCAN_RANGE_FIELDS)[number];

export type IrissScanCriteriaView = Record<IrissScanRangeField, string> & {
  make: string;
  models: string;
};

type FilterNumKey = "yearFrom" | "yearTo" | "mileageFrom" | "mileageTo" | "budgetFrom" | "budgetTo" | "kwFrom" | "kwTo" | "ccFrom" | "ccTo";

/** Radara «Cena» glabājas `budgetFrom/To` slotos (tā pati shēma), bet nozīmē sludinājuma cenu. */
const FILTER_KEY: Record<IrissScanRangeField, FilterNumKey> = {
  yearFrom: "yearFrom",
  yearTo: "yearTo",
  mileageFrom: "mileageFrom",
  mileageTo: "mileageTo",
  priceFrom: "budgetFrom",
  priceTo: "budgetTo",
  kwFrom: "kwFrom",
  kwTo: "kwTo",
  ccFrom: "ccFrom",
  ccTo: "ccTo",
};

type ScanCriteriaInput = Pick<IrissScanRecord, "brandModel" | "productionYears" | "engineType" | "transmission" | "bodyType"> & {
  criteria?: unknown;
} & Partial<IrissScanRecord>;

/** Operatora saglabātā shēma vai null (vecs Radars bez strukturētiem kritērijiem). */
export function irissScanStoredCriteria(rec: { criteria?: unknown }): IrissCriteriaV1 | null {
  const parsed = parseIrissCriteriaV1(rec.criteria);
  return parsed && irissCriteriaIsOperatorAuthored(parsed) ? parsed : null;
}

export function irissScanHasStructuredCriteria(rec: { criteria?: unknown }): boolean {
  return irissScanStoredCriteria(rec) != null;
}

function cloneCriteria(raw: IrissCriteriaV1): IrissCriteriaV1 {
  return parseIrissCriteriaV1(JSON.parse(JSON.stringify(raw))) ?? emptyIrissCriteria();
}

/** Darba kopija: saglabātā shēma vai atmiņā no teksta laukiem (bez nosaukuma trokšņa markas laukā). */
function workingCriteria(rec: ScanCriteriaInput): IrissCriteriaV1 {
  const stored = irissScanStoredCriteria(rec);
  if (stored) return cloneCriteria(stored);
  const migrated = cloneCriteria(
    readIrissCriteria({
      brandModel: rec.brandModel,
      productionYears: rec.productionYears,
      engineType: rec.engineType,
      transmission: rec.transmission,
      bodyType: rec.bodyType,
    }),
  );
  // Nosaukumā ar kritērijiem («Audi 2.0D manuālis 2009-2015 ...») modelis no visa teksta būtu troksnis.
  const fromName = suggestIrissScanCriteriaFromName(rec.brandModel);
  const filter = migrated.filters[0];
  if (fromName && filter) {
    filter.make = irissCriteriaValue([...fromName.make], "migrated");
    filter.models = irissCriteriaValue([...fromName.models], "migrated");
  }
  return migrated;
}

function firstFilter(criteria: IrissCriteriaV1): IrissCriteriaFilter {
  const f = criteria.filters[0];
  if (f) return f;
  const created = emptyIrissCriteria().filters[0]!;
  criteria.filters = [created];
  return created;
}

function slotNum(slot: { value: number | null; manual: string } | undefined): string {
  if (!slot) return "";
  if (slot.manual.trim()) return slot.manual;
  return slot.value == null ? "" : String(slot.value);
}

export function irissScanCriteriaView(rec: ScanCriteriaInput): IrissScanCriteriaView {
  const stored = irissScanStoredCriteria(rec);
  const filter = stored?.filters[0];
  const out = { make: "", models: "" } as IrissScanCriteriaView;
  for (const f of IRISS_SCAN_RANGE_FIELDS) out[f] = filter ? slotNum(filter[FILTER_KEY[f]]) : "";
  if (filter) {
    out.make = filter.make.value.join(", ");
    out.models = filter.models.value.join(", ");
  }
  return out;
}

function intIn(raw: string, min: number, max: number): { value: number | null; manual: string } {
  const t = raw.trim();
  if (!t) return { value: null, manual: "" };
  const k = /^\s*(\d+(?:[.,]\d+)?)\s*(k|tk|tūkst)\.?\s*$/i.exec(t);
  const n = k ? Math.round(Number.parseFloat(k[1]!.replace(",", ".")) * 1000) : Number.parseInt(t.replace(/[^\d]/g, ""), 10);
  if (!Number.isFinite(n) || n < min || n > max) return { value: null, manual: t };
  return { value: n, manual: "" };
}

function parseRange(field: IrissScanRangeField, raw: string): { value: number | null; manual: string } {
  if (field === "yearFrom" || field === "yearTo") {
    const t = raw.trim();
    if (!t) return { value: null, manual: "" };
    if (!/^\d{4}$/.test(t)) return { value: null, manual: t };
    return intIn(t, 1980, 2035);
  }
  if (field === "mileageFrom" || field === "mileageTo") return intIn(raw, 0, 3_000_000);
  if (field === "priceFrom" || field === "priceTo") return intIn(raw, 1, 10_000_000);
  if (field === "kwFrom" || field === "kwTo") return parsePowerKwInput(raw);
  return parseDisplacementCc(raw);
}

function stamp(criteria: IrissCriteriaV1): IrissCriteriaFilter {
  const filter = firstFilter(criteria);
  filter.enabled = true;
  filter.useForm = true;
  return filter;
}

/** Teksta lauki, ko vēl lasa vecais kods (saraksts, eCarsTrade saites). */
function legacyText(rec: IrissScanRecord, filter: IrissCriteriaFilter): Partial<IrissScanRecord> {
  return { productionYears: formatIrissRangePair(filter.yearFrom.value, filter.yearTo.value) || rec.productionYears };
}

export function applyIrissScanRangeEdit(rec: IrissScanRecord, field: IrissScanRangeField, raw: string): IrissScanRecord {
  const criteria = workingCriteria(rec);
  const filter = stamp(criteria);
  const parsed = parseRange(field, raw);
  filter[FILTER_KEY[field]] = irissCriteriaValue(parsed.value, "form", parsed.manual);
  const next: IrissScanRecord = { ...rec, criteria };
  if (field === "yearFrom" || field === "yearTo") {
    next.productionYears = formatIrissRangePair(filter.yearFrom.value, filter.yearTo.value);
  }
  return next;
}

function listOf(raw: string): string[] {
  return raw
    .split(/\s*[,;/]\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function applyIrissScanMakeModelEdit(rec: IrissScanRecord, key: "make" | "models", raw: string): IrissScanRecord {
  const criteria = workingCriteria(rec);
  const filter = stamp(criteria);
  filter[key] = irissCriteriaValue(listOf(raw), "form");
  return { ...rec, criteria, ...legacyText(rec, filter) };
}

/** Degvielas / kārbas / virsbūves čipi raksta teksta lauku (kā pasūtījumā) un sinhronizē shēmu. */
export function applyIrissScanSpecTextEdit(
  rec: IrissScanRecord,
  key: "engineType" | "transmission" | "bodyType",
  value: string,
): IrissScanRecord {
  const textRec = { ...rec, [key]: value };
  const criteria = workingCriteria(rec);
  const filter = stamp(criteria);
  const derived = readIrissCriteria({ [key]: value }).filters[0]!;
  if (key === "engineType") filter.fuel = irissCriteriaValue(derived.fuel.value, "form", derived.fuel.manual);
  if (key === "transmission") filter.gearbox = irissCriteriaValue(derived.gearbox.value, "form", derived.gearbox.manual);
  if (key === "bodyType") filter.bodyTypes = irissCriteriaValue(derived.bodyTypes.value, "form", derived.bodyTypes.manual);
  return { ...textRec, criteria };
}

/** Meklēšanas robežas no saglabātās shēmas (null - vecs Radars, lieto teksta laukus). */
export type IrissScanCriteriaBounds = {
  make: string[];
  models: string[];
  yearFrom: number | null;
  yearTo: number | null;
  mileageFrom: number | null;
  mileageTo: number | null;
  priceFrom: number | null;
  priceTo: number | null;
  kwFrom: number | null;
  kwTo: number | null;
  ccFrom: number | null;
  ccTo: number | null;
};

export function irissScanCriteriaBounds(rec: { criteria?: unknown }): IrissScanCriteriaBounds | null {
  const f = irissScanStoredCriteria(rec)?.filters[0];
  if (!f) return null;
  return {
    make: [...f.make.value],
    models: [...f.models.value],
    yearFrom: f.yearFrom.value,
    yearTo: f.yearTo.value,
    mileageFrom: f.mileageFrom.value,
    mileageTo: f.mileageTo.value,
    priceFrom: f.budgetFrom.value,
    priceTo: f.budgetTo.value,
    kwFrom: f.kwFrom.value,
    kwTo: f.kwTo.value,
    ccFrom: f.ccFrom.value,
    ccTo: f.ccTo.value,
  };
}

// ---------------------------------------------------------------------------
// Ieteikums no nosaukuma («Audi 2.0D manuālis 2009-2015, 150-330k, 3000-12000 EUR»)
// ---------------------------------------------------------------------------

export type IrissScanNameSuggestion = {
  make: string[];
  models: string[];
  yearFrom: number | null;
  yearTo: number | null;
  mileageFrom: number | null;
  mileageTo: number | null;
  priceFrom: number | null;
  priceTo: number | null;
  kwFrom: number | null;
  kwTo: number | null;
  ccFrom: number | null;
  ccTo: number | null;
  /** Saglabājamās čipu etiķetes («Dīzelis», «Manuāla»). */
  fuel: string[];
  gearbox: string[];
  /** Cilvēkam lasāms kopsavilkums rīta sarakstam / UI. */
  summary: string[];
};

const DASH = /[\u2012\u2013\u2014\u2015\u2212]/g;

function num(raw: string): number {
  return Number.parseInt(raw.replace(/[\s .]/g, ""), 10);
}

function thousands(raw: string, suffix: string | undefined): number {
  const n = Number.parseFloat(raw.replace(/\s/g, "").replace(",", "."));
  return suffix ? Math.round(n * 1000) : Math.round(n);
}

function fmtInt(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/**
 * Parsē Radara nosaukumu. Atgriež null, ja nav neviena kritērija ārpus markas.
 * Nekas netiek rakstīts - tikai ieteikums.
 */
export function suggestIrissScanCriteriaFromName(name: string): IrissScanNameSuggestion | null {
  let rest = ` ${name.replace(DASH, "-").replace(/ /g, " ")} `;
  const s: IrissScanNameSuggestion = {
    make: [],
    models: [],
    yearFrom: null,
    yearTo: null,
    mileageFrom: null,
    mileageTo: null,
    priceFrom: null,
    priceTo: null,
    kwFrom: null,
    kwTo: null,
    ccFrom: null,
    ccTo: null,
    fuel: [],
    gearbox: [],
    summary: [],
  };
  const cut = (m: RegExpExecArray) => {
    rest = rest.slice(0, m.index) + " " + rest.slice(m.index + m[0].length);
  };

  // Cena: «3000-12000 EUR», «līdz 12 000 €», «12k EUR».
  let m = /(\d[\d\s.]*?)\s*(k)?\s*-\s*(\d[\d\s.]*?)\s*(k)?\s*(?:eur|€)/i.exec(rest);
  if (m) {
    s.priceFrom = m[2] ? thousands(m[1]!, "k") : num(m[1]!);
    s.priceTo = m[4] || m[2] ? thousands(m[3]!, "k") : num(m[3]!);
    cut(m);
  } else if ((m = /(?:līdz|lidz|max|until)\s*(\d[\d\s.]*?)\s*(k)?\s*(?:eur|€)/i.exec(rest))) {
    s.priceTo = m[2] ? thousands(m[1]!, "k") : num(m[1]!);
    cut(m);
  } else if ((m = /(\d[\d\s.]*?)\s*(k)?\s*(?:eur|€)/i.exec(rest))) {
    s.priceTo = m[2] ? thousands(m[1]!, "k") : num(m[1]!);
    cut(m);
  }

  // Jauda: «110-150 kW», «no 110 kW».
  if ((m = /(\d{2,3})\s*-\s*(\d{2,3})\s*kw\b/i.exec(rest))) {
    s.kwFrom = num(m[1]!);
    s.kwTo = num(m[2]!);
    cut(m);
  } else if ((m = /(?:no|from|ab)\s*(\d{2,3})\s*kw\b/i.exec(rest))) {
    s.kwFrom = num(m[1]!);
    cut(m);
  } else if ((m = /(\d{2,3})\s*kw\b/i.exec(rest))) {
    s.kwFrom = num(m[1]!);
    s.kwTo = s.kwFrom;
    cut(m);
  }

  // Gadi: «2009-2015», «no 2015», «2015+».
  if ((m = /\b((?:19|20)\d{2})\s*-\s*((?:19|20)\d{2})\b/.exec(rest))) {
    s.yearFrom = num(m[1]!);
    s.yearTo = num(m[2]!);
    cut(m);
  } else if ((m = /(?:\bno\s*|\bfrom\s*)((?:19|20)\d{2})\b|\b((?:19|20)\d{2})\s*\+/i.exec(rest))) {
    s.yearFrom = num(m[1] ?? m[2]!);
    cut(m);
  }

  // Nobraukums: «150-330k», «150-330 tūkst. km», «100000-200000 km», «līdz 200k».
  if ((m = /(\d{1,3}(?:[.,]\d)?)\s*(k|tk|tūkst\.?)?\s*-\s*(\d{1,3}(?:[.,]\d)?)\s*(k|tk|tūkst\.?)\s*(?:km)?/i.exec(rest))) {
    s.mileageFrom = thousands(m[1]!, "k");
    s.mileageTo = thousands(m[3]!, "k");
    cut(m);
  } else if ((m = /(\d[\d\s]{3,})\s*-\s*(\d[\d\s]{3,})\s*km\b/i.exec(rest))) {
    s.mileageFrom = num(m[1]!);
    s.mileageTo = num(m[2]!);
    cut(m);
  } else if ((m = /(?:līdz|lidz|max)\s*(\d{1,3}(?:[.,]\d)?)\s*(k|tk|tūkst\.?)\s*(?:km)?/i.exec(rest))) {
    s.mileageTo = thousands(m[1]!, "k");
    cut(m);
  } else if ((m = /(?:līdz|lidz|max)\s*(\d[\d\s]{3,})\s*km\b/i.exec(rest))) {
    s.mileageTo = num(m[1]!);
    cut(m);
  }

  // Dzinējs: «2.0D», «2.0 TDI», «1.6» -> tilpums; burts D / TDI -> dīzelis.
  if ((m = /\b(\d)[.,](\d)\s*(d|tdi|cdi|hdi|crdi|dci|tdci|tfsi|tsi|i)?\b/i.exec(rest))) {
    const cc = Number(m[1]) * 1000 + Number(m[2]) * 100;
    if (cc >= 600 && cc <= 9000) {
      // Ap ±50 cm³: «2.0» sludinājumos ir 1968-1998 cm³.
      s.ccFrom = cc - 50;
      s.ccTo = cc + 50;
    }
    const tag = (m[3] ?? "").toLowerCase();
    if (/^(d|tdi|cdi|hdi|crdi|dci|tdci)$/.test(tag)) s.fuel.push("Dīzelis");
    if (/^(tfsi|tsi|i)$/.test(tag)) s.fuel.push("Benzīns");
    cut(m);
  }

  const folded = rest.toLowerCase();
  if (!s.fuel.includes("Dīzelis") && /dīzel|dizel|diesel|\btdi\b/.test(folded)) s.fuel.push("Dīzelis");
  if (!s.fuel.includes("Benzīns") && /benzīn|benzin|petrol|\btfsi\b|\btsi\b/.test(folded)) s.fuel.push("Benzīns");
  if (/hibr|hybrid/.test(folded)) s.fuel.push("Hibrīds");
  if (/manuāl|manual|mehān|mehan/.test(folded)) s.gearbox.push("Manuāla");
  if (/automāt|automat|\bdsg\b|tronic|\bat\b/.test(folded)) s.gearbox.push("Automāts");

  // Atlikušais teksts -> marka / modelis (tas pats lasītājs, ko pasūtījums lieto).
  const brandText = rest
    .replace(/manuāl\w*|manual\w*|mehān\w*|automāt\w*|automat\w*|dīzel\w*|dizel\w*|diesel|benzīn\w*|benzin\w*|petrol|hibr\w*|hybrid|\bdsg\b/gi, " ")
    .replace(/[,;]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (brandText) {
    const f = readIrissCriteria({ brandModel: brandText }).filters[0];
    if (f) {
      s.make = [...f.make.value];
      s.models = [...f.models.value];
    }
  }

  if (s.make.length) s.summary.push(`Marka: ${s.make.join(", ")}`);
  if (s.models.length) s.summary.push(`Modelis: ${s.models.join(", ")}`);
  if (s.yearFrom != null || s.yearTo != null) s.summary.push(`Gadi: ${formatIrissRangePair(s.yearFrom, s.yearTo)}`);
  if (s.mileageFrom != null || s.mileageTo != null) {
    s.summary.push(
      `Nobraukums: ${s.mileageFrom != null ? fmtInt(s.mileageFrom) : ""}${s.mileageFrom != null && s.mileageTo != null ? "-" : s.mileageTo != null ? "līdz " : ""}${s.mileageTo != null ? fmtInt(s.mileageTo) : ""} km`,
    );
  }
  if (s.priceFrom != null || s.priceTo != null) {
    s.summary.push(
      `Cena: ${s.priceFrom != null ? fmtInt(s.priceFrom) : ""}${s.priceFrom != null && s.priceTo != null ? "-" : s.priceTo != null ? "līdz " : ""}${s.priceTo != null ? fmtInt(s.priceTo) : ""} €`,
    );
  }
  if (s.kwFrom != null || s.kwTo != null) s.summary.push(`Jauda: ${formatIrissRangePair(s.kwFrom, s.kwTo)} kW`);
  if (s.ccFrom != null || s.ccTo != null) s.summary.push(`Tilpums: ${formatIrissRangePair(s.ccFrom, s.ccTo)} cm³`);
  if (s.fuel.length) s.summary.push(`Degviela: ${s.fuel.join(", ")}`);
  if (s.gearbox.length) s.summary.push(`Kārba: ${s.gearbox.join(", ")}`);

  const hasCriteria =
    [s.yearFrom, s.yearTo, s.mileageFrom, s.mileageTo, s.priceFrom, s.priceTo, s.kwFrom, s.kwTo, s.ccFrom, s.ccTo].some((v) => v != null) ||
    s.fuel.length > 0 ||
    s.gearbox.length > 0;
  return hasCriteria ? s : null;
}

/**
 * Ieteikums ierakstam - tikai pēc operatora «Saglabāt kritērijus».
 * Nosaukums netiek mainīts. Esošais degvielas / kārbas teksts paliek, ieteikums tikai pievieno trūkstošās grupas.
 */
export function applyIrissScanNameSuggestion(rec: IrissScanRecord, s: IrissScanNameSuggestion): IrissScanRecord {
  let next: IrissScanRecord = rec;
  let engine = rec.engineType;
  for (const label of s.fuel) {
    const group = irissSpecMultiGroups("fuel", label)[0];
    if (group && !irissSpecMultiGroups("fuel", engine).includes(group)) engine = toggleIrissSpecMulti("fuel", engine, group);
  }
  if (engine !== rec.engineType) next = applyIrissScanSpecTextEdit(next, "engineType", engine);
  let gear = rec.transmission;
  for (const label of s.gearbox) {
    const group = irissSpecMultiGroups("gearbox", label)[0];
    if (group && !irissSpecMultiGroups("gearbox", gear).includes(group)) gear = toggleIrissSpecMulti("gearbox", gear, group);
  }
  if (gear !== rec.transmission) next = applyIrissScanSpecTextEdit(next, "transmission", gear);

  const criteria = workingCriteria(next);
  const filter = stamp(criteria);
  if (s.make.length) filter.make = irissCriteriaValue([...s.make], "form");
  filter.models = irissCriteriaValue([...s.models], "form");
  const set = (key: FilterNumKey, value: number | null) => {
    if (value != null) filter[key] = irissCriteriaValue(value, "form");
  };
  set("yearFrom", s.yearFrom);
  set("yearTo", s.yearTo);
  set("mileageFrom", s.mileageFrom);
  set("mileageTo", s.mileageTo);
  set("budgetFrom", s.priceFrom);
  set("budgetTo", s.priceTo);
  set("kwFrom", s.kwFrom);
  set("kwTo", s.kwTo);
  set("ccFrom", s.ccFrom);
  set("ccTo", s.ccTo);
  // Degviela/kārba jau sinhronizēta no teksta; atzīmē kā operatora, lai shēma tiktu saglabāta.
  filter.fuel = irissCriteriaValue(filter.fuel.value, "form", filter.fuel.manual);
  filter.gearbox = irissCriteriaValue(filter.gearbox.value, "form", filter.gearbox.manual);
  return { ...next, criteria, ...legacyText(next, filter) };
}
