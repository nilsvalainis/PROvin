/**
 * IRISS LIST (Sludinājumi) v2: viens ieraksts = viens konkrēts auto izsolē, nevis meklēšanas lapa.
 * Avoti nāk tikai no aktīvajiem IRISS pasūtījumiem. Mobile.de šajā fāzē nav.
 */

export type IrissListingPlatform = "autobid" | "openline" | "auto1" | "ecarstrade";

export const IRISS_LISTING_PLATFORMS: readonly IrissListingPlatform[] = ["autobid", "openline", "auto1", "ecarstrade"];

/** Platformas, ko lasa caur Hetzner releju (noVNC login). eCarsTrade iet tieši no Vercel. */
export const IRISS_RELAY_LISTING_PLATFORMS: readonly IrissListingPlatform[] = ["autobid", "openline", "auto1"];

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

export type IrissListingPriceField = "start" | "minimal" | "current" | "buy_now" | "estimate";

export type IrissListingPriceChange = {
  at: string;
  field: IrissListingPriceField;
  from: number | null;
  to: number | null;
};

export type IrissListingVehicleChange = "new" | "price_changed" | "unchanged" | "gone";

export type IrissListingVinOcrStatus = "confirmed" | "unverified" | "conflict" | "miss" | "found";

export const IRISS_LISTING_VIN_OCR_STATUSES: readonly IrissListingVinOcrStatus[] = [
  "confirmed",
  "unverified",
  "conflict",
  "miss",
  "found",
];

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
  /** Auto1 pārdevēja valsts (`sourceCountry`); PVN likmei, ne atrašanās vietai. */
  sourceCountry?: string;
  owningCountry?: string;
  imageUrl: string;
  /** Papildu bildes no avota (Auto1 images[], Autobid imageGroups). */
  imageUrls?: string[];
  /** VIN, ja avots to iedod (Openlane ChassisNumber, Autobid additionalInformation, Auto1 ja ir). */
  vin?: string;
  /** `source` = JSON/lauks; `ocr_photo` = nolasīts no foto. */
  vinSource?: "source" | "ocr_photo";
  vinOcrAt?: string;
  /**
   * OCR krustpārbaude: `confirmed` = 2+ foto vai derīgs check digit (rāda VIN).
   * `miss` = nav ko rādīt. `unverified` / `conflict` / `found` = vecais kešs.
   */
  vinOcrStatus?: IrissListingVinOcrStatus;
  /** Citi ISO 3779 VIN, ja foto nesakrīt. */
  vinOcrAlts?: string[];
  /** Auto1 images[] ar type=DOCUMENT u.c. OCR vispirms šīs. */
  documentImageUrls?: string[];
  color?: string;
  bodyType?: string;
  doorCount?: string;
  isMargin?: boolean | null;
  salesVatType?: number | null;
  taxDeduction?: boolean | null;
  vatRate?: number | null;
  bidCount?: number | null;
  auctionType?: string;
  damageRaw?: string;
  stockNumber?: string;
  currency: string;
  priceStart: number | null;
  priceMinimal: number | null;
  priceCurrent: number | null;
  /** Openlane BuyNowPrice / Auto1 fiksētā cena; Autobid nav. */
  priceBuyNow: number | null;
  /** eCarsTrade Aplēses cena. Nav Kopējā cena. */
  priceEstimate?: number | null;
  /** eCarsTrade Kopējā cena (ar nodevām). Rādīšanai, ne budžeta bāzei. */
  priceTotal?: number | null;
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

/** Operatora ✕ slēpšana nav šajā skatā: sync pārraksta latest.json. Paslēptie auto: `dismissed.json`. */
export type IrissListingsLatestView = {
  version: 2;
  generatedAt: string;
  summary: IrissListingSyncRunSummary;
  sources: IrissListingSourceRun[];
  vehicles: IrissListingVehicle[];
  cursor?: IrissListingsSyncCursor;
  /** Pēdējais automātiskais slots `YYYY-MM-DDTHH` Europe/Riga (09/13/17). Dubultpalaišanas aizsardzība slota sākumam. */
  lastAutomaticSlot?: string;
  vatHealth?: import("@/lib/iriss-listings-vat").ListingVatHealthMap;
};

/** Unikālie meklējumi šajā ciklā: nolasīti / kopā. */
export type IrissListingsSyncProgress = {
  done: number;
  total: number;
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
