/**
 * IRISS LIST piederība meklēšanas saitei, pilnīgs nolasījums un izsoles beigas.
 * Viens auto paliek sarakstā tikai tad, ja vismaz viena pašreiz derīga saite to joprojām satur.
 */

import type { IrissListingSource } from "@/lib/iriss-listings-sources";
import type { IrissListingSourceStatus, IrissListingVehicle } from "@/lib/iriss-listings-types";
import { listingSearchKey } from "@/lib/iriss-listings-url";

export { listingLinkRunForUrl, listingSearchKey } from "@/lib/iriss-listings-url";

const ENDED_STAGES = new Set(["AFTER_AUCTION", "FINISHED", "CLOSED", "ENDED"]);

export function listingSearchReadComplete(opts: {
  status: IrissListingSourceStatus;
  pagesFetched: number;
  pageCount: number;
  maxPages: number;
  pageError?: boolean;
}): boolean {
  if (opts.status !== "ok") return false;
  if (opts.pageError) return false;
  if (opts.pagesFetched < 1) return false;
  if (opts.pageCount > opts.maxPages) return false;
  if (opts.pageCount > opts.pagesFetched) return false;
  return true;
}

export function isStoredListingSearchComplete(
  run: Pick< { status: IrissListingSourceStatus; pagesFetched: number; pageCount: number; complete?: boolean }, "status" | "pagesFetched" | "pageCount" | "complete">,
): boolean {
  if (run.status !== "ok") return false;
  if (run.complete === true) return true;
  if (run.complete === false) return false;
  if (run.pagesFetched < 1) return false;
  if (run.pageCount > 0 && run.pagesFetched >= run.pageCount) return true;
  return false;
}

export function isListingAuctionEnded(
  v: Pick<IrissListingVehicle, "auctionEndAt" | "auctionStage">,
  nowMs: number,
): boolean {
  const stage = String(v.auctionStage ?? "").trim().toUpperCase();
  if (ENDED_STAGES.has(stage)) return true;
  const end = Date.parse(v.auctionEndAt ?? "");
  return Number.isFinite(end) && end <= nowMs;
}

export function activeListingSearchKeys(sources: readonly Pick<IrissListingSource, "platform" | "sourceUrl">[]): Set<string> {
  return new Set(sources.map((s) => listingSearchKey(s.platform, s.sourceUrl)));
}

export function ordersForSearchKeys(
  sources: readonly IrissListingSource[],
  keys: readonly string[],
): { orderIds: string[]; orderBrandModels: string[] } {
  const want = new Set(keys);
  const orderIds: string[] = [];
  const orderBrandModels: string[] = [];
  const seenOrder = new Set<string>();
  const seenBrand = new Set<string>();
  for (const src of sources) {
    if (!want.has(listingSearchKey(src.platform, src.sourceUrl))) continue;
    if (!seenOrder.has(src.orderId)) {
      seenOrder.add(src.orderId);
      orderIds.push(src.orderId);
    }
    const brand = src.orderBrandModel.trim();
    if (brand && !seenBrand.has(brand)) {
      seenBrand.add(brand);
      orderBrandModels.push(brand);
    }
  }
  orderIds.sort((a, b) => a.localeCompare(b));
  orderBrandModels.sort((a, b) => a.localeCompare(b));
  return { orderIds, orderBrandModels };
}

/** Vecie auto bez sourceKeys: pieņem visus pašreizējos šīs platformas meklējumus pie piesaistītajiem pasūtījumiem. */
export function inferLegacySourceKeys(
  v: Pick<IrissListingVehicle, "platform" | "orderIds">,
  sources: readonly IrissListingSource[],
): string[] {
  const orders = new Set(v.orderIds);
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const src of sources) {
    if (src.platform !== v.platform || !orders.has(src.orderId)) continue;
    const key = listingSearchKey(src.platform, src.sourceUrl);
    if (seen.has(key)) continue;
    seen.add(key);
    keys.push(key);
  }
  return keys;
}

export function vehicleSourceKeys(
  v: Pick<IrissListingVehicle, "platform" | "orderIds" | "sourceKeys">,
  sources: readonly IrissListingSource[],
): string[] {
  const stored = (v.sourceKeys ?? []).map((k) => k.trim()).filter(Boolean);
  if (stored.length > 0) return [...new Set(stored)];
  return inferLegacySourceKeys(v, sources);
}

export type MembershipCleanupInput = {
  vehicles: IrissListingVehicle[];
  sources: IrissListingSource[];
  rejectedIds: Set<string>;
  nowMs: number;
};

/**
 * Uzreiz izņem auto, kas vairs nepieder nevienai derīgai saitei, ir noraidīti vai kuru izsole beigusies.
 * Nelasa avotus: tikai piederība un beigu laiks.
 */
export function applyListingMembership(input: MembershipCleanupInput): {
  vehicles: IrissListingVehicle[];
  dropped: number;
} {
  const activeKeys = activeListingSearchKeys(input.sources);
  const out: IrissListingVehicle[] = [];
  let dropped = 0;
  for (const prev of input.vehicles) {
    if (input.rejectedIds.has(prev.id)) {
      dropped += 1;
      continue;
    }
    if (isListingAuctionEnded(prev, input.nowMs)) {
      dropped += 1;
      continue;
    }
    const keys = vehicleSourceKeys(prev, input.sources).filter((k) => activeKeys.has(k));
    if (keys.length === 0) {
      dropped += 1;
      continue;
    }
    const orders = ordersForSearchKeys(input.sources, keys);
    if (orders.orderIds.length === 0) {
      dropped += 1;
      continue;
    }
    out.push({
      ...prev,
      sourceKeys: keys,
      orderIds: orders.orderIds,
      orderBrandModels: orders.orderBrandModels.length > 0 ? orders.orderBrandModels : prev.orderBrandModels,
    });
  }
  return { vehicles: out, dropped };
}

