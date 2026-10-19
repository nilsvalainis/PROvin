/**
 * IRISS pasūtījuma stingrie no-līdz diapazoni.
 * Strukturēti `criteria` filtrā; teksta lauki paliek atpakaļsaderībai.
 */

import { parseEnginePowerKwFromText } from "@/lib/engine-power-kw";
import { migrateIrissCriteria, readIrissCriteria } from "@/lib/iriss-criteria-migrate";
import {
  emptyIrissCriteria,
  irissCriteriaIsOperatorAuthored,
  irissCriteriaValue,
  parseIrissCriteriaV1,
  type IrissCriteriaFilter,
  type IrissCriteriaV1,
  type IrissCriteriaValue,
} from "@/lib/iriss-criteria-types";
import { mapEngineCc } from "@/lib/iriss-listings-ecarstrade-criteria";
import { parseIrissOrderBudget } from "@/lib/iriss-listings-orders";
import { applyIrissFieldEdit } from "@/lib/iriss-pasutijumi-audit-fields";
import type { IrissPasutijumsRecord } from "@/lib/iriss-pasutijumi-types";

export const IRISS_ORDER_RANGE_FIELDS = [
  "budgetFrom",
  "budgetTo",
  "yearFrom",
  "yearTo",
  "mileageFrom",
  "mileageTo",
  "ccFrom",
  "ccTo",
  "kwFrom",
  "kwTo",
] as const;

export type IrissOrderRangeField = (typeof IRISS_ORDER_RANGE_FIELDS)[number];

export const IRISS_ORDER_SPEC_TEXT_KEYS = [
  "brandModel",
  "engineType",
  "transmission",
  "bodyType",
  "driveType",
] as const;

export type IrissOrderSpecTextKey = (typeof IRISS_ORDER_SPEC_TEXT_KEYS)[number];

export type IrissOrderRangeView = {
  budgetFrom: string;
  budgetTo: string;
  yearFrom: string;
  yearTo: string;
  mileageFrom: string;
  mileageTo: string;
  ccFrom: string;
  ccTo: string;
  kwFrom: string;
  kwTo: string;
};

const YEAR_MIN = 1980;
const YEAR_MAX = 2035;
const PRICE_MAX = 10_000_000;
const KM_MAX = 3_000_000;

function cloneCriteria(raw: IrissCriteriaV1): IrissCriteriaV1 {
  return parseIrissCriteriaV1(JSON.parse(JSON.stringify(raw))) ?? emptyIrissCriteria();
}

function firstFilter(criteria: IrissCriteriaV1): IrissCriteriaFilter {
  const filter = criteria.filters[0];
  if (filter) return filter;
  const created = emptyIrissCriteria().filters[0]!;
  criteria.filters = [created];
  return created;
}

function slotText(slot: IrissCriteriaValue<number | null> | undefined): string {
  if (!slot) return "";
  if (slot.manual.trim()) return slot.manual;
  if (slot.value == null) return "";
  return String(slot.value);
}

export function irissOrderRangeView(rec: Pick<IrissPasutijumsRecord, "criteria"> & Record<string, unknown>): IrissOrderRangeView {
  const filter = readIrissCriteria(rec).filters[0];
  return {
    budgetFrom: slotText(filter?.budgetFrom),
    budgetTo: slotText(filter?.budgetTo),
    yearFrom: slotText(filter?.yearFrom),
    yearTo: slotText(filter?.yearTo),
    mileageFrom: slotText(filter?.mileageFrom),
    mileageTo: slotText(filter?.mileageTo),
    ccFrom: slotText(filter?.ccFrom),
    ccTo: slotText(filter?.ccTo),
    kwFrom: slotText(filter?.kwFrom),
    kwTo: slotText(filter?.kwTo),
  };
}

function parseYear(raw: string): { value: number | null; manual: string } {
  const t = raw.trim();
  if (!t) return { value: null, manual: "" };
  if (!/^\d{4}$/.test(t)) return { value: null, manual: t };
  const n = Number.parseInt(t, 10);
  if (n < YEAR_MIN || n > YEAR_MAX) return { value: null, manual: t };
  return { value: n, manual: "" };
}

function parsePrice(raw: string): { value: number | null; manual: string } {
  const t = raw.trim();
  if (!t) return { value: null, manual: "" };
  const n = parseIrissOrderBudget(t);
  if (n == null || n < 1 || n > PRICE_MAX) return { value: null, manual: t };
  return { value: n, manual: "" };
}

function parseKm(raw: string): { value: number | null; manual: string } {
  const t = raw.trim();
  if (!t) return { value: null, manual: "" };
  const n = Number.parseInt(t.replace(/[^\d]/g, ""), 10);
  if (!Number.isFinite(n) || n < 0 || n > KM_MAX) return { value: null, manual: t };
  return { value: n, manual: "" };
}

