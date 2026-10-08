/**
 * IRISS LIST operatora iestatījumi pārlūkā.
 * localStorage: tikai mazi UI lauki (filtri, kārtošana, izmaksas, budžets, ID, piezīmes).
 * Pilni auto dati, raw, foto un vēsture paliek servera Blob (vai IndexedDB, ja kādreiz vajadzēs kešu).
 */

import { DEFAULT_LISTING_COSTS, type ListingCostParts, type ListingTaxKind } from "@/lib/iriss-listings-cost";
import {
  LISTING_SORT_STORAGE_KEY,
  parseListingSort,
  parseListingSources,
  parsePriceBound,
  type ListingSort,
} from "@/lib/iriss-listings-list-view";
import { parseListingOrderFilter, serializeListingOrderFilter } from "@/lib/iriss-listings-orders";
import type { IrissListingPlatform } from "@/lib/iriss-listings-types";

export const IRISS_LIST_PREFS_KEY = "provin-iriss-list-v4";
export const IRISS_LIST_PREFS_MAX_BYTES = 100_000;
export const IRISS_LIST_LEGACY_PREFS_KEYS = ["provin-iriss-list-v1", "provin-iriss-list-v2", "provin-iriss-list-v3"] as const;

const TAX_KINDS = new Set<ListingTaxKind>(["net", "margin", "gross", "unknown"]);
const TABS = new Set(["new", "price", "all", "gone"]);
const SCOPES = new Set(["all", "fav", "hidden"]);
const BANNED_ROOT_KEYS = [
  "vehicles",
  "photos",
  "imageUrls",
  "imageUrl",
  "raw",
  "history",
  "priceHistory",
  "latest",
  "snapshot",
  "listings",
  "view",
  "generatedAt",
  "summary",
  "damageRaw",
] as const;

export type ListingTaxOverride = { kind: ListingTaxKind; rate?: number | null };
export type IrissListTab = "new" | "price" | "all" | "gone";
export type IrissListScope = "all" | "fav" | "hidden";

export type IrissListPrefs = {
  budget: number | null;
  costs: ListingCostParts;
  fav: string[];
  hidden: string[];
  notes: Record<string, string>;
  taxOv: Record<string, ListingTaxOverride>;
  costOv: Record<string, Partial<ListingCostParts>>;
  damageLv: Record<string, string>;
  sort: ListingSort | null;
  sources: IrissListingPlatform[];
  priceMin: number | null;
  priceMax: number | null;
  hideTech: boolean;
  tab: IrissListTab;
  listScope: IrissListScope;
  /** Auto id -> pasūtījumu id (pārraksta meklēšanas URL piesaisti). */
  orderOv: Record<string, string[]>;
  /** `o:<id>` / `c:<vārds>` / tukšs = visi. */
  orderFilter: string;
};

export type IrissListStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function defaultIrissListPrefs(): IrissListPrefs {
  return {
    budget: null,
    costs: { ...DEFAULT_LISTING_COSTS },
    fav: [],
    hidden: [],
    notes: {},
    taxOv: {},
    costOv: {},
    damageLv: {},
    sort: null,
    sources: [],
    priceMin: null,
    priceMax: null,
    hideTech: false,
    tab: "all",
    listScope: "all",
    orderOv: {},
    orderFilter: "",
  };
}

export function storageStringBytes(raw: string): number {
  return new TextEncoder().encode(raw).length;
}

export function isStorageQuotaError(e: unknown): boolean {
  if (!(e instanceof DOMException)) return false;
  return e.code === 22 || e.code === 1014 || e.name === "QuotaExceededError";
}

export function irissListBrowserStorage(): IrissListStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function safeStorageGet(storage: IrissListStorage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

export function safeStorageRemove(storage: IrissListStorage, key: string): void {
  try {
    storage.removeItem(key);
  } catch {
    /* private mode / quota */
  }
}

/** setItem ar QuotaExceeded: notīra atslēgu, mēģina vēlreiz, nekad nemet. */
export function safeStorageSet(storage: IrissListStorage, key: string, value: string): boolean {
  try {
    storage.setItem(key, value);
    return true;
  } catch (e) {
    if (!isStorageQuotaError(e)) return false;
    try {
      storage.removeItem(key);
      storage.setItem(key, value);
      return true;
    } catch {
      safeStorageRemove(storage, key);
      return false;
    }
  }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function idList(v: unknown, max = 2000): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of v) {
    if (typeof x !== "string" || !x || seen.has(x)) continue;
    seen.add(x);
    out.push(x.slice(0, 160));
    if (out.length >= max) break;
  }
  return out;
}

