import { isAuto1CentsRescale, isCentsEuroPair, sanitizeAuto1CentsVehicle } from "@/lib/iriss-listings-auto1-cents";
import {
  isListingAuctionEnded,
  listingSearchKey,
  ordersForSearchKeys,
  vehicleSourceKeys,
} from "@/lib/iriss-listings-membership";
import type { IrissListingSource } from "@/lib/iriss-listings-sources";
import type {
  IrissListingPlatform,
  IrissListingPriceChange,
  IrissListingPriceField,
  IrissListingVehicle,
} from "@/lib/iriss-listings-types";

/** Nolasīts auto pirms saskaņošanas ar iepriekšējo snapshot. */
export type IrissFetchedVehicle = Omit<
  IrissListingVehicle,
  "orderIds" | "orderBrandModels" | "firstSeenAt" | "lastSeenAt" | "missingRuns" | "change" | "priceHistory" | "sourceKeys"
> & {
  orderId: string;
  orderBrandModel: string;
  sourceKey: string;
};

export type ReconcileInput = {
  previous: IrissListingVehicle[];
  fetched: IrissFetchedVehicle[];
  /** Meklējumi (`platform|normalizedUrl`), kas šajā reizē nolasīti pilnīgi un veiksmīgi. */
  okCompleteSourceKeys: Set<string>;
  /** Pašreiz derīgās meklēšanas saites. */
  activeSourceKeys: Set<string>;
  activeSources: IrissListingSource[];
  rejectedIds: Set<string>;
  now: string;
  nowMs?: number;
};

export type ReconcileOutput = {
  vehicles: IrissListingVehicle[];
  newCount: number;
  priceChangedCount: number;
  goneCount: number;
};

const PRICE_FIELDS: Array<{ field: IrissListingPriceField; key: "priceStart" | "priceMinimal" | "priceCurrent" | "priceBuyNow" }> = [
  { field: "start", key: "priceStart" },
  { field: "minimal", key: "priceMinimal" },
  { field: "current", key: "priceCurrent" },
  { field: "buy_now", key: "priceBuyNow" },
];

/** @deprecated Izmanto `listingSearchKey(platform, sourceUrl)`. Atstāts, lai vecie testi kompilētos līdz pārejai. */
export function sourceKey(platform: IrissListingPlatform, sourceUrlOrOrderId: string): string {
  return listingSearchKey(platform, sourceUrlOrOrderId);
}

function isBlank(v: string | null | undefined): boolean {
  return !String(v ?? "").trim();
}

/**
 * Vecā Auto1 formāta paliekas (pirms imageUrl / PVN / beigu laika): nav foto, nav salesVatType,
 * nav taxDeduction un nav auctionEndAt. Nākamajā saglabāšanā izmetam, lai nolasītu tīri.
 */
export function isLegacyStaleAuto1Vehicle(
  v: Pick<IrissListingVehicle, "platform" | "imageUrl" | "salesVatType" | "taxDeduction" | "auctionEndAt">,
): boolean {
  if (v.platform !== "auto1") return false;
  return isBlank(v.imageUrl) && v.salesVatType == null && v.taxDeduction == null && isBlank(v.auctionEndAt);
}

type VehicleFields = Omit<IrissFetchedVehicle, "orderId" | "orderBrandModel" | "sourceKey">;

function stripSourceFields(v: IrissFetchedVehicle): VehicleFields {
  const copy: Partial<IrissFetchedVehicle> = { ...v };
  delete copy.orderId;
  delete copy.orderBrandModel;
  delete copy.sourceKey;
  return copy as VehicleFields;
}

function uniqSorted(values: string[]): string[] {
  return [...new Set(values.filter((v) => v.trim()))].sort((a, b) => a.localeCompare(b));
}

function priceChanges(prev: IrissListingVehicle, next: IrissFetchedVehicle, at: string): IrissListingPriceChange[] {
  if (isAuto1CentsRescale(prev, next)) return [];
  const out: IrissListingPriceChange[] = [];
  for (const { field, key } of PRICE_FIELDS) {
    const from = prev[key];
    const to = next[key];
    if (from === to) continue;
    /** Pirmo reizi parādījusies cena (bija null) nav maiņa. */
    if (from === null) continue;
    if (typeof from === "number" && typeof to === "number" && (isCentsEuroPair(from, to) || isCentsEuroPair(to, from))) continue;
    out.push({ at, field, from, to });
  }
  return out;
}

export function sortVehicles(vehicles: IrissListingVehicle[]): IrissListingVehicle[] {
  return [...vehicles].sort((a, b) => {
    const ta = a.auctionStartAt || "9999";
    const tb = b.auctionStartAt || "9999";
    if (ta !== tb) return ta < tb ? -1 : 1;
    return a.title.localeCompare(b.title);
  });
}

