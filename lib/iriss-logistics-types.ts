/** IRISS Loģistika datu modelis. Loma (`iriss.logistics`) tiek pievienota atsevišķā PR. */

export const IRISS_LOGISTICS_WORKSPACE = "iriss" as const;
export const IRISS_LOGISTICS_ACCESS_SCOPE = "iriss.logistics" as const;

export const LOGISTICS_AUCTIONS = ["Autobid", "Auto1", "Openlane", "BCA", "cits"] as const;
export type LogisticsAuction = (typeof LOGISTICS_AUCTIONS)[number];

export const LOGISTICS_ORDER_SOURCES = ["auction", "private"] as const;
export type LogisticsOrderSource = (typeof LOGISTICS_ORDER_SOURCES)[number];

export const LOGISTICS_ORDER_STATUSES = [
  "awaiting_payment",
  "organize_pickup",
  "waiting_transport",
  "scheduled",
  "ready",
  "picked_up",
  "delivered",
  "archived",
] as const;
export type LogisticsOrderStatus = (typeof LOGISTICS_ORDER_STATUSES)[number];

/** Izņemti / piegādāti / arhivēti - nav aktīvajā sarakstā. */
export const LOGISTICS_ARCHIVED_STATUSES = ["picked_up", "delivered", "archived"] as const;
export type LogisticsArchivedStatus = (typeof LOGISTICS_ARCHIVED_STATUSES)[number];

export const LOGISTICS_GEOCODE_STATUSES = ["ok", "neprecizs", "manuali", "pending", "failed"] as const;
export type LogisticsGeocodeStatus = (typeof LOGISTICS_GEOCODE_STATUSES)[number];

export const LOGISTICS_LIST_VIEWS = ["active", "today", "due", "trips", "archive"] as const;
export type LogisticsListView = (typeof LOGISTICS_LIST_VIEWS)[number];

/** Pirmais skats: tikai vēl neizņemtie / nepiegādātie. */
export const LOGISTICS_DEFAULT_LIST_VIEW: LogisticsListView = "active";

export const LOGISTICS_PAGE_VIEWS = ["orders", "points", "settings"] as const;
export type LogisticsPageView = (typeof LOGISTICS_PAGE_VIEWS)[number];

/** Izsoļu avoti Loģistikas iestatījumos. Jaunus var pievienot bez koda. */
export type LogisticsAuctionSourceFilters = {
  account: string;
  status: string;
  keywords: string;
};

export type LogisticsAuctionSource = {
  id: string;
  name: string;
  url: string;
  filters: LogisticsAuctionSourceFilters;
  enabled: boolean;
  builtin: boolean;
  createdAt: string;
  updatedAt: string;
};

export type LogisticsHoursSlot = {
  days: string;
  from?: string;
  to?: string;
};

export type LogisticsParkingRule = {
  freeDays: number | null;
  adminFee: number | null;
  perDay: number | null;
  starts: string;
};

export type LogisticsPoint = {
  id: string;
  workspace: typeof IRISS_LOGISTICS_WORKSPACE;
  auction: LogisticsAuction;
  name: string;
  street: string;
  postcode: string;
  city: string;
  country: string;
  lat: number | null;
  lng: number | null;
  hours: LogisticsHoursSlot[];
  hoursText: string;
  contactName: string;
  phone: string;
  email: string;
  parkingRule: LogisticsParkingRule | null;
  rules: string;
  requiredDocs: string[];
  notes: string;
  pickupCodes: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
};

export type LogisticsListingParsed = {
  make: string;
  model: string;
  vin: string;
  priceEur: number | null;
  mileageKm: number | null;
  address: string;
  source: string;
  parsedAt: string;
};

export type LogisticsPickupSnapshot = {
  name: string;
  auction: LogisticsAuction;
  street: string;
  postcode: string;
  city: string;
  country: string;
  lat: number | null;
  lng: number | null;
  hoursText: string;
  contactName: string;
  phone: string;
  email: string;
  parkingRule: LogisticsParkingRule | null;
  rules: string;
};