/** cm³ vai litri (`1.6`, `1,6 l`, `1600`, `1600 cm3`). */
export function parseDisplacementCc(raw: string): { value: number | null; manual: string } {
  const t = raw.trim();
  if (!t) return { value: null, manual: "" };
  const mapped = mapEngineCc(t);
  if (mapped != null) return { value: mapped, manual: "" };
  const n = Number.parseFloat(t.replace(",", ".").replace(/[^\d.]/g, ""));
  if (!Number.isFinite(n)) return { value: null, manual: t };
  if (n >= 1 && n <= 10 && !/\d{3,}/.test(t)) return { value: Math.round(n * 1000), manual: "" };
  return { value: null, manual: t };
}

export function parsePowerKwInput(raw: string): { value: number | null; manual: string } {
  const t = raw.trim();
  if (!t) return { value: null, manual: "" };
  const n = parseEnginePowerKwFromText(t, { bareNumberIsKw: true });
  if (n == null) return { value: null, manual: t };
  return { value: n, manual: "" };
}

function parseRangeInput(field: IrissOrderRangeField, raw: string): { value: number | null; manual: string } {
  if (field === "yearFrom" || field === "yearTo") return parseYear(raw);
  if (field === "budgetFrom" || field === "budgetTo") return parsePrice(raw);
  if (field === "mileageFrom" || field === "mileageTo") return parseKm(raw);
  if (field === "ccFrom" || field === "ccTo") return parseDisplacementCc(raw);
  return parsePowerKwInput(raw);
}

export function formatIrissRangePair(from: number | null, to: number | null): string {
  if (from != null && to != null) return `${from}-${to}`;
  if (from != null) return `no ${from}`;
  if (to != null) return String(to);
  return "";
}

function inverted(from: number | null, to: number | null): boolean {
  return from != null && to != null && from > to;
}

export function irissOrderRangeErrors(viewFilter?: IrissCriteriaFilter | null): string[] {
  const filter = viewFilter;
  if (!filter) return [];
  const out: string[] = [];
  if (inverted(filter.budgetFrom.value, filter.budgetTo.value)) out.push("Cena: no nedrīkst būt lielāks par līdz.");
  if (inverted(filter.yearFrom.value, filter.yearTo.value)) out.push("Gadi: no nedrīkst būt lielāks par līdz.");
  if (inverted(filter.mileageFrom.value, filter.mileageTo.value)) out.push("Nobraukums: no nedrīkst būt lielāks par līdz.");
  if (inverted(filter.ccFrom.value, filter.ccTo.value)) out.push("Tilpums: no nedrīkst būt lielāks par līdz.");
  if (inverted(filter.kwFrom.value, filter.kwTo.value)) out.push("Jauda: no nedrīkst būt lielāks par līdz.");
  return out;
}

export function irissOrderRangeErrorFor(
  rec: Pick<IrissPasutijumsRecord, "criteria"> & Record<string, unknown>,
  pair: "budget" | "year" | "mileage" | "cc" | "kw",
): string | null {
  const filter = readIrissCriteria(rec).filters[0];
  if (!filter) return null;
  const map = {
    budget: inverted(filter.budgetFrom.value, filter.budgetTo.value) ? "Cena: no nedrīkst būt lielāks par līdz." : null,
    year: inverted(filter.yearFrom.value, filter.yearTo.value) ? "Gadi: no nedrīkst būt lielāks par līdz." : null,
    mileage: inverted(filter.mileageFrom.value, filter.mileageTo.value)
      ? "Nobraukums: no nedrīkst būt lielāks par līdz."
      : null,
    cc: inverted(filter.ccFrom.value, filter.ccTo.value) ? "Tilpums: no nedrīkst būt lielāks par līdz." : null,
    kw: inverted(filter.kwFrom.value, filter.kwTo.value) ? "Jauda: no nedrīkst būt lielāks par līdz." : null,
  } as const;
  return map[pair];
}

function stampMakeModel(filter: IrissCriteriaFilter, brandModel: string): void {
  const text = brandModel.trim();
  if (!text) return;
  const migrated = readIrissCriteria({ brandModel: text });
  const make = migrated.filters[0]?.make.value ?? [];
  const models = migrated.filters[0]?.models.value ?? [];
  if (make.length) filter.make = irissCriteriaValue(make, "form");
  if (models.length) filter.models = irissCriteriaValue(models, "form");
  else if (!filter.models.value.length) {
    const parts = text.split(/\s+/);
    if (parts.length > 1) filter.models = irissCriteriaValue([parts.slice(1).join(" ")], "form");
  }
}

