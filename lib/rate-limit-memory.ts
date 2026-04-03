/**
 * Vienkārša atmiņas ierobežotāja (slīdošs logs).
 * Serverless: katram instancēm sava atmiņa — pilnīga aizsardzībai vēlāk: Upstash / Vercel KV.
 */

type Bucket = { count: number; windowStart: number };

const store = new Map<string, Bucket>();

const MAX_KEYS = 3000;

function pruneStale(windowMs: number): void {
  if (store.size < MAX_KEYS) return;
  const now = Date.now();
  for (const [key, b] of store) {
    if (now - b.windowStart >= windowMs) store.delete(key);
  }
  if (store.size >= MAX_KEYS) {
    let i = 0;
    for (const k of store.keys()) {
      store.delete(k);
      if (++i > 500) break;
    }
  }
}

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSec: number };

/**
 * Ne vairāk kā `max` pieprasījumu katrā `windowMs` logā (atiestatās pēc loga beigām).
 */
export function checkRateLimit(key: string, max: number, windowMs: number): RateLimitResult {
  pruneStale(windowMs);
  const now = Date.now();
  const b = store.get(key);

  if (!b || now - b.windowStart >= windowMs) {
    store.set(key, { count: 1, windowStart: now });
    return { ok: true };
  }

  if (b.count >= max) {
    const retryAfterSec = Math.max(1, Math.ceil((windowMs - (now - b.windowStart)) / 1000));
    return { ok: false, retryAfterSec };
  }

  b.count += 1;
  return { ok: true };
}
