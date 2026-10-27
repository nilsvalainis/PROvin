/**
 * CSP pārkāpumu apkopojums pa dienām (audits P9): pirms piespiedu CSP vajag redzēt, ko politika
 * bloķētu nedēļas griezumā. Glabā Redis (tas pats Upstash/KV, kas rate limitam) hash laukā
 * `direktīva|bloķētais hosts|lapas hosts` -> skaits. Bez Redis nedara neko (žurnāls paliek).
 */
import { resolveRateLimitRedis } from "@/lib/rate-limit";
import type { CspReportSummary } from "@/lib/csp";

const KEY_PREFIX = "provin:csp:";
const TTL_SECONDS = 14 * 24 * 60 * 60;
const TIMEOUT_MS = 400;

export function cspReportDayKey(now: Date = new Date()): string {
  return `${KEY_PREFIX}${now.toISOString().slice(0, 10)}`;
}

export function cspReportField(summary: CspReportSummary): string {
  return [summary.violatedDirective, summary.blockedUri, summary.documentHost]
    .map((part) => part.replace(/\|/g, "/"))
    .join("|")
    .slice(0, 260);
}

/** HINCRBY + EXPIRE vienā pipeline; kļūda vai taimauts netiek mests tālāk. */
export async function recordCspReport(
  summary: CspReportSummary,
  opts: { env?: NodeJS.ProcessEnv; fetchImpl?: typeof fetch; now?: Date } = {},
): Promise<boolean> {
  const cfg = resolveRateLimitRedis(opts.env);
  if (!cfg) return false;
  const key = cspReportDayKey(opts.now);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await (opts.fetchImpl ?? fetch)(`${cfg.url}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
      body: JSON.stringify([
        ["HINCRBY", key, cspReportField(summary), "1"],
        ["EXPIRE", key, String(TTL_SECONDS)],
      ]),
      cache: "no-store",
      signal: ctrl.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export type CspReportDay = { day: string; counts: Record<string, number> };

/** Pēdējo `days` dienu kopsavilkums adminam (HGETALL katrai dienai). Bez Redis - `null`. */
export async function readCspReportDays(
  days = 7,
  opts: { env?: NodeJS.ProcessEnv; fetchImpl?: typeof fetch; now?: Date } = {},
): Promise<CspReportDay[] | null> {
  const cfg = resolveRateLimitRedis(opts.env);
  if (!cfg) return null;
  const now = opts.now ?? new Date();
  const keys = Array.from({ length: Math.min(Math.max(days, 1), 14) }, (_, i) =>
    cspReportDayKey(new Date(now.getTime() - i * 86_400_000)),
  );
  const res = await (opts.fetchImpl ?? fetch)(`${cfg.url}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(keys.map((k) => ["HGETALL", k])),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { result?: unknown }[];
  return keys.map((key, i) => {
    const flat = Array.isArray(data?.[i]?.result) ? (data[i].result as unknown[]) : [];
    const counts: Record<string, number> = {};
    for (let j = 0; j + 1 < flat.length; j += 2) counts[String(flat[j])] = Number(flat[j + 1]) || 0;
    return { day: key.slice(KEY_PREFIX.length), counts };
  });
}
