/**
 * Tirgus sludinājumu (mobile.de, AutoScout24) adapteru slānis.
 * Tikai iekšēji / B2B: nav publiska kataloga.
 * Manuālā poga Ielādēt paliek. Automātiskā ielāde: cron ik pa dažām dienām ar atsevišķu auto budžetu.
 */

export const MARKETPLACE_PLATFORMS = ["mobilede", "autoscout24"] as const;
export type MarketplacePlatform = (typeof MARKETPLACE_PLATFORMS)[number];

export const MARKETPLACE_PROVIDER_IDS = ["apify-mobilede", "apify-autoscout24", "carapis"] as const;
export type MarketplaceProviderId = (typeof MARKETPLACE_PROVIDER_IDS)[number];

export const MARKETPLACE_TTL_DAYS = 30;

export const MARKETPLACE_VEHICLE_CATEGORIES = ["car", "van"] as const;
export type MarketplaceVehicleCategory = (typeof MARKETPLACE_VEHICLE_CATEGORIES)[number];

export const MARKETPLACE_OWNER_KINDS = ["order", "radar"] as const;
export type MarketplaceOwnerKind = (typeof MARKETPLACE_OWNER_KINDS)[number];

export type MarketplaceQuery = {
  make: string;
  model: string;
  yearFrom: number | null;
  yearTo: number | null;
  mileageFrom: number | null;
  mileageTo: number | null;
  priceFrom: number | null;
  priceTo: number | null;
  fuel: string;
  gearbox: string;
  powerFromKw: number | null;
  powerToKw: number | null;
  displacementFromCc: number | null;
  displacementToCc: number | null;
  body: string;
  drive: string;
  countries: string[];
  /** car = PKW; van = furgons / transporteris (mobile.de vc=Van, AutoScout24 atype=X). */
  vehicleCategory: MarketplaceVehicleCategory;
  /** Piem. air_conditioning. Nobraukums vienmēr km, ne jūdzes. */
  features: string[];
};

export type MarketplaceCostEstimate = {
  providerId: MarketplaceProviderId;
  platform: MarketplacePlatform;
  maxItems: number;
  maxUsd: number;
  usdPerThousand: number;
  configured: boolean;
  reason?: string;
};

export type MarketplaceLimits = {
  maxItems: number;
  maxUsd: number;
  /** Pēc pirmās ielādes: lūgt actoram jaunākos sludinājumus. */
  sortNewest?: boolean;
};

export type MarketplaceLoadTrigger = "manual" | "auto";

export type MarketplaceSearchResult = {
  items: MarketplaceRawListing[];
  chargedUsd: number;
  error?: string;
  apifyRunId?: string;
};

export type MarketplaceRawListing = {
  externalId?: unknown;
  listingKey?: unknown;
  listingId?: unknown;
  url?: unknown;
  canonicalUrl?: unknown;
  sourceUrl?: unknown;
  title?: unknown;
  subTitle?: unknown;
  subtitle?: unknown;
  headline?: unknown;
  makeModelDescription?: unknown;
  make?: unknown;
  model?: unknown;
  year?: unknown;
  firstReg?: unknown;
  firstRegistration?: unknown;
  mileageKm?: unknown;
  price?: unknown;
  priceEur?: unknown;
  fuel?: unknown;
  fuelType?: unknown;
  gearbox?: unknown;
  transmission?: unknown;
  powerKw?: unknown;
  power?: unknown;
  body?: unknown;
  country?: unknown;
  countryCode?: unknown;
  sellerCountry?: unknown;
  location?: unknown;
  city?: unknown;
  vin?: unknown;
  /** Actor output (Dealer / Private Seller). Normalizācija privātos izmet. */
  sellerType?: unknown;
  /** Dīlera nosaukums ir atļauts. Tālruni / e-pastu normalizācija izmet. */
  sellerName?: unknown;
  /** Atļauts adapterim, bet normalizācija šos laukus izmet. */
  description?: unknown;
  images?: unknown;
  imageUrl?: unknown;
  sellerPhone?: unknown;
  sellerEmail?: unknown;
};

export type MarketplaceSourceLink = {
  platform: MarketplacePlatform;
  url: string;
};

/**
 * Saglabājamie lauki. Nav fotogrāfiju, pilna teksta, pārdevēja kontaktu.
 */