function stringMap(v: unknown, maxVal = 2000, maxEntries = 2000): Record<string, string> {
  if (!isPlainObject(v)) return {};
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v)) {
    if (typeof val !== "string" || !k) continue;
    out[k.slice(0, 160)] = val.slice(0, maxVal);
    if (Object.keys(out).length >= maxEntries) break;
  }
  return out;
}

function parseTab(v: unknown): IrissListTab {
  return typeof v === "string" && TABS.has(v) ? (v as IrissListTab) : "all";
}

function parseScope(v: unknown): IrissListScope {
  return typeof v === "string" && SCOPES.has(v) ? (v as IrissListScope) : "all";
}

function parseTaxOv(v: unknown): Record<string, ListingTaxOverride> {
  if (!isPlainObject(v)) return {};
  const out: Record<string, ListingTaxOverride> = {};
  for (const [k, raw] of Object.entries(v)) {
    if (!isPlainObject(raw) || typeof raw.kind !== "string" || !TAX_KINDS.has(raw.kind as ListingTaxKind)) continue;
    const rate = raw.rate;
    out[k.slice(0, 160)] = {
      kind: raw.kind as ListingTaxKind,
      rate: typeof rate === "number" && Number.isFinite(rate) ? rate : rate === null ? null : undefined,
    };
  }
  return out;
}

function parseCostOv(v: unknown): Record<string, Partial<ListingCostParts>> {
  if (!isPlainObject(v)) return {};
  const out: Record<string, Partial<ListingCostParts>> = {};
  for (const [k, raw] of Object.entries(v)) {
    if (!isPlainObject(raw)) continue;
    const part: Partial<ListingCostParts> = {};
    for (const field of ["fee", "transport", "commission", "unplanned"] as const) {
      const n = raw[field];
      if (typeof n === "number" && Number.isFinite(n)) part[field] = n;
    }
    if (Object.keys(part).length > 0) out[k.slice(0, 160)] = part;
  }
  return out;
}

function parseUiSources(v: unknown): IrissListingPlatform[] {
  if (Array.isArray(v)) {
    if (v.some((x) => x && typeof x === "object")) return [];
    return parseListingSources(v.filter((x): x is string => typeof x === "string").join(","));
  }
  if (typeof v === "string") return parseListingSources(v);
  return [];
}

function parseOrderOv(v: unknown, maxIds = 20, maxEntries = 2000): Record<string, string[]> {
  if (!isPlainObject(v)) return {};
  const out: Record<string, string[]> = {};
  for (const [k, val] of Object.entries(v)) {
    if (!k) continue;
    const ids = idList(val, maxIds);
    if (ids.length === 0) continue;
    out[k.slice(0, 160)] = ids;
    if (Object.keys(out).length >= maxEntries) break;
  }
  return out;
}

function parseOrderFilter(v: unknown): string {
  if (typeof v !== "string") return "";
  return serializeListingOrderFilter(parseListingOrderFilter(v));
}

/** Vecais formāts vai > ~100 KB: jādzēš un jāpārnes tikai iestatījumi. */
export function isLegacyOrBloatedIrissListPrefs(raw: string | null | undefined): boolean {
  if (!raw) return false;
  if (storageStringBytes(raw) > IRISS_LIST_PREFS_MAX_BYTES) return true;
  try {
    const o = JSON.parse(raw) as unknown;
    if (!isPlainObject(o)) return true;
    for (const k of BANNED_ROOT_KEYS) {
      if (k in o) return true;
    }
    if (Array.isArray(o.sources) && o.sources.some((s) => s && typeof s === "object")) return true;
    return false;
  } catch {
    return true;
  }
}

