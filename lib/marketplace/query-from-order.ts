import {
  bodiesMatchGroups,
  drivesMatchGroups,
  fuelsMatchGroups,
  gearboxesMatchGroups,
} from "@/lib/iriss-criteria-listing-match";
import { migrateIrissCriteria } from "@/lib/iriss-criteria-migrate";
import { listingSearchPriceBounds } from "@/lib/iriss-listings-cost";
import { currentListingSearchCosts } from "@/lib/iriss-listings-search-costs";
import { parseIrissOrderBoundRange } from "@/lib/iriss-listings-orders";
import type { IrissCriteriaFilter, IrissCriteriaV1 } from "@/lib/iriss-criteria-types";
import {
  emptyMarketplaceQuery,
  MARKETPLACE_TOO_BROAD_ERROR,
  marketplaceQueryHasMatchBounds,
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

/** Tirgus vaicājuma saraksta lauks («diesel, petrol») -> vērtības. */
export function marketplaceQueryList(raw: string): string[] {
  return raw
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

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

/** Nils 30.10: vairākas izvēles - visas grupas (komatu saraksts), nevis tikai pirmā. */
function fuelLabel(filter: IrissCriteriaFilter, fallback: string): string {
  const groups = filter.fuel.value.map((f) => f.group);
  const known = (["diesel", "petrol", "hybrid", "electric", "gas"] as const).filter((g) => groups.includes(g));
  if (known.length > 0) return known.join(", ");
  return fallback.trim();
}

function gearboxLabel(filter: IrissCriteriaFilter, fallback: string): string {
  const groups = filter.gearbox.value.map((g) => g.group);
  // Abas kārbas = jebkura (bez kārbas filtra).
  if (groups.includes("automatic") && groups.includes("manual")) return "";
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

function orderSearchPriceBoundsFromFilter(
  order: MarketplaceOrderCriteria,
  filter: IrissCriteriaFilter,
): { from: number | null; to: number | null } {
  const budget =
    filter.budgetFrom.value != null || filter.budgetTo.value != null
      ? { from: filter.budgetFrom.value, to: filter.budgetTo.value }
      : parseIrissOrderBoundRange(order.totalBudget ?? "");
  return listingSearchPriceBounds(budget, currentListingSearchCosts());
}

/**
 * Sludinājuma cenas robežas pasūtījumam (budžets mīnus LIST izmaksas), rēķinātas tagad.
 * Tās pašas, ko tirgus vaicājums; saglabātajām saitēm tās uzliek nolasīšanas brīdī.
 */
export function orderSearchPriceBounds(order: MarketplaceOrderCriteria): { from: number | null; to: number | null } {
  return orderSearchPriceBoundsFromFilter(order, effectiveFilter(order));
}

/**
 * Nils 31.10: mobile.de / AutoScout24 griesti = budžets mīnus 2 000 € (izdevumi mazāki nekā izsolē):
 * 5 000 -> 3 000, 15 000 -> 13 000, 20 000 -> 18 000. Apakšā - 55 % no budžeta (kā līdz šim).
 */
export const MARKETPLACE_PRICE_RESERVE_EUR = 2000;
export const MARKETPLACE_PRICE_FROM_SHARE = 0.55;

export function marketplacePriceBoundsFromBudget(budget: { from: number | null; to: number | null }): { from: number | null; to: number | null } {
  const ok = (n: number | null | undefined): n is number => n != null && Number.isFinite(n) && n > 0;
  const top = ok(budget.to) ? budget.to : ok(budget.from) ? budget.from : null;
  if (top == null) return { from: null, to: null };
  const round100 = (n: number) => Math.round(n / 100) * 100;
  const to = Math.max(0, round100(top - MARKETPLACE_PRICE_RESERVE_EUR));
  if (to <= 0) return { from: null, to: null };
  return { from: Math.min(round100(top * MARKETPLACE_PRICE_FROM_SHARE), to), to };
}

function orderMarketplacePriceBounds(order: MarketplaceOrderCriteria, filter: IrissCriteriaFilter): { from: number | null; to: number | null } {
  const budget =
    filter.budgetFrom.value != null || filter.budgetTo.value != null
      ? { from: filter.budgetFrom.value, to: filter.budgetTo.value }
      : parseIrissOrderBoundRange(order.totalBudget ?? "");
  return marketplacePriceBoundsFromBudget(budget);
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
  const price = orderMarketplacePriceBounds(order, filter);
  q.priceFrom = price.from;
  q.priceTo = price.to;
  q.fuel = fuelLabel(filter, order.engineType ?? "");
  q.gearbox = gearboxLabel(filter, order.transmission ?? "");
  q.powerFromKw = filter.kwFrom.value;
  q.powerToKw = filter.kwTo.value ?? digits(order.powerKw);
  q.displacementFromCc = filter.ccFrom.value;
  q.displacementToCc = filter.ccTo.value;
  q.body = (filter.bodyTypes.value.length > 0 ? filter.bodyTypes.value.join(", ") : (order.bodyType ?? "")).trim();
  // mobile.de pārdevēji piedziņu bieži nenorāda - filtrā tikai pilnpiedziņa (citādi pazustu derīgi auto).
  // Ja atzīmēta arī cita piedziņa - bez piedziņas filtra.
  const drives = filter.drive.value;
  const drive = (drives.length > 0 ? drives.join(", ") : (order.driveType ?? "")).trim();
  q.drive = drives.length > 0 ? (drives.every((d) => d === "awd") ? "awd" : "") : /awd|4x4|4wd|pilnpiedzi|quattro|xdrive|4matic|4motion|allrad/i.test(drive) ? "awd" : "";
  // Nils 28.10: pasūtījumos meklējam Vācijā, Nīderlandē un Beļģijā; vecais lauks «Valstis» paliek datos, bet netiek izmantots.
  q.countries = [...IRISS_ORDER_SEARCH_COUNTRIES];
  return q;
}

/** Pasūtījumu meklēšanas valstis (AutoScout24): Vācija, Nīderlande, Beļģija. */
export const IRISS_ORDER_SEARCH_COUNTRIES = ["DE", "NL", "BE"] as const;

export const MARKETPLACE_STRICT_FIELD_LABELS = {
  make: "marka",
  model: "modelis",
  priceFrom: "cena no",
  priceTo: "cena līdz",
  yearFrom: "gadi no",
  yearTo: "gadi līdz",
} as const;

export const MARKETPLACE_EXTRA_RANGE_MESSAGE = "Vēl vajag vienu no: nobraukums līdz, tilpums vai jauda.";

function extraRangeOk(order: MarketplaceOrderCriteria): boolean {
  const q = marketplaceQueryFromOrder(order);
  const mileageOk = q.mileageTo != null && (q.mileageFrom == null || q.mileageFrom <= q.mileageTo);
  const ccOk =
    q.displacementFromCc != null &&
    q.displacementToCc != null &&
    q.displacementFromCc <= q.displacementToCc;
  const powerOk = q.powerFromKw != null && q.powerToKw != null && q.powerFromKw <= q.powerToKw;
  return mileageOk || ccOk || powerOk;
}

export function marketplaceExtraRangeMissing(order: MarketplaceOrderCriteria): boolean {
  return !extraRangeOk(order);
}

/** Tikai marka, modelis, cena, gadi. Extra “viens no” šeit nav. */
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
  return missing;
}

export function marketplaceTooBroadSkipReason(order: MarketplaceOrderCriteria | null): string {
  if (!order) return "nav kritēriju";
  const missing = marketplaceStrictMissingFields(order);
  const extra = marketplaceExtraRangeMissing(order);
  if (!missing.length && !extra) return "";
  if (missing.length && extra) {
    return `${MARKETPLACE_TOO_BROAD_ERROR} (trūkst: ${missing.join(", ")}). ${MARKETPLACE_EXTRA_RANGE_MESSAGE}`;
  }
  if (missing.length) return `${MARKETPLACE_TOO_BROAD_ERROR} (trūkst: ${missing.join(", ")})`;
  return `${MARKETPLACE_TOO_BROAD_ERROR}. ${MARKETPLACE_EXTRA_RANGE_MESSAGE}`;
}

export function marketplaceMissingFieldsMessage(missing: readonly string[]): string {
  if (!missing.length) return "";
  return `Ielādēt nav iespējams. Aizpildi: ${missing.join(", ")}.`;
}

export function marketplaceMissingExtraRangeMessage(missing: boolean): string {
  return missing ? MARKETPLACE_EXTRA_RANGE_MESSAGE : "";
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
  if (/hybrid|hibrid|phev|mhev|hev/.test(t)) return "hybrid";
  if (/dizel|diesel/.test(t)) return "diesel";
  if (/petrol|benz|gasoline|otto/.test(t)) return "petrol";
  if (/electro|electric|ev\b/.test(t)) return "electric";
  if (/lpg|cng|gas/.test(t)) return "gas";
  return t;
}

function gearboxAlias(raw: string): string {
  const t = fold(raw);
  if (/auto|dsg|tiptronic|cvt/.test(t)) return "automatic";
  if (/manu|schalt|mehan/.test(t)) return "manual";
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
  if (!marketplaceQueryHasMatchBounds(q)) return false;
  const hay = `${v.manufacturer ?? ""} ${v.title ?? ""}`;
  if (q.make && hay.trim() && !includesLoose(hay, q.make)) return false;
  if (q.model && hay.trim() && !includesLoose(hay, q.model)) return false;
  if (!inRange(vehicleYear(v), q.yearFrom, q.yearTo)) return false;
  if (!inRange(v.mileageKm ?? null, q.mileageFrom, q.mileageTo)) return false;
  if (!inRange(vehiclePrice(v), q.priceFrom, q.priceTo)) return false;
  if (!inRange(vehiclePower(v), q.powerFromKw, q.powerToKw)) return false;
  if (!inRange(v.displacementCc ?? null, q.displacementFromCc, q.displacementToCc)) return false;
  if (q.fuel && (v.fuel ?? "").trim() && !fuelsMatchGroups(v.fuel ?? "", marketplaceQueryList(q.fuel))) {
    return false;
  }
  if (q.gearbox && (v.transmission ?? "").trim() && !gearboxesMatchGroups(v.transmission ?? "", marketplaceQueryList(q.gearbox))) {
    return false;
  }
  if (q.body && (v.bodyType ?? "").trim() && !bodiesMatchGroups(`${v.bodyType ?? ""} ${hay}`, marketplaceQueryList(q.body))) {
    return false;
  }
  if (q.drive && ((v.driveType ?? "").trim() || hay.trim()) && !drivesMatchGroups(`${v.driveType ?? ""} ${hay}`, [q.drive])) {
    return false;
  }
  return true;
}

export function marketplaceVehicleMatchesOrder(v: MarketplaceMatchVehicle, order: MarketplaceOrderCriteria): boolean {
  return marketplaceVehicleMatchesQuery(v, marketplaceQueryFromOrder(order));
}
