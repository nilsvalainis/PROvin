import type {
  IrissListingPlatform,
  IrissListingPriceChange,
  IrissListingPriceField,
  IrissListingVehicle,
} from "@/lib/iriss-listings-types";

/** Nolasīts auto pirms saskaņošanas ar iepriekšējo snapshot. */
export type IrissFetchedVehicle = Omit<
  IrissListingVehicle,
  "orderIds" | "orderBrandModels" | "firstSeenAt" | "lastSeenAt" | "missingRuns" | "change" | "priceHistory"
> & {
  orderId: string;
  orderBrandModel: string;
};

export type ReconcileInput = {
  previous: IrissListingVehicle[];
  fetched: IrissFetchedVehicle[];
  /** `${platform}|${orderId}` avoti, kas šajā reizē nolasīti veiksmīgi. Tikai tiem drīkst skaitīt „pazudis”. */
  okSourceKeys: Set<string>;
  activeOrderIds: Set<string>;
  now: string;
  /** Pazudis tikai pēc N veiksmīgiem nolasījumiem pēc kārtas bez auto (noklusējums 2). */
  goneAfterMissingRuns?: number;
  /** Pazudušos glabā vēl N dienas, lai UI var parādīt, tad izmet. */
  dropGoneAfterDays?: number;
  maxPriceHistory?: number;
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

export function sourceKey(platform: IrissListingPlatform, orderId: string): string {
  return `${platform}|${orderId}`;
}

type VehicleFields = Omit<IrissFetchedVehicle, "orderId" | "orderBrandModel">;

function stripSourceFields(v: IrissFetchedVehicle): VehicleFields {
  const copy: Partial<IrissFetchedVehicle> = { ...v };
  delete copy.orderId;
  delete copy.orderBrandModel;
  return copy as VehicleFields;
}

function uniqSorted(values: string[]): string[] {
  return [...new Set(values.filter((v) => v.trim()))].sort((a, b) => a.localeCompare(b));
}

function centsToEuroRatio(from: number, to: number): boolean {
  if (!(from > 0) || !(to > 0)) return false;
  const r = to / from;
  return r >= 0.0095 && r <= 0.0105;
}

/** Vecais Auto1 relejs glabāja centos; jaunais dod eiro. Nav īsta cenas maiņa. */
function isAuto1CentsRescale(prev: IrissListingVehicle, next: IrissFetchedVehicle): boolean {
  if (prev.platform !== "auto1") return false;
  const oldShape = prev.salesVatType == null && !String(prev.stockNumber ?? "").trim();
  if (oldShape) return true;
  const pairs: Array<{ from: number; to: number }> = [];
  for (const { key } of PRICE_FIELDS) {
    const from = prev[key];
    const to = next[key];
    if (from === to) continue;
    if (typeof from !== "number" || typeof to !== "number") continue;
    pairs.push({ from, to });
  }
  return pairs.length > 0 && pairs.every((p) => centsToEuroRatio(p.from, p.to));
}

function priceChanges(prev: IrissListingVehicle, next: IrissFetchedVehicle, at: string): IrissListingPriceChange[] {
  if (isAuto1CentsRescale(prev, next)) return [];
  const out: IrissListingPriceChange[] = [];
  for (const { field, key } of PRICE_FIELDS) {
    const from = prev[key];
    const to = next[key];
    if (from === to) continue;
    /** Pirmo reizi parādījusies `current` cena (bija null) ir solījums, ne cenas maiņa. */
    if (field === "current" && from === null) continue;
    out.push({ at, field, from, to });
  }
  return out;
}

function daysBetween(aIso: string, bIso: string): number {
  const a = Date.parse(aIso);
  const b = Date.parse(bIso);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.abs(b - a) / 86_400_000;
}

export function sortVehicles(vehicles: IrissListingVehicle[]): IrissListingVehicle[] {
  return [...vehicles].sort((a, b) => {
    const ta = a.auctionStartAt || "9999";
    const tb = b.auctionStartAt || "9999";
    if (ta !== tb) return ta < tb ? -1 : 1;
    return a.title.localeCompare(b.title);
  });
}

export function reconcileVehicles(input: ReconcileInput): ReconcileOutput {
  const goneAfter = Math.max(1, input.goneAfterMissingRuns ?? 2);
  const dropAfterDays = Math.max(1, input.dropGoneAfterDays ?? 14);
  const maxHistory = Math.max(1, input.maxPriceHistory ?? 30);
  const now = input.now;

  /** Viens auto no vairākiem pasūtījumu meklējumiem: apvieno pasūtījumus. */
  const fetchedById = new Map<string, { base: IrissFetchedVehicle; orderIds: string[]; orderBrandModels: string[] }>();
  for (const f of input.fetched) {
    const hit = fetchedById.get(f.id);
    if (hit) {
      hit.orderIds.push(f.orderId);
      hit.orderBrandModels.push(f.orderBrandModel);
      continue;
    }
    fetchedById.set(f.id, { base: f, orderIds: [f.orderId], orderBrandModels: [f.orderBrandModel] });
  }

  const prevById = new Map(input.previous.map((v) => [v.id, v]));
  const out: IrissListingVehicle[] = [];
  let newCount = 0;
  let priceChangedCount = 0;
  let goneCount = 0;

  for (const { base, orderIds, orderBrandModels } of fetchedById.values()) {
    const fields = stripSourceFields(base);
    const prev = prevById.get(base.id) ?? null;
    if (!prev) {
      newCount += 1;
      out.push({
        ...fields,
        orderIds: uniqSorted(orderIds),
        orderBrandModels: uniqSorted(orderBrandModels),
        firstSeenAt: now,
        lastSeenAt: now,
        missingRuns: 0,
        change: "new",
        priceHistory: [],
      });
      continue;
    }
    const rescale = isAuto1CentsRescale(prev, base);
    const changes = rescale ? [] : priceChanges(prev, base, now);
    if (changes.length > 0) priceChangedCount += 1;
    out.push({
      ...fields,
      orderIds: uniqSorted([...orderIds, ...prev.orderIds.filter((id) => input.activeOrderIds.has(id))]),
      orderBrandModels: uniqSorted([...orderBrandModels, ...prev.orderBrandModels]),
      firstSeenAt: prev.firstSeenAt || now,
      lastSeenAt: now,
      missingRuns: 0,
      change: changes.length > 0 ? "price_changed" : "unchanged",
      priceHistory: rescale ? [] : [...(prev.priceHistory ?? []), ...changes].slice(-maxHistory),
    });
  }

  for (const prev of input.previous) {
    if (fetchedById.has(prev.id)) continue;
    const stillActiveOrders = prev.orderIds.filter((id) => input.activeOrderIds.has(id));
    if (stillActiveOrders.length === 0) continue;
    const readOk = stillActiveOrders.some((id) => input.okSourceKeys.has(sourceKey(prev.platform, id)));
    if (!readOk) {
      /** Avots šoreiz neizdevās: nav pamata skaitīt kā pazudušu. */
      out.push({ ...prev, orderIds: stillActiveOrders, change: prev.change === "gone" ? "gone" : "unchanged" });
      continue;
    }
    const missingRuns = prev.missingRuns + 1;
    const gone = missingRuns >= goneAfter;
    if (gone && daysBetween(prev.lastSeenAt, now) > dropAfterDays) continue;
    if (missingRuns === goneAfter) goneCount += 1;
    out.push({
      ...prev,
      orderIds: stillActiveOrders,
      missingRuns,
      change: gone ? "gone" : "unchanged",
    });
  }

  return { vehicles: sortVehicles(out), newCount, priceChangedCount, goneCount };
}
