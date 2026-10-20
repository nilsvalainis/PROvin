/**
 * Kopīgs rate limit visām Vercel instancēm.
 *
 * Ja iestatīts Upstash Redis REST (`UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`)
 * vai Vercel KV (`KV_REST_API_URL` + `KV_REST_API_TOKEN`), skaitītājs ir kopīgs (fiksēts logs).
 * Bez tiem vai kļūdas gadījumā paliek atmiņas ierobežotājs (`rate-limit-memory`), tāpēc
 * Redis kļūme nekad neaptur pieprasījumus.
 */

import { createHash } from "node:crypto";
import { checkRateLimit as checkRateLimitMemory, type RateLimitResult } from "@/lib/rate-limit-memory";

export type { RateLimitResult };

const REDIS_TIMEOUT_MS = 400;
const KEY_PREFIX = "provin:rl:";

type RedisRestConfig = { url: string; token: string };

export function resolveRateLimitRedis(env: NodeJS.ProcessEnv = process.env): RedisRestConfig | null {
  const url = (env.UPSTASH_REDIS_REST_URL ?? env.KV_REST_API_URL ?? "").trim().replace(/\/+$/, "");
  const token = (env.UPSTASH_REDIS_REST_TOKEN ?? env.KV_REST_API_TOKEN ?? "").trim();
  if (!url.startsWith("https://") || !token) return null;
  return { url, token };
}

/** Fiksēta loga skaitītājs: INCR + PEXPIRE NX + PTTL vienā pipeline. */
async function redisFixedWindow(
  cfg: RedisRestConfig,
  key: string,
  windowMs: number,
  fetchImpl: typeof fetch,
): Promise<{ count: number; ttlMs: number } | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REDIS_TIMEOUT_MS);
  try {
    const res = await fetchImpl(`${cfg.url}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
      body: JSON.stringify([
        ["INCR", key],
        ["PEXPIRE", key, String(windowMs), "NX"],
        ["PTTL", key],
      ]),
      cache: "no-store",
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { result?: unknown; error?: unknown }[];
    const count = Number(data?.[0]?.result);
    const ttl = Number(data?.[2]?.result);
    if (!Number.isFinite(count)) return null;
    return { count, ttlMs: Number.isFinite(ttl) && ttl > 0 ? ttl : windowMs };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Ne vairāk kā `max` pieprasījumu `windowMs` logā. Vispirms lokālā atmiņa (lēti, aptur
 * vienas instances plūdus), tad kopīgais Redis skaitītājs, ja konfigurēts.
 */
export async function checkRateLimit(
  key: string,
  max: number,
  windowMs: number,
  opts: { env?: NodeJS.ProcessEnv; fetchImpl?: typeof fetch } = {},
): Promise<RateLimitResult> {
  const local = checkRateLimitMemory(key, max, windowMs);
  if (!local.ok) return local;

  const cfg = resolveRateLimitRedis(opts.env);
  if (!cfg) return local;

  // Atslēgā var būt e-pasts vai IP: ārējā glabātuvē tikai hash.
  const hashed = createHash("sha256").update(key).digest("hex").slice(0, 40);
  const shared = await redisFixedWindow(cfg, `${KEY_PREFIX}${hashed}`, windowMs, opts.fetchImpl ?? fetch);
  if (!shared) return local;
  if (shared.count > max) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil(shared.ttlMs / 1000)) };
  }
  return { ok: true };
}
