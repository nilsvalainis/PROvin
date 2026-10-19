import { migrateIrissCriteria } from "@/lib/iriss-criteria-migrate";
import type { IrissCriteriaFilter, IrissCriteriaV1 } from "@/lib/iriss-criteria-types";
import {
  emptyMarketplaceQuery,
  MARKETPLACE_TOO_BROAD_ERROR,
  marketplaceQueryHasStrictBounds,
  type MarketplaceQuery,
} from "@/lib/marketplace/types";

export type MarketplaceOrderCriteria = {
  brandModel?: string;
  productionYears?: string;
  maxMileage?: string;
  totalBudget?: string;
  engineType?: string;
  transmission?: string;
  bodyType?: string;
  driveType?: string;
  powerKw?: string;
  preferredCountries?: string;
  criteria?: IrissCriteriaV1 | null;
};

function digits(raw: string | undefined, max = 12): number | null {
  const n = Number.parseInt(String(raw ?? "").replace(/[^\d]/g, ""), 10);
  return Number.isFinite(n) && n > 0 && String(n).length <= max ? n : null;
}

function firstEnabledFormFilter(criteria: IrissCriteriaV1 | null | undefined): IrissCriteriaFilter | null {
  if (!criteria?.filters?.length) return null;
  return criteria.filters.find((f) => f.enabled && f.useForm) ?? criteria.filters.find((f) => f.enabled) ?? null;
}

function effectiveFilter(order: MarketplaceOrderCriteria): IrissCriteriaFilter {
  return firstEnabledFormFilter(order.criteria) ?? migrateIrissCriteria(order).filters[0]!;
}

function fuelLabel(filter: IrissCriteriaFilter, fallback: string): string {
  const groups = filter.fuel.value.map((f) => f.group);
  if (groups.includes("diesel")) return "diesel";
  if (groups.includes("petrol")) return "petrol";
  if (groups.includes("hybrid")) return "hybrid";
  if (groups.includes("electric")) return "electric";
  if (groups.includes("gas")) return "gas";
  return fallback.trim();
}

function gearboxLabel(filter: IrissCriteriaFilter, fallback: string): string {
  const groups = filter.gearbox.value.map((g) => g.group);
  if (groups.includes("automatic")) return "automatic";
  if (groups.includes("manual")) return "manual";
  return fallback.trim();
}

