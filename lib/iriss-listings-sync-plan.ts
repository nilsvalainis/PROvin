/**
 * Viena palaišana ietilpst maršrutā `maxDuration = 300` s (skat. sync-now un daily-sync route).
 * 92 avoti ar virknes pauzi 4 s ir (92-1)*4 s = 364 s, vēl pirms HTTP. Tāpēc:
 * tiešie Autobid lasījumi iet ar paralēlismu 2-3, un kas neietilpst budžetā, paliek kursorā
 * līdz nākamajai palaišanai tajā pašā UTC dienā. Automātiskā slota sākums (09/13/17 Rīgā)
 * un poga „Nolasīt” sāk ciklu no jauna (`restart`); turpinājums (`restart: false`) iet no kursora.
 * Rinda: vispirms nekad nenolasītie, tad vecākais veiksmīgais fetchedAt; platformas pārmaiņus.
 */

import type { IrissFetchedVehicle } from "@/lib/iriss-listings-reconcile";
import { normalizeListingUrl, type IrissListingSource } from "@/lib/iriss-listings-sources";
import type { IrissListingPlatform, IrissListingSourceRun, IrissListingsSyncCursor } from "@/lib/iriss-listings-types";

/** Vercel funkcijas griesti šiem diviem maršrutiem. Budžets (`IRISS_LISTINGS_TIME_BUDGET_MS`) ir zem tā. */
export const IRISS_LISTINGS_ROUTE_MAX_DURATION_MS = 300_000;
/** Tiešajam Autobid (lapas * timeout) atstājam rezervi, lai in-flight nepārsniedz maxDuration. */
export const DIRECT_FETCH_HEADROOM_MS = 45_000;
/** Releja fetch timeout ir līdz 180 s; nesākam jaunu, ja līdz 300 s griestiem nav 90 s. */
export const RELAY_FETCH_HEADROOM_MS = 90_000;

const WAITING_NOTE = "Gaida nākamo partiju: laika budžets beidzās.";

export function serialInterSourcePauseMs(sourceCount: number, pauseMs: number): number {
  return Math.max(0, sourceCount - 1) * Math.max(0, pauseMs);
}

export function canStartListingJob(elapsedMs: number, budgetMs: number, headroomMs: number): boolean {
  if (elapsedMs >= budgetMs) return false;
  if (elapsedMs + headroomMs > IRISS_LISTINGS_ROUTE_MAX_DURATION_MS - 10_000) return false;
  return true;
}

export function selectListingSyncQueue<T extends { key: string }>(
  groups: T[],
  cursor: IrissListingsSyncCursor | undefined,
  today: string,
  restart: boolean,
): { queue: T[]; carriedDone: string[]; alreadyDone: boolean } {
  const sameDay = cursor?.day === today;
  if (restart || !sameDay) return { queue: groups, carriedDone: [], alreadyDone: false };
  const done = new Set(cursor?.doneKeys ?? []);
  const queue = groups.filter((g) => !done.has(g.key));
  const live = new Set(groups.map((g) => g.key));
  const carriedDone = (cursor?.doneKeys ?? []).filter((k) => live.has(k));
  return { queue, carriedDone, alreadyDone: groups.length > 0 && queue.length === 0 };
}

export type ListingSyncProgress = { done: number; total: number };

export function listingSyncProgress(total: number, doneKeys: readonly string[]): ListingSyncProgress {
  const n = Math.max(0, total);
  const done = Math.min(n, new Set(doneKeys.filter(Boolean)).size);
  return { done, total: n };
}

export function listingSourceGroupKey(platform: IrissListingPlatform, sourceUrl: string): string {
  return `${platform}|${normalizeListingUrl(sourceUrl)}`;
}

/** Vecākais veiksmīgais fetchedAt grupā; `null` = nekad nav bijis status ok. */
export function groupOldestOkFetchedAtMs(
  group: { key: string; platform: IrissListingPlatform; sourceUrl: string },
  previousRuns: readonly Pick<IrissListingSourceRun, "platform" | "sourceUrl" | "status" | "fetchedAt">[],
): number | null {
  let oldest: number | null = null;
  for (const run of previousRuns) {
    if (run.status !== "ok") continue;
    if (listingSourceGroupKey(run.platform, run.sourceUrl) !== group.key) continue;
    const t = Date.parse(run.fetchedAt);
    if (!Number.isFinite(t)) continue;
    if (oldest == null || t < oldest) oldest = t;
  }
  return oldest;
}