export type MarketplaceNormalizedListing = {
  platform: MarketplacePlatform;
  providerId: MarketplaceProviderId;
  externalId: string;
  listingUrl: string;
  title: string;
  make: string;
  model: string;
  year: string;
  mileageKm: number | null;
  priceEur: number | null;
  fuel: string;
  gearbox: string;
  powerKw: string;
  locationCountry: string;
  fetchedAt: string;
  vin?: string;
  sellerName?: string;
  location?: string;
  sourceLinks?: MarketplaceSourceLink[];
};

export type MarketplacePriceCompare = {
  sampleSize: number;
  medianEur: number | null;
  p25Eur: number | null;
  p75Eur: number | null;
  deltaPct: number | null;
  note: string;
};

export type MarketplaceStoredListing = MarketplaceNormalizedListing & {
  id: string;
  orderId: string;
  tenantScope: "iriss";
  groupId: string;
  priceCompare: MarketplacePriceCompare;
  expiresAt: string;
};

export type MarketplaceRunRecord = {
  id: string;
  orderId: string;
  tenantScope: "iriss";
  ownerKind?: MarketplaceOwnerKind;
  providers: MarketplaceProviderId[];
  query: MarketplaceQuery;
  maxItems: number;
  maxUsd: number;
  estimatedUsd: number;
  chargedUsd: number;
  monthUsd?: number;
  itemCount: number;
  keptCount: number;
  rejectedCount: number;
  startedAt: string;
  finishedAt: string;
  status: "ok" | "partial" | "blocked" | "failed";
  trigger: MarketplaceLoadTrigger;
  note: string;
  apifyRunIds: string[];
};

export type MarketplaceUsageEntry = {
  runId: string;
  orderId: string;
  providerId: MarketplaceProviderId;
  items: number;
  usd: number;
  monthUsd?: number;
  at: string;
  trigger: MarketplaceLoadTrigger;
};

export type MarketplaceAutoCronStatus = "ok" | "skipped" | "budžets sasniegts" | "failed";

export type MarketplaceAutoSkip = {
  orderId: string;
  reason: string;
};

export type MarketplaceAutoCronState = {
  version: 1;
  updatedAt: string;
  lastStartedAt: string;
  lastFinishedAt: string;
  status: MarketplaceAutoCronStatus;
  reason: string;
  loadedOrderIds: string[];
  skipped: MarketplaceAutoSkip[];
  loadedCount: number;
  skippedCount: number;
  estimatedUsd: number;
  chargedUsd: number;
};

export type MarketplaceUsageMonth = {
  version: 1;
  month: string;
  capUsd: number;
  entries: MarketplaceUsageEntry[];
};

export type MarketplaceListingsState = {
  version: 1;
  updatedAt: string;
  items: MarketplaceStoredListing[];
  runs: MarketplaceRunRecord[];
};

export type MarketplaceLoadResult = {
  ok: boolean;
  blocked?: boolean;
  error?: string;
  missingFields?: string[];
  needsOneOfExtra?: boolean;
  run?: MarketplaceRunRecord;
  added: number;
  grouped: number;
  estimatedUsd: number;
  chargedUsd?: number;
  monthlyUsedUsd?: number;
  remainingMonthlyUsd: number;
};

export interface ListingProvider {
  id: MarketplaceProviderId;
  platform: MarketplacePlatform;
  label: string;
  usdPerThousand: number;
  isConfigured(): boolean;
  buildQuery(criteria: MarketplaceQuery): Record<string, unknown>;
  estimateCost(query: MarketplaceQuery, maxItems: number): MarketplaceCostEstimate;
  search(query: MarketplaceQuery, limits: MarketplaceLimits): Promise<MarketplaceSearchResult>;
}

export function isMarketplacePlatform(v: string): v is MarketplacePlatform {
  return (MARKETPLACE_PLATFORMS as readonly string[]).includes(v);
}

export function isMarketplaceProviderId(v: string): v is MarketplaceProviderId {
  return (MARKETPLACE_PROVIDER_IDS as readonly string[]).includes(v);
}

export function isMarketplaceVehicleCategory(v: string): v is MarketplaceVehicleCategory {
  return (MARKETPLACE_VEHICLE_CATEGORIES as readonly string[]).includes(v);
}

export function isMarketplaceOwnerKind(v: string): v is MarketplaceOwnerKind {
  return (MARKETPLACE_OWNER_KINDS as readonly string[]).includes(v);
}

