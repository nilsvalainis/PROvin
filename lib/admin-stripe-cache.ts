import "server-only";

import type { AdminOrderDetail, AdminOrderRow } from "@/lib/admin-orders";

/** Stripe Checkout session meta — pietiek PATCH/Gemini guard validācijai bez pilna retrieve. */
export type StripeCheckoutSessionMeta = {
  id: string;
  paymentStatus: string;
  checkoutLine?: AdminOrderRow["checkoutLine"];
  isDemo?: boolean;
};

type CacheEntry<T> = { at: number; value: T };

const PAID_LIST_TTL_MS = Math.max(
  15_000,
  Number.parseInt(process.env.ADMIN_STRIPE_PAID_LIST_CACHE_TTL_MS ?? "90000", 10) || 90_000,
);
const DETAIL_TTL_MS = Math.max(
  30_000,
  Number.parseInt(process.env.ADMIN_STRIPE_DETAIL_CACHE_TTL_MS ?? "300000", 10) || 300_000,
);

let paidListCache: CacheEntry<AdminOrderRow[]> | null = null;
let paidListInflight: Promise<AdminOrderRow[]> | null = null;

const detailCache = new Map<string, CacheEntry<AdminOrderDetail>>();
const detailInflight = new Map<string, Promise<AdminOrderDetail | null>>();

const metaCache = new Map<string, CacheEntry<StripeCheckoutSessionMeta>>();

function isFresh<T>(entry: CacheEntry<T> | null | undefined, ttlMs: number): entry is CacheEntry<T> {
  return entry != null && Date.now() - entry.at < ttlMs;
}

export function invalidateStripePaidListCache(): void {
  paidListCache = null;
  paidListInflight = null;
}

export function invalidateStripeSessionCache(sessionId: string): void {
  detailCache.delete(sessionId);
  detailInflight.delete(sessionId);
  metaCache.delete(sessionId);
}

export async function getCachedPaidCheckoutSessions(
  fetcher: () => Promise<AdminOrderRow[]>,
): Promise<AdminOrderRow[]> {
  if (isFresh(paidListCache, PAID_LIST_TTL_MS)) return paidListCache.value;

  if (paidListInflight) return paidListInflight;

  paidListInflight = fetcher()
    .then((rows) => {
      paidListCache = { at: Date.now(), value: rows };
      for (const row of rows) {
        metaCache.set(row.id, {
          at: Date.now(),
          value: {
            id: row.id,
            paymentStatus: row.paymentStatus ?? "paid",
            checkoutLine: row.checkoutLine,
            isDemo: row.isDemo,
          },
        });
      }
      return rows;
    })
    .finally(() => {
      paidListInflight = null;
    });

  return paidListInflight;
}

export async function getCachedCheckoutSessionDetail(
  sessionId: string,
  fetcher: () => Promise<AdminOrderDetail | null>,
): Promise<AdminOrderDetail | null> {
  const cached = detailCache.get(sessionId);
  if (isFresh(cached, DETAIL_TTL_MS)) return cached.value;

  const inflight = detailInflight.get(sessionId);
  if (inflight) return inflight;

  const promise = fetcher().then((detail) => {
    if (detail) {
      detailCache.set(sessionId, { at: Date.now(), value: detail });
      metaCache.set(sessionId, {
        at: Date.now(),
        value: {
          id: detail.id,
          paymentStatus: detail.paymentStatus ?? "paid",
          checkoutLine: detail.checkoutLine,
          isDemo: detail.isDemo,
        },
      });
    }
    return detail;
  }).finally(() => {
    detailInflight.delete(sessionId);
  });

  detailInflight.set(sessionId, promise);
  return promise;
}

/** Vieglāka sesijas pārbaude — izmanto kešu vai gaida detail fetcher. */
export async function getStripeCheckoutSessionMeta(
  sessionId: string,
  fetcher: () => Promise<AdminOrderDetail | null>,
): Promise<StripeCheckoutSessionMeta | null> {
  const cachedMeta = metaCache.get(sessionId);
  if (isFresh(cachedMeta, DETAIL_TTL_MS)) return cachedMeta.value;

  const detail = await getCachedCheckoutSessionDetail(sessionId, fetcher);
  if (!detail) return null;

  return {
    id: detail.id,
    paymentStatus: detail.paymentStatus ?? "paid",
    checkoutLine: detail.checkoutLine,
    isDemo: detail.isDemo,
  };
}
