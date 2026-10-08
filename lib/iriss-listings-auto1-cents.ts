/**
 * Vecais Auto1 relejs glabāja cenas centos. Jaunais dod eiro.
 * Guard un Blob migrācija attiecas uz visiem četriem laukiem un priceHistory.
 */

import type { IrissListingPriceChange, IrissListingVehicle } from "@/lib/iriss-listings-types";

export const AUTO1_PRICE_KEYS = ["priceStart", "priceMinimal", "priceCurrent", "priceBuyNow"] as const;

export type Auto1PriceFields = {
  platform: string;
  priceStart: number | null;
  priceMinimal: number | null;
  priceCurrent: number | null;
  priceBuyNow: number | null;
  priceHistory?: IrissListingPriceChange[];
  salesVatType?: number | null;
  stockNumber?: string;
};

/** `from` ir ~100× `to` (centi pret eiro). */
export function isCentsEuroPair(from: number, to: number): boolean {
  if (!(from > 0) || !(to > 0)) return false;
  const r = to / from;
  return r >= 0.0095 && r <= 0.0105;
}

function collectPrices(v: Auto1PriceFields): number[] {
  const out: number[] = [];
  for (const key of AUTO1_PRICE_KEYS) {
    const n = v[key];
    if (typeof n === "number" && n > 0) out.push(n);
  }
  return out;
}

function collectHistoryAmounts(history: IrissListingPriceChange[] | undefined): number[] {
  const out: number[] = [];
  for (const c of history ?? []) {
    if (typeof c.from === "number" && c.from > 0) out.push(c.from);
    if (typeof c.to === "number" && c.to > 0) out.push(c.to);
  }
  return out;
}

function euroRefsFrom(amounts: number[]): number[] {
  return amounts.filter((n) => !amounts.some((o) => o !== n && isCentsEuroPair(n, o)));
}

export function isRealListingPriceChange(c: Pick<IrissListingPriceChange, "from" | "to">): boolean {
  if (c.from == null || c.to == null) return false;
  if (c.from === c.to) return false;
  if (isCentsEuroPair(c.from, c.to) || isCentsEuroPair(c.to, c.from)) return false;
  return true;
}

function rescaleIfCents(n: number, euroRefs: number[], treatAllAsCents: boolean): number {
  if (treatAllAsCents) return Math.round(n) / 100;
  if (euroRefs.some((e) => isCentsEuroPair(n, e))) return Math.round(n) / 100;
  return n;
}

function fixNullable(n: number | null, euroRefs: number[], treatAllAsCents: boolean): number | null {
  if (n == null) return null;
  return rescaleIfCents(n, euroRefs, treatAllAsCents);
}

export function sanitizeAuto1CentsVehicle<T extends Auto1PriceFields>(v: T): { vehicle: T; changed: boolean } {
  if (v.platform !== "auto1") return { vehicle: v, changed: false };
  const fieldAmounts = collectPrices(v);
  const histAmounts = collectHistoryAmounts(v.priceHistory);
  const all = [...fieldAmounts, ...histAmounts];
  const euroRefs = euroRefsFrom(fieldAmounts.length ? fieldAmounts : all);
  const minN = all.length ? Math.min(...all) : 0;
  /** Auto1 LIST auto parasti ir zem ~80k €. Ja mazākā vērtība joprojām ir centos (>= 2000 € × 100), dalām visus. */
  const treatAllAsCents = all.length > 0 && minN >= 200_000;

  const priceStart = fixNullable(v.priceStart, euroRefs, treatAllAsCents);
  const priceMinimal = fixNullable(v.priceMinimal, euroRefs, treatAllAsCents);
  const priceCurrent = fixNullable(v.priceCurrent, euroRefs, treatAllAsCents);
  const priceBuyNow = fixNullable(v.priceBuyNow, euroRefs, treatAllAsCents);
  const liveRefs = [priceStart, priceMinimal, priceCurrent, priceBuyNow].filter((n): n is number => n != null && n > 0);
  const refsForHistory = liveRefs.length ? liveRefs : euroRefs;

  const priceHistory = (v.priceHistory ?? [])
    .map((c) => ({
      ...c,
      from: c.from == null ? null : rescaleIfCents(c.from, refsForHistory, treatAllAsCents),
      to: c.to == null ? null : rescaleIfCents(c.to, refsForHistory, treatAllAsCents),
    }))
    .filter(isRealListingPriceChange);

  const changed =
    priceStart !== v.priceStart ||
    priceMinimal !== v.priceMinimal ||
    priceCurrent !== v.priceCurrent ||
    priceBuyNow !== v.priceBuyNow ||
    JSON.stringify(priceHistory) !== JSON.stringify(v.priceHistory ?? []);

  if (!changed) return { vehicle: v, changed: false };
  return {
    vehicle: { ...v, priceStart, priceMinimal, priceCurrent, priceBuyNow, priceHistory },
    changed: true,
  };
}

/** Vecs Auto1 snapshots: nav stockNumber/salesVatType, vai jebkurš lauks centos pret jauno eiro. */
export function isAuto1CentsRescale(prev: Auto1PriceFields, next: Auto1PriceFields): boolean {
  if (prev.platform !== "auto1" && next.platform !== "auto1") return false;
  if (prev.platform === "auto1") {
    const oldShape = prev.salesVatType == null && !String(prev.stockNumber ?? "").trim();
    if (oldShape) return true;
  }
  const prevAmounts = [...collectPrices(prev), ...collectHistoryAmounts(prev.priceHistory)];
  const nextAmounts = collectPrices(next);
  if (nextAmounts.some((to) => prevAmounts.some((from) => isCentsEuroPair(from, to)))) return true;
  for (const key of AUTO1_PRICE_KEYS) {
    const from = prev[key];
    const to = next[key];
    if (typeof from === "number" && typeof to === "number" && isCentsEuroPair(from, to)) return true;
    if (typeof from === "number" && to == null && nextAmounts.some((e) => isCentsEuroPair(from, e))) return true;
  }
  return false;
}

export function listingAuctionTypeLabel(raw: string | null | undefined): string | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  if (/^lastrun$/i.test(s)) return "pēdējā iespēja";
  if (/^\d{1,2}d\d+$/i.test(s)) return null;
  return s;
}

export function applyAuto1CentsMigration<T extends Auto1PriceFields>(vehicles: readonly T[]): { vehicles: T[]; changed: boolean } {
  let changed = false;
  const out = vehicles.map((v) => {
    const r = sanitizeAuto1CentsVehicle(v);
    if (r.changed) changed = true;
    return r.vehicle;
  });
  return { vehicles: out, changed };
}

export function realListingPriceHistory(history: readonly IrissListingPriceChange[]): IrissListingPriceChange[] {
  return history.filter(isRealListingPriceChange);
}

export function listingPriceChangeAbsReal(history: readonly IrissListingPriceChange[]): number | null {
  let best: number | null = null;
  for (const c of history) {
    if (!isRealListingPriceChange(c) || c.from == null || c.to == null) continue;
    const d = Math.abs(c.to - c.from);
    if (best === null || d > best) best = d;
  }
  return best;
}