export function emptyMarketplaceQuery(): MarketplaceQuery {
  return {
    make: "",
    model: "",
    yearFrom: null,
    yearTo: null,
    mileageFrom: null,
    mileageTo: null,
    priceFrom: null,
    priceTo: null,
    fuel: "",
    gearbox: "",
    powerFromKw: null,
    powerToKw: null,
    displacementFromCc: null,
    displacementToCc: null,
    body: "",
    drive: "",
    countries: [],
    vehicleCategory: "car",
    features: [],
  };
}

export function emptyMarketplaceListingsState(): MarketplaceListingsState {
  return { version: 1, updatedAt: "", items: [], runs: [] };
}

export function emptyMarketplaceAutoCronState(): MarketplaceAutoCronState {
  return {
    version: 1,
    updatedAt: "",
    lastStartedAt: "",
    lastFinishedAt: "",
    status: "skipped",
    reason: "",
    loadedOrderIds: [],
    skipped: [],
    loadedCount: 0,
    skippedCount: 0,
    estimatedUsd: 0,
    chargedUsd: 0,
  };
}

export const MARKETPLACE_TOO_BROAD_ERROR = "par plāši kritēriji";

function rangeOk(from: number | null, to: number | null, both: boolean): boolean {
  if (both) {
    if (from == null || to == null) return false;
    return from <= to;
  }
  if (from != null && to != null && from > to) return false;
  return to != null;
}

/**
 * Stingrie vārti: marka + modelis + cena no-līdz + gadi no-līdz
 * un vismaz viens no: nobraukums līdz, tilpums, jauda.
 */
export function marketplaceQueryHasStrictBounds(q: MarketplaceQuery): boolean {
  if (!q.make.trim() || !q.model.trim()) return false;
  if (!rangeOk(q.priceFrom, q.priceTo, true)) return false;
  if (!rangeOk(q.yearFrom, q.yearTo, true)) return false;
  const mileage = rangeOk(q.mileageFrom, q.mileageTo, false);
  const cc = rangeOk(q.displacementFromCc, q.displacementToCc, true);
  const power = rangeOk(q.powerFromKw, q.powerToKw, true);
  return mileage || cc || power;
}

function radarOpenRangeOk(from: number | null, to: number | null, need: "from" | "to"): boolean {
  if (from != null && to != null && from > to) return false;
  return need === "from" ? from != null : to != null;
}

/** Extra: nobraukums līdz (km), tilpums līdz / no-līdz, vai jauda no / no-līdz. Bez cenas. */
export function marketplaceQueryHasRadarExtraRange(q: MarketplaceQuery): boolean {
  const mileage = radarOpenRangeOk(q.mileageFrom, q.mileageTo, "to");
  const cc = radarOpenRangeOk(q.displacementFromCc, q.displacementToCc, "to");
  const power = radarOpenRangeOk(q.powerFromKw, q.powerToKw, "from");
  return mileage || cc || power;
}

/**
 * Radars: marka + modelis + gadi no-līdz, bez cenas.
 * Extra: nobraukums līdz (km), tilpums līdz / no-līdz, vai jauda no / no-līdz.
 */
export function marketplaceQueryHasRadarBounds(q: MarketplaceQuery): boolean {
  if (!q.make.trim() || !q.model.trim()) return false;
  if (!rangeOk(q.yearFrom, q.yearTo, true)) return false;
  return marketplaceQueryHasRadarExtraRange(q);
}

export function marketplaceQueryHasBounds(q: MarketplaceQuery): boolean {
  return marketplaceQueryHasStrictBounds(q);
}

/** Match pēc ielādes: pietiek ar jebkuru aizpildītu filtru. Ielādes vārti paliek stingri. */
export function marketplaceQueryHasMatchBounds(q: MarketplaceQuery): boolean {
  return Boolean(
    q.make.trim() ||
      q.model.trim() ||
      q.yearFrom != null ||
      q.yearTo != null ||
      q.mileageFrom != null ||
      q.mileageTo != null ||
      q.priceFrom != null ||
      q.priceTo != null ||
      q.fuel.trim() ||
      q.gearbox.trim() ||
      q.powerFromKw != null ||
      q.powerToKw != null ||
      q.displacementFromCc != null ||
      q.displacementToCc != null ||
      q.body.trim() ||
      q.drive.trim(),
  );
}
