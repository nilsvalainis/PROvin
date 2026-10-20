import { describe, expect, it, vi } from "vitest";
import { checkRateLimit, resolveRateLimitRedis } from "./rate-limit";

const env = { UPSTASH_REDIS_REST_URL: "https://redis.example", UPSTASH_REDIS_REST_TOKEN: "t" } as unknown as NodeJS.ProcessEnv;

function redisReply(count: number, ttl = 5000) {
  return vi.fn(async () => new Response(JSON.stringify([{ result: count }, { result: 1 }, { result: ttl }]), { status: 200 }));
}

describe("shared rate limit", () => {
  it("is disabled without Redis env", () => {
    expect(resolveRateLimitRedis({} as NodeJS.ProcessEnv)).toBeNull();
    expect(resolveRateLimitRedis({ KV_REST_API_URL: "http://x", KV_REST_API_TOKEN: "t" } as unknown as NodeJS.ProcessEnv)).toBeNull();
  });

  it("blocks when the shared counter exceeds max", async () => {
    const fetchImpl = redisReply(6, 12_000);
    const r = await checkRateLimit(`t-${Math.random()}`, 5, 60_000, { env, fetchImpl });
    expect(r).toEqual({ ok: false, retryAfterSec: 12 });
    const body = JSON.parse((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body[0][1]).toMatch(/^provin:rl:[0-9a-f]{40}$/);
  });

  it("allows under max and falls back to memory on Redis errors", async () => {
    expect(await checkRateLimit(`t-${Math.random()}`, 5, 60_000, { env, fetchImpl: redisReply(2) })).toEqual({ ok: true });
    const failing = vi.fn(async () => {
      throw new Error("down");
    });
    expect(await checkRateLimit(`t-${Math.random()}`, 5, 60_000, { env, fetchImpl: failing })).toEqual({ ok: true });
  });

  it("still enforces the local limit", async () => {
    const key = `t-${Math.random()}`;
    for (let i = 0; i < 2; i++) expect((await checkRateLimit(key, 2, 60_000)).ok).toBe(true);
    expect((await checkRateLimit(key, 2, 60_000)).ok).toBe(false);
  });
});