export type LogisticsOrder = {
  id: string;
  workspace: typeof IRISS_LOGISTICS_WORKSPACE;
  source: LogisticsOrderSource;
  auction: LogisticsAuction | "";
  auctionUrl: string;
  listingUrl: string;
  listingParsed: LogisticsListingParsed | null;
  make: string;
  model: string;
  vin: string;
  title: string;
  priceEur: number | null;
  mileageKm: number | null;
  pickupPointId: string;
  pickupSnapshot: LogisticsPickupSnapshot | null;
  pickupRef: string;
  pickupAddress: string;
  pickupLat: number | null;
  pickupLng: number | null;
  geocodeStatus: LogisticsGeocodeStatus;
  pickupDate: string;
  status: LogisticsOrderStatus;
  archived: boolean;
  archivedAt: string;
  previousStatus: LogisticsOrderStatus | "";
  statusNote: string;
  nextAction: string;
  sellerContact: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type LogisticsGeocodeCacheEntry = {
  query: string;
  lat: number;
  lng: number;
  formatted: string;
  precision: "rooftop" | "street" | "city" | "region" | "unknown";
  status: Exclude<LogisticsGeocodeStatus, "pending" | "failed">;
  cachedAt: string;
};

export const LOGISTICS_MAPS_APIS = ["maps_js", "geocoding"] as const;
export type LogisticsMapsApi = (typeof LOGISTICS_MAPS_APIS)[number];

export type LogisticsMapsUsageMonth = {
  version: 1;
  month: string;
  mapsJs: number;
  geocoding: number;
  days: Record<string, { mapsJs: number; geocoding: number }>;
};

export type LogisticsPreviousPointRow = {
  pointId: string;
  name: string;
  auction: LogisticsAuction;
  city: string;
  lat: number | null;
  lng: number | null;
  useCount: number;
  lastPickupDate: string;
};

export const LOGISTICS_ORDER_STATUS_LV: Record<LogisticsOrderStatus, string> = {
  awaiting_payment: "Gaida apmaksu",
  organize_pickup: "Jāorganizē savākšana",
  waiting_transport: "Gaida pārvešanu",
  scheduled: "Savākšana plānota",
  ready: "Gatavs izsniegšanai",
  picked_up: "Izņemts",
  delivered: "Piegādāts",
  archived: "Arhīvs",
};

export const LOGISTICS_LIST_VIEW_LV: Record<LogisticsListView, string> = {
  today: "Šodien jādara",
  due: "Termiņš tuvu",
  active: "Visi aktīvie",
  trips: "Reisi",
  archive: "Arhīvs",
};

export function isLogisticsAuction(v: unknown): v is LogisticsAuction {
  return typeof v === "string" && (LOGISTICS_AUCTIONS as readonly string[]).includes(v);
}

export function isLogisticsOrderStatus(v: unknown): v is LogisticsOrderStatus {
  return typeof v === "string" && (LOGISTICS_ORDER_STATUSES as readonly string[]).includes(v);
}

export function isLogisticsArchivedStatus(v: unknown): v is LogisticsArchivedStatus {
  return typeof v === "string" && (LOGISTICS_ARCHIVED_STATUSES as readonly string[]).includes(v);
}

export function isLogisticsListView(v: unknown): v is LogisticsListView {
  return typeof v === "string" && (LOGISTICS_LIST_VIEWS as readonly string[]).includes(v);
}

export function snapshotLogisticsPoint(point: LogisticsPoint): LogisticsPickupSnapshot {
  return {
    name: point.name,
    auction: point.auction,
    street: point.street,
    postcode: point.postcode,
    city: point.city,
    country: point.country,
    lat: point.lat,
    lng: point.lng,
    hoursText: point.hoursText,
    contactName: point.contactName,
    phone: point.phone,
    email: point.email,
    parkingRule: point.parkingRule,
    rules: point.rules,
  };
}

export function formatLogisticsAddress(row: {
  street?: string;
  postcode?: string;
  city?: string;
  country?: string;
}): string {
  const street = (row.street ?? "").trim();
  const cityLine = [row.postcode, row.city].map((x) => (x ?? "").trim()).filter(Boolean).join(" ");
  const country = (row.country ?? "").trim();
  return [street, cityLine, country].filter(Boolean).join(", ");
}

export function formatLogisticsKm(km: number | null | undefined): string {
  if (km == null || !Number.isFinite(km) || km < 0) return "";
  const n = Math.round(km);
  return `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} km`;
}

export function formatLogisticsEur(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "";
  return `${n.toFixed(2).replace(".", ",")} €`;
}

export function formatLogisticsDate(iso: string): string {
  const m = iso.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  return `${m[3]}.${m[2]}.${m[1]}`;
}
