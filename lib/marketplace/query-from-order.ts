import type { IrissCriteriaFilter, IrissCriteriaV1 } from "@/lib/iriss-criteria-types";
import {
  emptyMarketplaceQuery,
  marketplaceQueryHasBounds,
  type MarketplaceQuery,
} from "@/lib/marketplace/types";

export type MarketplaceOrderCriteria = {
  brandModel?: string;
  productionYears?: string;
  maxMileage?: string;
  totalBudget?: string;
  engineType?: string;
  transmission?: string;
  powerKw?: string;
  preferredCountries?: string;
  criteria?: IrissCriteriaV1 | null;
};

function digits(raw: string | undefined, max = 12): number | null {
  const n = Number.parseInt(String(raw ?? "").replace(/[^\d]/g, ""), 10);
  return Number.isFinite(n) && n > 0 && String(n).length <= max ? n : null;
}

function yearPair(raw: string | undefined): { from: number | null; to: number | null } {
  const text = String(raw ?? "");
  const years = [...text.matchAll(/(?:19|20)\d{2}/g)].map((m) => Number.parseInt(m[0], 10)).filter((n) => n >= 1980 && n <= 2035);
  if (years.length === 0) return { from: null, to: null };
  return { from: Math.min(...years), to: Math.max(...years) };
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

function firstEnabledFormFilter(criteria: IrissCriteriaV1 | null | undefined): IrissCriteriaFilter | null {
  if (!criteria?.filters?.length) return null;
  return criteria.filters.find((f) => f.enabled && f.useForm) ?? criteria.filters.find((f) => f.enabled) ?? null;
}

function fuelLabel(filter: IrissCriteriaFilter | null, fallback: string): string {
  const groups = filter?.fuel.value.map((f) => f.group) ?? [];
  if (groups.includes("diesel")) return "diesel";
  if (groups.includes("petrol")) return "petrol";
  if (groups.includes("hybrid")) return "hybrid";
  if (groups.includes("electric")) return "electric";
  if (groups.includes("gas")) return "gas";
  return fallback.trim();
}

function gearboxLabel(filter: IrissCriteriaFilter | null, fallback: string): string {
  const groups = filter?.gearbox.value.map((g) => g.group) ?? [];
  if (groups.includes("automatic")) return "automatic";
  if (groups.includes("manual")) return "manual";
  return fallback.trim();
}

/** Pasūtījuma forma / IrissCriteriaV1 -> vienots tirgus vaicājums. */
export function marketplaceQueryFromOrder(order: MarketplaceOrderCriteria): MarketplaceQuery {
  const filter = firstEnabledFormFilter(order.criteria);
  const brand = splitBrandModel(order.brandModel ?? "");
  const years = yearPair(order.productionYears);
  const q = emptyMarketplaceQuery();
  q.make = (filter?.make.value[0] ?? brand.make).trim();
  q.model = (filter?.models.value[0] ?? brand.model).trim();
  q.yearFrom = filter?.yearFrom.value ?? years.from;
  q.yearTo = filter?.yearTo.value ?? years.to;
  q.mileageFrom = filter?.mileageFrom.value ?? null;
  q.mileageTo = filter?.mileageTo.value ?? digits(order.maxMileage);
  q.priceFrom = filter?.budgetFrom.value ?? null;
  q.priceTo = filter?.budgetTo.value ?? digits(order.totalBudget, 7);
  q.fuel = fuelLabel(filter, order.engineType ?? "");
  q.gearbox = gearboxLabel(filter, order.transmission ?? "");
  q.powerFromKw = filter?.kwFrom.value ?? null;
  q.powerToKw = filter?.kwTo.value ?? digits(order.powerKw);
  q.countries = filter?.countries.value.length ? [...filter.countries.value] : [];
  if (!q.countries.length && (order.preferredCountries ?? "").trim()) {
    q.countries = order.preferredCountries!.split(/[,;/]+/).map((s) => s.trim()).filter(Boolean).slice(0, 8);
  }
  return q;
}

export function marketplaceOrderHasFetchBounds(order: MarketplaceOrderCriteria): boolean {
  return marketplaceQueryHasBounds(marketplaceQueryFromOrder(order));
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

/** Tas pats filtrs, ko lieto pēc ielādes: marka/modelis/gads/km/cena/degviela/kārba. */
export function marketplaceVehicleMatchesQuery(v: MarketplaceMatchVehicle, q: MarketplaceQuery): boolean {
  if (!marketplaceQueryHasBounds(q)) return false;
  const hay = `${v.manufacturer ?? ""} ${v.title ?? ""}`;
  if (q.make && hay.trim() && !includesLoose(hay, q.make)) return false;
  if (q.model && hay.trim() && !includesLoose(hay, q.model)) return false;
  if (!inRange(vehicleYear(v), q.yearFrom, q.yearTo)) return false;
  if (!inRange(v.mileageKm ?? null, q.mileageFrom, q.mileageTo)) return false;
  if (!inRange(vehiclePrice(v), q.priceFrom, q.priceTo)) return false;
  if (!inRange(vehiclePower(v), q.powerFromKw, q.powerToKw)) return false;
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
  return true;
}

export function marketplaceVehicleMatchesOrder(v: MarketplaceMatchVehicle, order: MarketplaceOrderCriteria): boolean {
  return marketplaceVehicleMatchesQuery(v, marketplaceQueryFromOrder(order));
}