function nextSourceKeys(
  fetchedKeys: string[],
  prev: IrissListingVehicle | null,
  sources: IrissListingSource[],
  okCompleteSourceKeys: Set<string>,
  activeSourceKeys: Set<string>,
): string[] {
  const keptPrev = prev
    ? vehicleSourceKeys(prev, sources).filter((k) => activeSourceKeys.has(k) && !okCompleteSourceKeys.has(k))
    : [];
  return uniqSorted([...fetchedKeys.filter((k) => activeSourceKeys.has(k)), ...keptPrev]);
}

export function reconcileVehicles(input: ReconcileInput): ReconcileOutput {
  const now = input.now;
  const nowMs = input.nowMs ?? Date.parse(now);
  const sources = input.activeSources;

  const fetchedById = new Map<
    string,
    { base: IrissFetchedVehicle; orderIds: string[]; orderBrandModels: string[]; sourceKeys: string[] }
  >();
  for (const f of input.fetched) {
    if (input.rejectedIds.has(f.id)) continue;
    if (isListingAuctionEnded(f, nowMs)) continue;
    const key = f.sourceKey.trim();
    if (!key || !input.activeSourceKeys.has(key)) continue;
    const hit = fetchedById.get(f.id);
    if (hit) {
      hit.orderIds.push(f.orderId);
      hit.orderBrandModels.push(f.orderBrandModel);
      hit.sourceKeys.push(key);
      continue;
    }
    fetchedById.set(f.id, { base: f, orderIds: [f.orderId], orderBrandModels: [f.orderBrandModel], sourceKeys: [key] });
  }

  const prevById = new Map(input.previous.map((v) => [v.id, v]));
  const out: IrissListingVehicle[] = [];
  let newCount = 0;
  let priceChangedCount = 0;
  let goneCount = 0;

  for (const { base, orderIds, orderBrandModels, sourceKeys } of fetchedById.values()) {
    const fields = stripSourceFields(base);
    const prevRaw = prevById.get(base.id) ?? null;
    const keys = nextSourceKeys(sourceKeys, prevRaw, sources, input.okCompleteSourceKeys, input.activeSourceKeys);
    const orders = ordersForSearchKeys(sources, keys);
    const linkedOrders = orders.orderIds.length > 0 ? orders.orderIds : uniqSorted(orderIds);
    const linkedBrands = orders.orderBrandModels.length > 0 ? orders.orderBrandModels : uniqSorted(orderBrandModels);
    if (linkedOrders.length === 0 || keys.length === 0) continue;
    if (!prevRaw) {
      newCount += 1;
      out.push({
        ...fields,
        sourceKeys: keys,
        orderIds: linkedOrders,
        orderBrandModels: linkedBrands,
        firstSeenAt: now,
        lastSeenAt: now,
        missingRuns: 0,
        change: "new",
        priceHistory: [],
      });
      continue;
    }
    const rescale = isAuto1CentsRescale(prevRaw, base);
    const prev = sanitizeAuto1CentsVehicle(prevRaw).vehicle;
    const changes = rescale ? [] : priceChanges(prev, base, now);
    if (changes.length > 0) priceChangedCount += 1;
    out.push({
      ...fields,
      sourceKeys: keys,
      orderIds: linkedOrders,
      orderBrandModels: linkedBrands,
      firstSeenAt: prev.firstSeenAt || now,
      lastSeenAt: now,
      missingRuns: 0,
      change: changes.length > 0 ? "price_changed" : "unchanged",
      priceHistory: rescale ? [] : [...(prev.priceHistory ?? []), ...changes].slice(-30),
    });
  }

  for (const prev of input.previous) {
    if (fetchedById.has(prev.id)) continue;
    if (input.rejectedIds.has(prev.id)) continue;
    if (isLegacyStaleAuto1Vehicle(prev)) continue;
    if (isListingAuctionEnded(prev, nowMs)) {
      goneCount += 1;
      continue;
    }
    const keys = nextSourceKeys([], prev, sources, input.okCompleteSourceKeys, input.activeSourceKeys);
    if (keys.length === 0) {
      const hadCompleteMiss = vehicleSourceKeys(prev, sources).some((k) => input.okCompleteSourceKeys.has(k));
      if (hadCompleteMiss || vehicleSourceKeys(prev, sources).length > 0) goneCount += 1;
      continue;
    }
    const orders = ordersForSearchKeys(sources, keys);
    if (orders.orderIds.length === 0) {
      goneCount += 1;
      continue;
    }
    const cleaned = sanitizeAuto1CentsVehicle(prev).vehicle;
    out.push({
      ...cleaned,
      sourceKeys: keys,
      orderIds: orders.orderIds,
      orderBrandModels: orders.orderBrandModels.length > 0 ? orders.orderBrandModels : cleaned.orderBrandModels,
      missingRuns: 0,
      change: prev.change === "gone" ? "gone" : "unchanged",
    });
  }

  return { vehicles: sortVehicles(out), newCount, priceChangedCount, goneCount };
}
