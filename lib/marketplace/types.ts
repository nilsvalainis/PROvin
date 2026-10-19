/**
 * Tirgus sludinājumu (mobile.de, AutoScout24) adapteru slānis.
 * Tikai iekšēji / B2B: nav publiska kataloga. Maksas avoti netiek ielādēti automātiski.
 */

export const MARKETPLACE_PLATFORMS = ["mobilede", "autoscout24"] as const;
export type MarketplacePlatform = (typeof MARKETPLACE_PLATFORMS)[number];

export const MARKETPLACE_PROVIDER_IDS = ["apify-mobilede", "apify-autoscout24", "carapis"] as const;
export type MarketplaceProviderId = (typeof MARKETPLACE_PROVIDER_IDS)[number];

export const MARKETPLACE_TTL_DAYS = 30;

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
  countries: string[];
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
};

export type MarketplaceRawListing = {
  externalId?: unknown;
  url?: unknown;
  title?: unknown;
  make?: unknown;
  model?: unknown;
  year?: unknown;
  firstReg?: unknown;
  mileageKm?: unknown;
  price?: unknown;
  priceEur?: unknown;
  fuel?: unknown;
  gearbox?: unknown;
  transmission?: unknown;
  powerKw?: unknown;
  power?: unknown;
  body?: unknown;
  country?: unknown;
  countryCode?: unknown;
  location?: unknown;
  city?: unknown;
  vin?: unknown;
  /** Atļauts adapterim, bet normalizācija šos laukus izmet. */
  description?: unknown;
  images?: unknown;
  imageUrl?: unknown;
  sellerPhone?: unknown;
  sellerEmail?: unknown;
  sellerName?: unknown;
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
  providers: MarketplaceProviderId[];
  query: MarketplaceQuery;
  maxItems: number;
  maxUsd: number;
  estimatedUsd: number;
  chargedUsd: number;
  itemCount: number;
  keptCount: number;
  rejectedCount: number;
  startedAt: string;
  finishedAt: string;
  status: "ok" | "partial" | "blocked" | "failed";
  note: string;
};

export type MarketplaceUsageEntry = {
  runId: string;
  orderId: string;
  providerId: MarketplaceProviderId;
  items: number;
  usd: number;
  at: string;
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
  run?: MarketplaceRunRecord;
  added: number;
  grouped: number;
  estimatedUsd: number;
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
  search(query: MarketplaceQuery, limits: MarketplaceLimits): Promise<MarketplaceRawListing[]>;
}

export function isMarketplacePlatform(v: string): v is MarketplacePlatform {
  return (MARKETPLACE_PLATFORMS as readonly string[]).includes(v);
}

export function isMarketplaceProviderId(v: string): v is MarketplaceProviderId {
  return (MARKETPLACE_PROVIDER_IDS as readonly string[]).includes(v);
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
    countries: [],
  };
}

export function emptyMarketplaceListingsState(): MarketplaceListingsState {
  return { version: 1, updatedAt: "", items: [], runs: [] };
}

export function marketplaceQueryHasBounds(q: MarketplaceQuery): boolean {
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
      q.powerToKw != null,
  );
}
