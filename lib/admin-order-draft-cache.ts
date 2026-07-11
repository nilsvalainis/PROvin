import "server-only";

import type { OrderDraftState } from "@/lib/admin-order-draft-types";

type CacheEntry = { at: number; value: OrderDraftState | null };

const DRAFT_TTL_MS = Math.max(
  5_000,
  Number.parseInt(process.env.ADMIN_ORDER_DRAFT_CACHE_TTL_MS ?? "60000", 10) || 60_000,
);

const draftCache = new Map<string, CacheEntry>();
const draftInflight = new Map<string, Promise<OrderDraftState | null>>();

function isFresh(entry: CacheEntry | undefined): entry is CacheEntry {
  return entry != null && Date.now() - entry.at < DRAFT_TTL_MS;
}

export function invalidateOrderDraftCache(sessionId: string): void {
  draftCache.delete(sessionId);
  draftInflight.delete(sessionId);
}

export function invalidateAllOrderDraftCache(): void {
  draftCache.clear();
  draftInflight.clear();
}

export async function readOrderDraftCached(
  sessionId: string,
  fetcher: () => Promise<OrderDraftState | null>,
): Promise<OrderDraftState | null> {
  const cached = draftCache.get(sessionId);
  if (isFresh(cached)) return cached.value;

  const inflight = draftInflight.get(sessionId);
  if (inflight) return inflight;

  const promise = fetcher().then((value) => {
    draftCache.set(sessionId, { at: Date.now(), value });
    return value;
  }).finally(() => {
    draftInflight.delete(sessionId);
  });

  draftInflight.set(sessionId, promise);
  return promise;
}
