/**
 * IRISS LIST (Sludinājumi) v2: viens ieraksts = viens konkrēts auto izsolē, nevis meklēšanas lapa.
 * Avoti nāk tikai no aktīvajiem IRISS pasūtījumiem. Mobile.de šajā fāzē nav.
 */

export type IrissListingPlatform = "autobid" | "openline" | "auto1";

export const IRISS_LISTING_PLATFORMS: readonly IrissListingPlatform[] = ["autobid", "openline", "auto1"];

/** Viena meklēšanas URL nolasīšanas iznākums. */
export type IrissListingSourceStatus =
  | "ok"
  | "login_required"
  | "blocked_by_waf"
  | "parse_failed"
  | "fetch_failed"
  /** Openlane / Auto1: lasīšana notiek caur Hetzner releju (Fāze 1), kas vēl nav konfigurēts. */
  | "relay_not_configured"
  /** Laika budžets beidzās, avots šajā reizē netika lasīts. */
  | "skipped";

export type IrissListingSourceRun = {
  id: string;
  orderId: string;
  orderBrandModel: string;
  platform: IrissListingPlatform;
  sourceUrl: string;
  status: IrissListingSourceStatus;
  note: string;
  vehicleCount: number;
  pagesFetched: number;
  pageCount: number;
  fetchedAt: string;
};

export type IrissListingPriceField = "start" | "minimal" | "current" | "buy_now";

export type IrissListingPriceChange = {
  at: string;
  field: IrissListingPriceField;
  from: number | null;
  to: number | null;
};

export type IrissListingVehicleChange = "new" | "price_changed" | "unchanged" | "gone";

export type IrissListingVehicle = {
  /** sha1(platform|externalId), stabils starp nolasījumiem. */
  id: string;
  platform: IrissListingPlatform;
  externalId: string;
  detailUrl: string;
  /** Viens auto var atbilst vairāku pasūtījumu meklējumiem. */
  orderIds: string[];
  orderBrandModels: string[];
  title: string;
  manufacturer: string;
  year: string;
  firstRegistration: string;
  mileageKm: number | null;
  fuel: string;
  transmission: string;
  powerKw: string;
  location: string;
  countryCode: string;
  imageUrl: string;
  currency: string;
  priceStart: number | null;
  priceMinimal: number | null;
  priceCurrent: number | null;
  /** Openlane BuyNowPrice / Auto1 fiksētā cena; Autobid nav. */
  priceBuyNow: number | null;
  vatNote: string;
  auctionId: string;
  auctionStartAt: string;
  /** Openlane BatchEndDate / Auto1 beigu laiks; tukšs, ja platforma nedod. */
  auctionEndAt: string;
  auctionStage: string;
  firstSeenAt: string;
  lastSeenAt: string;
  /** Cik veiksmīgos nolasījumos pēc kārtas auto vairs nav sarakstā. Pazudis tikai no 2. */
  missingRuns: number;
  change: IrissListingVehicleChange;
  priceHistory: IrissListingPriceChange[];
};

export type IrissListingSyncRunSummary = {
  startedAt: string;
  finishedAt: string;
  runId: string;
  totalSources: number;
  okCount: number;
  loginRequiredCount: number;
  blockedByWafCount: number;
  parseFailedCount: number;
  fetchFailedCount: number;
  relayNotConfiguredCount: number;
  skippedCount: number;
  vehicleCount: number;
  newCount: number;
  priceChangedCount: number;
  goneCount: number;
};

/** Unikālie meklējumi, kas šajā UTC dienā jau nolasīti. Nākamā palaišana turpina, nevis sāk no sākuma. */
export type IrissListingsSyncCursor = {
  day: string;
  doneKeys: string[];
};

export type IrissListingsLatestView = {
  version: 2;
  generatedAt: string;
  summary: IrissListingSyncRunSummary;
  sources: IrissListingSourceRun[];
  vehicles: IrissListingVehicle[];
  cursor?: IrissListingsSyncCursor;
};

export type IrissListingsSnapshot = IrissListingsLatestView;

/** Neapstrādātie `__NUXT_DATA__` u.c. izejas dati vienai palaišanai: ātrai labošanai, ja vietne maina struktūru. */
export type IrissListingsRawBundle = {
  version: 1;
  runId: string;
  generatedAt: string;
  sources: Array<{ platform: IrissListingPlatform; sourceUrl: string; pages: string[] }>;
};

export type IrissListingsStorageState =
  | { enabled: false; reason: "explicit_off" | "vercel_blob_token_missing" }
  | { enabled: true; persistence: "filesystem"; path: string }
  | { enabled: true; persistence: "vercel_blob" };

export type IrissPlatformHealthStatus =
  | "ok"
  | "stale"
  | "login_required"
  | "blocked_by_waf"
  | "relay_not_configured"
  | "no_sources"
  | "failed"
  | "not_run";

export type IrissPlatformHealthItem = {
  platform: IrissListingPlatform;
  status: IrissPlatformHealthStatus;
  note: string;
  checkedAt: string;
};

export type IrissPlatformHealthReport = {
  checkedAt: string;
  items: IrissPlatformHealthItem[];
  relayReachable: boolean;
  loginOpen: { platform: IrissListingPlatform; startedAt: string } | null;
};