export function interleaveListingGroupsByPlatform<T extends { platform: IrissListingPlatform }>(groups: T[]): T[] {
  const buckets = new Map<IrissListingPlatform, T[]>();
  const platformOrder: IrissListingPlatform[] = [];
  for (const g of groups) {
    const hit = buckets.get(g.platform);
    if (!hit) {
      buckets.set(g.platform, [g]);
      platformOrder.push(g.platform);
      continue;
    }
    hit.push(g);
  }
  const out: T[] = [];
  let more = true;
  while (more) {
    more = false;
    for (const p of platformOrder) {
      const q = buckets.get(p);
      if (!q || q.length === 0) continue;
      out.push(q.shift()!);
      more = true;
    }
  }
  return out;
}

/**
 * Nekad nenolasītie vispirms, tad vecākais veiksmīgais fetchedAt.
 * Katrā kohortā platformas (Autobid / Openlane / Auto1) pārmaiņus, lai viena releja rinda neapēd budžetu.
 */
export function orderListingSyncGroups<T extends { key: string; platform: IrissListingPlatform; sourceUrl: string }>(
  groups: T[],
  previousRuns: readonly Pick<IrissListingSourceRun, "platform" | "sourceUrl" | "status" | "fetchedAt">[],
): T[] {
  const never: T[] = [];
  const seen: Array<{ g: T; at: number }> = [];
  for (const g of groups) {
    const at = groupOldestOkFetchedAtMs(g, previousRuns);
    if (at == null) never.push(g);
    else seen.push({ g, at });
  }
  seen.sort((a, b) => a.at - b.at || a.g.key.localeCompare(b.g.key));
  return [...interleaveListingGroupsByPlatform(never), ...interleaveListingGroupsByPlatform(seen.map((x) => x.g))];
}

export function fanOutFetchedVehicles(
  vehicles: IrissFetchedVehicle[],
  orders: Array<Pick<IrissListingSource, "orderId" | "orderBrandModel">>,
): IrissFetchedVehicle[] {
  const out: IrissFetchedVehicle[] = [];
  for (const o of orders) {
    for (const v of vehicles) out.push({ ...v, orderId: o.orderId, orderBrandModel: o.orderBrandModel });
  }
  return out;
}

export function mergeListingSourceRuns(
  active: IrissListingSource[],
  previous: IrissListingSourceRun[],
  current: IrissListingSourceRun[],
  now: string,
): IrissListingSourceRun[] {
  const prevById = new Map(previous.map((s) => [s.id, s]));
  const curById = new Map(current.map((s) => [s.id, s]));
  return active.map((src) => {
    const hit = curById.get(src.id) ?? prevById.get(src.id);
    if (hit) return hit;
    return {
      id: src.id,
      orderId: src.orderId,
      orderBrandModel: src.orderBrandModel,
      platform: src.platform,
      sourceUrl: src.sourceUrl,
      status: "skipped",
      note: WAITING_NOTE,
      vehicleCount: 0,
      pagesFetched: 0,
      pageCount: 0,
      fetchedAt: now,
    };
  });
}

/**
 * `concurrency` darbinieki. `canStart` ir sinhrona un tiek pārbaudīta pirms nākamā darba;
 * ja false, pārējie paliek nenolasīti (nākamā partija).
 */
export async function runBounded<T>(
  items: T[],
  concurrency: number,
  canStart: (item: T) => boolean,
  worker: (item: T) => Promise<void>,
): Promise<{ started: number }> {
  let index = 0;
  const width = Math.max(1, Math.min(concurrency, items.length || 1));
  async function loop(): Promise<void> {
    for (;;) {
      const i = index;
      if (i >= items.length) return;
      if (!canStart(items[i]!)) return;
      index += 1;
      await worker(items[i]!);
    }
  }
  if (items.length === 0) return { started: 0 };
  await Promise.all(Array.from({ length: Math.min(width, items.length) }, () => loop()));
  return { started: index };
}