function splitBrandModel(brandModel: string): { make: string; model: string } {
  const parts = brandModel
    .trim()
    .split(/[\s,/|+]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return { make: "", model: "" };
  if (parts.length === 1) return { make: parts[0]!, model: "" };
  return { make: parts[0]!, model: parts.slice(1).join(" ") };
}

/** Pasūtījuma forma / IrissCriteriaV1 -> vienots tirgus vaicājums. */
export function marketplaceQueryFromOrder(order: MarketplaceOrderCriteria): MarketplaceQuery {
  const filter = effectiveFilter(order);
  const brand = splitBrandModel(order.brandModel ?? "");
  const q = emptyMarketplaceQuery();
  q.make = (filter.make.value[0] ?? brand.make).trim();
  q.model = (filter.models.value[0] ?? brand.model).trim();
  q.yearFrom = filter.yearFrom.value;
  q.yearTo = filter.yearTo.value;
  q.mileageFrom = filter.mileageFrom.value;
  q.mileageTo = filter.mileageTo.value ?? digits(order.maxMileage);
  q.priceFrom = filter.budgetFrom.value;
  q.priceTo = filter.budgetTo.value ?? digits(order.totalBudget, 7);
  q.fuel = fuelLabel(filter, order.engineType ?? "");
  q.gearbox = gearboxLabel(filter, order.transmission ?? "");
  q.powerFromKw = filter.kwFrom.value;
  q.powerToKw = filter.kwTo.value ?? digits(order.powerKw);
  q.displacementFromCc = filter.ccFrom.value;
  q.displacementToCc = filter.ccTo.value;
  q.body = (filter.bodyTypes.value[0] ?? order.bodyType ?? "").trim();
  q.drive = (filter.drive.value[0] ?? order.driveType ?? "").trim();
  q.countries = filter.countries.value.length ? [...filter.countries.value] : [];
  if (!q.countries.length && (order.preferredCountries ?? "").trim()) {
    q.countries = order.preferredCountries!.split(/[,;/]+/).map((s) => s.trim()).filter(Boolean).slice(0, 8);
  }
  return q;
}

export const MARKETPLACE_STRICT_FIELD_LABELS = {
  make: "marka",
  model: "modelis",
  priceFrom: "cena no",
  priceTo: "cena līdz",
  yearFrom: "gads no",
  yearTo: "gads līdz",
  extra: "nobraukums līdz, tilpums no-līdz vai jauda no-līdz",
} as const;

export function marketplaceStrictMissingFields(order: MarketplaceOrderCriteria): string[] {
  const q = marketplaceQueryFromOrder(order);
  const missing: string[] = [];
  if (!q.make.trim()) missing.push(MARKETPLACE_STRICT_FIELD_LABELS.make);
  if (!q.model.trim()) missing.push(MARKETPLACE_STRICT_FIELD_LABELS.model);
  if (q.priceFrom == null) missing.push(MARKETPLACE_STRICT_FIELD_LABELS.priceFrom);
  if (q.priceTo == null) missing.push(MARKETPLACE_STRICT_FIELD_LABELS.priceTo);
  if (q.priceFrom != null && q.priceTo != null && q.priceFrom > q.priceTo) {
    if (!missing.includes(MARKETPLACE_STRICT_FIELD_LABELS.priceFrom)) missing.push(MARKETPLACE_STRICT_FIELD_LABELS.priceFrom);
    if (!missing.includes(MARKETPLACE_STRICT_FIELD_LABELS.priceTo)) missing.push(MARKETPLACE_STRICT_FIELD_LABELS.priceTo);
  }
  if (q.yearFrom == null) missing.push(MARKETPLACE_STRICT_FIELD_LABELS.yearFrom);
  if (q.yearTo == null) missing.push(MARKETPLACE_STRICT_FIELD_LABELS.yearTo);
  if (q.yearFrom != null && q.yearTo != null && q.yearFrom > q.yearTo) {
    if (!missing.includes(MARKETPLACE_STRICT_FIELD_LABELS.yearFrom)) missing.push(MARKETPLACE_STRICT_FIELD_LABELS.yearFrom);
    if (!missing.includes(MARKETPLACE_STRICT_FIELD_LABELS.yearTo)) missing.push(MARKETPLACE_STRICT_FIELD_LABELS.yearTo);
  }
  const mileageOk = q.mileageTo != null && (q.mileageFrom == null || q.mileageFrom <= q.mileageTo);
  const ccOk =
    q.displacementFromCc != null &&
    q.displacementToCc != null &&
    q.displacementFromCc <= q.displacementToCc;
  const powerOk = q.powerFromKw != null && q.powerToKw != null && q.powerFromKw <= q.powerToKw;
  if (!mileageOk && !ccOk && !powerOk) missing.push(MARKETPLACE_STRICT_FIELD_LABELS.extra);
  return missing;
}

export function marketplaceTooBroadSkipReason(order: MarketplaceOrderCriteria | null): string {
  if (!order) return "nav kritēriju";
  const missing = marketplaceStrictMissingFields(order);
  if (!missing.length) return "";
  return `${MARKETPLACE_TOO_BROAD_ERROR} (trūkst: ${missing.join(", ")})`;
}

export function marketplaceMissingFieldsMessage(missing: readonly string[]): string {
  if (!missing.length) return "";
  return `Ielādēt nav iespējams. Trūkst: ${missing.join(", ")}.`;
}

export function marketplaceOrderHasFetchBounds(order: MarketplaceOrderCriteria): boolean {
  return marketplaceQueryHasStrictBounds(marketplaceQueryFromOrder(order));
}

function fold(raw: string): string {
  return raw
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function fuelAlias(raw: string): string {
  const t = fold(raw);
  if (/dizel|diesel/.test(t)) return "diesel";
  if (/petrol|benz|gasoline|otto/.test(t)) return "petrol";
  if (/hybrid/.test(t)) return "hybrid";
  if (/electro|electric|ev\b/.test(t)) return "electric";
  if (/lpg|cng|gas/.test(t)) return "gas";
  return t;
}

function gearboxAlias(raw: string): string {
  const t = fold(raw);
  if (/auto|dsg|tiptronic|cvt/.test(t)) return "automatic";
  if (/manu|schalt/.test(t)) return "manual";
  return t;
}

function includesLoose(hay: string, needle: string): boolean {
  const h = fold(hay);
  const n = fold(needle).trim();
  if (!h || !n) return true;
  return h.includes(n) || n.includes(h);
}

function inRange(value: number | null, from: number | null, to: number | null): boolean {
  if (from == null && to == null) return true;
  if (value == null) return true;
  if (from != null && value < from) return false;
  if (to != null && value > to) return false;
  return true;
}

export type MarketplaceMatchVehicle = {
  title?: string;
  manufacturer?: string;
  year?: string;
  firstRegistration?: string;
  mileageKm?: number | null;
  fuel?: string;
  transmission?: string;
  powerKw?: string;
  bodyType?: string;
  driveType?: string;
  displacementCc?: number | null;
  priceCurrent?: number | null;
  priceStart?: number | null;
  priceBuyNow?: number | null;
};

function vehicleYear(v: MarketplaceMatchVehicle): number | null {
  const m = `${v.firstRegistration ?? ""} ${v.year ?? ""}`.match(/(?:19|20)\d{2}/);
  if (!m) return null;
  const n = Number.parseInt(m[0], 10);
  return n >= 1980 && n <= 2035 ? n : null;
}

function vehiclePower(v: MarketplaceMatchVehicle): number | null {
  return digits(v.powerKw);
}

function vehiclePrice(v: MarketplaceMatchVehicle): number | null {
  for (const n of [v.priceCurrent, v.priceBuyNow, v.priceStart]) {
    if (n != null && Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

/** Tas pats filtrs, ko lieto pēc ielādes: marka/modelis/gads/km/cena/degviela/kārba/jauda/tilpums. */
export function marketplaceVehicleMatchesQuery(v: MarketplaceMatchVehicle, q: MarketplaceQuery): boolean {
  if (!marketplaceQueryHasStrictBounds(q)) return false;
  const hay = `${v.manufacturer ?? ""} ${v.title ?? ""}`;
  if (q.make && hay.trim() && !includesLoose(hay, q.make)) return false;
  if (q.model && hay.trim() && !includesLoose(hay, q.model)) return false;
  if (!inRange(vehicleYear(v), q.yearFrom, q.yearTo)) return false;
  if (!inRange(v.mileageKm ?? null, q.mileageFrom, q.mileageTo)) return false;
  if (!inRange(vehiclePrice(v), q.priceFrom, q.priceTo)) return false;
  if (!inRange(vehiclePower(v), q.powerFromKw, q.powerToKw)) return false;
  if (!inRange(v.displacementCc ?? null, q.displacementFromCc, q.displacementToCc)) return false;
  if (q.fuel && (v.fuel ?? "").trim() && fuelAlias(v.fuel ?? "") !== fuelAlias(q.fuel) && !includesLoose(v.fuel ?? "", q.fuel)) {
    return false;
  }
  if (
    q.gearbox &&
    (v.transmission ?? "").trim() &&
    gearboxAlias(v.transmission ?? "") !== gearboxAlias(q.gearbox) &&
    !includesLoose(v.transmission ?? "", q.gearbox)
  ) {
    return false;
  }
  if (q.body && (v.bodyType ?? "").trim() && !includesLoose(v.bodyType ?? "", q.body) && !includesLoose(hay, q.body)) {
    return false;
  }
  if (q.drive && (v.driveType ?? "").trim() && !includesLoose(v.driveType ?? "", q.drive) && !includesLoose(hay, q.drive)) {
    return false;
  }
  return true;
}

export function marketplaceVehicleMatchesOrder(v: MarketplaceMatchVehicle, order: MarketplaceOrderCriteria): boolean {
  return marketplaceVehicleMatchesQuery(v, marketplaceQueryFromOrder(order));
}
