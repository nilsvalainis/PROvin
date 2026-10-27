import { describe, expect, it, vi } from "vitest";
import { cspReportDayKey, cspReportField, recordCspReport } from "@/lib/csp-report-store";

const summary = { violatedDirective: "script-src-elem", blockedUri: "unpkg.com", documentHost: "www.provin.lv" };
const env = { UPSTASH_REDIS_REST_URL: "https://redis.example", UPSTASH_REDIS_REST_TOKEN: "t" } as NodeJS.ProcessEnv;

describe("recordCspReport", () => {
  it("bez Redis neko nesūta", async () => {
    const fetchImpl = vi.fn();
    expect(await recordCspReport(summary, { env: {} as NodeJS.ProcessEnv, fetchImpl })).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("palielina dienas hash lauku un uzliek termiņu", async () => {
    const fetchImpl = vi.fn(async () => new Response("[]", { status: 200 }));
    const now = new Date("2026-10-28T00:30:00Z");
    expect(await recordCspReport(summary, { env, fetchImpl, now })).toBe(true);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://redis.example/pipeline");
    expect(JSON.parse(String(init.body))).toEqual([
      ["HINCRBY", "provin:csp:2026-10-28", "script-src-elem|unpkg.com|www.provin.lv", "1"],
      ["EXPIRE", "provin:csp:2026-10-28", String(14 * 24 * 60 * 60)],
    ]);
  });

  it("Redis kļūda neizmet izņēmumu", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("down");
    });
    expect(await recordCspReport(summary, { env, fetchImpl })).toBe(false);
  });

  it("lauks neļauj atdalītāju vērtībā", () => {
    expect(cspReportField({ ...summary, blockedUri: "a|b" })).toBe("script-src-elem|a/b|www.provin.lv");
    expect(cspReportDayKey(new Date("2026-01-02T23:00:00Z"))).toBe("provin:csp:2026-01-02");
  });
});

describe("readCspReportDays", () => {
  it("bez Redis atgriež null", async () => {
    const { readCspReportDays } = await import("@/lib/csp-report-store");
    expect(await readCspReportDays(7, { env: {} as NodeJS.ProcessEnv })).toBeNull();
  });

  it("pārvērš HGETALL sarakstu skaitos", async () => {
    const { readCspReportDays } = await import("@/lib/csp-report-store");
    const fetchImpl = vi.fn(async () =>
      Response.json([{ result: ["script-src|unpkg.com|www.provin.lv", "9"] }, { result: [] }]),
    );
    const out = await readCspReportDays(2, { env, fetchImpl, now: new Date("2026-10-28T12:00:00Z") });
    expect(out).toEqual([
      { day: "2026-10-28", counts: { "script-src|unpkg.com|www.provin.lv": 9 } },
      { day: "2026-10-27", counts: {} },
    ]);
  });
});