export function parseIrissListPrefs(raw: string | null): IrissListPrefs {
  const base = defaultIrissListPrefs();
  if (!raw) return base;
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    if (!isPlainObject(o)) return base;
    const n = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
    const costs = isPlainObject(o.costs) ? o.costs : {};
    return {
      budget: typeof o.budget === "number" && o.budget > 0 ? o.budget : null,
      costs: {
        fee: n(costs.fee, base.costs.fee),
        transport: n(costs.transport, base.costs.transport),
        commission: n(costs.commission, base.costs.commission),
        unplanned: n(costs.unplanned, base.costs.unplanned),
      },
      fav: idList(o.fav),
      hidden: idList(o.hidden),
      notes: stringMap(o.notes, 2000),
      taxOv: parseTaxOv(o.taxOv),
      costOv: parseCostOv(o.costOv),
      damageLv: stringMap(o.damageLv, 4000),
      sort: parseListingSort(typeof o.sort === "string" ? o.sort : null),
      sources: parseUiSources(o.sources),
      priceMin: typeof o.priceMin === "number" ? parsePriceBound(String(o.priceMin)) : parsePriceBound(typeof o.priceMin === "string" ? o.priceMin : null),
      priceMax: typeof o.priceMax === "number" ? parsePriceBound(String(o.priceMax)) : parsePriceBound(typeof o.priceMax === "string" ? o.priceMax : null),
      hideTech: o.hideTech === true,
      tab: parseTab(o.tab),
      listScope: parseScope(o.listScope),
      orderOv: parseOrderOv(o.orderOv),
      orderFilter: parseOrderFilter(o.orderFilter),
    };
  } catch {
    return base;
  }
}

function slimForPersist(prefs: IrissListPrefs): IrissListPrefs {
  const parsed = parseIrissListPrefs(JSON.stringify(prefs));
  return parsed;
}

export function serializeIrissListPrefs(prefs: IrissListPrefs): string {
  let slim = slimForPersist(prefs);
  let json = JSON.stringify(slim);
  if (storageStringBytes(json) <= IRISS_LIST_PREFS_MAX_BYTES) return json;
  slim = { ...slim, damageLv: {} };
  json = JSON.stringify(slim);
  if (storageStringBytes(json) <= IRISS_LIST_PREFS_MAX_BYTES) return json;
  slim = { ...slim, notes: {} };
  json = JSON.stringify(slim);
  if (storageStringBytes(json) <= IRISS_LIST_PREFS_MAX_BYTES) return json;
  slim = { ...slim, taxOv: {}, costOv: {}, orderOv: {} };
  return JSON.stringify(slim);
}

export function persistIrissListPrefs(storage: IrissListStorage, prefs: IrissListPrefs): boolean {
  return safeStorageSet(storage, IRISS_LIST_PREFS_KEY, serializeIrissListPrefs(prefs));
}

/**
 * Startā: ja v4 ir vecā formātā vai > ~100 KB, izdzēš un ieraksta tikai iestatījumus.
 * Veco kārtošanas atslēgu pārnes uz v4.
 */
export function migrateIrissListPrefs(storage: IrissListStorage): IrissListPrefs {
  for (const key of IRISS_LIST_LEGACY_PREFS_KEYS) safeStorageRemove(storage, key);
  const raw = safeStorageGet(storage, IRISS_LIST_PREFS_KEY);
  const prefs = parseIrissListPrefs(raw);
  const sortLegacy = parseListingSort(safeStorageGet(storage, LISTING_SORT_STORAGE_KEY));
  if (!prefs.sort && sortLegacy) prefs.sort = sortLegacy;
  const bloated = isLegacyOrBloatedIrissListPrefs(raw);
  if (bloated) {
    safeStorageRemove(storage, IRISS_LIST_PREFS_KEY);
    persistIrissListPrefs(storage, prefs);
  }
  if (sortLegacy) {
    safeStorageRemove(storage, LISTING_SORT_STORAGE_KEY);
    if (!bloated) persistIrissListPrefs(storage, prefs);
  }
  return prefs;
}

export function listingCostsFor(prefs: IrissListPrefs, vehicleId: string): ListingCostParts {
  const o = prefs.costOv[vehicleId] ?? {};
  return {
    fee: o.fee ?? prefs.costs.fee,
    transport: o.transport ?? prefs.costs.transport,
    commission: o.commission ?? prefs.costs.commission,
    unplanned: o.unplanned ?? prefs.costs.unplanned,
  };
}