function legacyFromFilter(filter: IrissCriteriaFilter, prev: IrissPasutijumsRecord): Partial<IrissPasutijumsRecord> {
  return {
    productionYears: formatIrissRangePair(filter.yearFrom.value, filter.yearTo.value) || prev.productionYears,
    totalBudget: formatIrissRangePair(filter.budgetFrom.value, filter.budgetTo.value) || prev.totalBudget,
    maxMileage: formatIrissRangePair(filter.mileageFrom.value, filter.mileageTo.value) || prev.maxMileage,
    powerKw: formatIrissRangePair(filter.kwFrom.value, filter.kwTo.value) || prev.powerKw,
  };
}

export function applyIrissOrderRangeEdit(
  prev: IrissPasutijumsRecord,
  field: IrissOrderRangeField,
  raw: string,
  nowMs: number,
): IrissPasutijumsRecord {
  const criteria = cloneCriteria(readIrissCriteria(prev));
  const filter = firstFilter(criteria);
  filter.enabled = true;
  filter.useForm = true;
  const parsed = parseRangeInput(field, raw);
  filter[field] = irissCriteriaValue(parsed.value, "form", parsed.manual);
  stampMakeModel(filter, prev.brandModel);
  const legacy = legacyFromFilter(filter, prev);
  if (field === "yearFrom" || field === "yearTo") {
    legacy.productionYears = formatIrissRangePair(filter.yearFrom.value, filter.yearTo.value);
  }
  if (field === "budgetFrom" || field === "budgetTo") {
    legacy.totalBudget = formatIrissRangePair(filter.budgetFrom.value, filter.budgetTo.value);
  }
  if (field === "mileageFrom" || field === "mileageTo") {
    legacy.maxMileage = formatIrissRangePair(filter.mileageFrom.value, filter.mileageTo.value);
  }
  if (field === "kwFrom" || field === "kwTo") {
    legacy.powerKw = formatIrissRangePair(filter.kwFrom.value, filter.kwTo.value);
  }
  return applyIrissFieldEdit(prev, { ...legacy, criteria }, nowMs);
}

export function applyIrissOrderSpecTextEdit(
  prev: IrissPasutijumsRecord,
  key: IrissOrderSpecTextKey,
  value: string,
  nowMs: number,
): IrissPasutijumsRecord {
  const next = applyIrissFieldEdit(prev, { [key]: value } as Partial<IrissPasutijumsRecord>, nowMs);
  const criteria = cloneCriteria(readIrissCriteria(next));
  const filter = firstFilter(criteria);
  filter.enabled = true;
  filter.useForm = true;
  const migrated = migrateIrissCriteria(next).filters[0];
  if (!migrated) return { ...next, criteria };
  if (key === "brandModel") {
    filter.make = { ...migrated.make, source: "form" };
    filter.models = { ...migrated.models, source: "form" };
  } else if (key === "engineType") {
    filter.fuel = { ...migrated.fuel, source: "form" };
  } else if (key === "transmission") {
    filter.gearbox = { ...migrated.gearbox, source: "form" };
  } else if (key === "bodyType") {
    filter.bodyTypes = { ...migrated.bodyTypes, source: "form" };
  } else if (key === "driveType") {
    filter.drive = { ...migrated.drive, source: "form" };
  }
  return { ...next, criteria };
}

export function isIrissOrderSpecTextKey(key: string): key is IrissOrderSpecTextKey {
  return (IRISS_ORDER_SPEC_TEXT_KEYS as readonly string[]).includes(key);
}

/** Overlay teksta gadi/cena/km pārraksta strukturētos diapazonus (source form). */
export function syncIrissOrderRangesFromLegacy(prev: IrissPasutijumsRecord, nowMs: number): IrissPasutijumsRecord {
  const migrated = migrateIrissCriteria(prev).filters[0];
  if (!migrated) return prev;
  const criteria = cloneCriteria(readIrissCriteria(prev));
  const filter = firstFilter(criteria);
  filter.enabled = true;
  filter.useForm = true;
  filter.yearFrom = { ...migrated.yearFrom, source: "form" };
  filter.yearTo = { ...migrated.yearTo, source: "form" };
  filter.mileageFrom = { ...migrated.mileageFrom, source: "form" };
  filter.mileageTo = { ...migrated.mileageTo, source: "form" };
  filter.budgetFrom = { ...migrated.budgetFrom, source: "form" };
  filter.budgetTo = { ...migrated.budgetTo, source: "form" };
  return applyIrissFieldEdit(prev, { criteria }, nowMs);
}

export { irissCriteriaIsOperatorAuthored };
