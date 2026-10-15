import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const VIN = "WBSAE0C06PCL70372";

afterEach(() => {
  vi.unstubAllEnvs();
});

function foundBody() {
  return JSON.stringify({
    data: {
      year: 2023,
      manufacturer: { name: "BMW" },
      model: { name: "M8" },
      lots: [
        {
          lot: "94166665",
          domain: { name: "copart_com", id: 3 },
          sale_date: "2026-03-25T15:55:05.000000Z",
          final_bid: 56500,
          damage: { main: { name: "Side" } },
          odometer: { km: 1000 },
          images: { downloaded: ["https://cars2.import-motor.com/a.webp"] },
        },
      ],
    },
  });
}

describe("JoJ API VIN SCAN", () => {
  it("bez JOJ_API_KEY ir nav konfigurēts, ne kļūda", async () => {
    const { jojApiConfigured, jojNotConfiguredParse, fetchJojSearchVin } = await import("@/lib/vin-scan/joj-api");
    expect(jojApiConfigured({})).toBe(false);
    expect(jojApiConfigured({ JOJ_API_KEY: "  " })).toBe(false);
    expect(jojApiConfigured({ JOJ_API_KEY: "jk_test" })).toBe(true);
    expect(jojNotConfiguredParse()).toEqual({ status: "skipped", summary: "nav konfigurēts" });
    const out = await fetchJojSearchVin(VIN, { env: { JOJ_API_KEY: "" } });
    expect(out.parse).toEqual({ status: "skipped", summary: "nav konfigurēts" });
    expect(out.fromCache).toBe(false);
    expect(out.httpStatus).toBeNull();
    expect(out.cachedAt).toBeNull();
  });

  it("sauc GET /search-vin/{vin}?prices_history=1 ar X-JoJAPI-Key pret carstat hostu", async () => {
    const { JOJ_API_DEFAULT_BASE, fetchJojSearchVin } = await import("@/lib/vin-scan/joj-api");
    expect(JOJ_API_DEFAULT_BASE).toBe("https://carstat-copart-iaai.jojapi.net");
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe(`${JOJ_API_DEFAULT_BASE}/search-vin/${VIN}?prices_history=1`);
      expect(init?.method).toBe("GET");
      expect((init?.headers as Record<string, string>)["X-JoJAPI-Key"]).toBe("jk_test");
      expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer jk_test");
      return new Response(foundBody(), { status: 200, headers: { "content-type": "application/json" } });
    });
    const out = await fetchJojSearchVin(VIN, {
      env: { JOJ_API_KEY: "jk_test" },
      fetchImpl,
      skipCache: true,
      skipRateLimit: true,
      skipDicts: true,
    });
    expect(out.parse.status).toBe("found");
    expect(out.fromCache).toBe(false);
    expect(out.httpStatus).toBe(200);
    expect(out.lotsLength).toBe(1);
    expect(out.endpoint).toBe(`/search-vin/${VIN}?prices_history=1`);
    expect(out.parse.auctions?.[0]?.venue).toBe("Copart");
    expect(out.parse.jojFacts?.sales[0]?.venue).toBe("Copart");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("kešs pēc VIN atkārtoti nesauc HTTP, 404 arī kešojas kā nav ierakstu", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "joj-vin-"));
    vi.stubEnv("VIN_SCAN_DIR", dir);
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
    const { fetchJojSearchVin } = await import("@/lib/vin-scan/joj-api");
    const fetchImpl = vi.fn(
      async () => new Response(foundBody(), { status: 200, headers: { "content-type": "application/json" } }),
    );
    const first = await fetchJojSearchVin(VIN, {
      env: { JOJ_API_KEY: "jk_test" },
      fetchImpl,
      skipRateLimit: true,
      skipDicts: true,
    });
    expect(first.parse.status).toBe("found");
    expect(first.fromCache).toBe(false);
    expect(first.httpStatus).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const second = await fetchJojSearchVin(VIN, {
      env: { JOJ_API_KEY: "jk_test" },
      fetchImpl,
      skipRateLimit: true,
      skipDicts: true,
    });
    expect(second.parse.status).toBe("found");
    expect(second.fromCache).toBe(true);
    expect(second.httpStatus).toBe(200);
    expect(second.cachedAt).toBeTruthy();
    expect(second.parse.auctions?.[0]?.venue).toBe("Copart");
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const noneVin = "WBA5R1C0XLFH42873";
    const noneFetch = vi.fn(async () => new Response("{}", { status: 404 }));
    const none1 = await fetchJojSearchVin(noneVin, {
      env: { JOJ_API_KEY: "jk_test" },
      fetchImpl: noneFetch,
      skipRateLimit: true,
      skipDicts: true,
    });
    expect(none1.parse).toMatchObject({ status: "none", summary: "nav ierakstu" });
    expect(none1.fromCache).toBe(false);
    expect(none1.httpStatus).toBe(404);
    expect(noneFetch).toHaveBeenCalledTimes(1);
    const none2 = await fetchJojSearchVin(noneVin, {
      env: { JOJ_API_KEY: "jk_test" },
      fetchImpl: noneFetch,
      skipRateLimit: true,
      skipDicts: true,
    });
    expect(none2.parse.status).toBe("none");
    expect(none2.fromCache).toBe(true);
    expect(none2.httpStatus).toBe(404);
    expect(none2.cachedAt).toBeTruthy();
    expect(noneFetch).toHaveBeenCalledTimes(1);
    await rm(dir, { recursive: true, force: true });
  });

  it("VIN 404 + zināms lots sauc /search-lot; bez lota nesauc", async () => {
    const { JOJ_API_DEFAULT_BASE, fetchJojSearchVin } = await import("@/lib/vin-scan/joj-api");
    const urls: string[] = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      urls.push(url);
      if (url.includes("/search-lot/")) {
        return new Response(foundBody(), { status: 200, headers: { "content-type": "application/json" } });
      }
      return new Response("{}", { status: 404 });
    });
    const found = await fetchJojSearchVin(VIN, {
      env: { JOJ_API_KEY: "jk_test" },
      fetchImpl,
      skipCache: true,
      skipRateLimit: true,
      skipDicts: true,
      listingUrl: "https://www.copart.com/lot/94166665",
    });
    expect(found.parse.status).toBe("found");
    expect(found.fromCache).toBe(false);
    expect(found.httpStatus).toBe(200);
    expect(found.endpoint).toBe("/search-lot/94166665/copart_com?prices_history=1");
    expect(urls[0]).toBe(`${JOJ_API_DEFAULT_BASE}/search-vin/${VIN}?prices_history=1`);
    expect(urls[1]).toBe(`${JOJ_API_DEFAULT_BASE}/search-lot/94166665/copart_com?prices_history=1`);

    const onlyVin = vi.fn(async () => new Response("{}", { status: 404 }));
    const none = await fetchJojSearchVin(VIN, {
      env: { JOJ_API_KEY: "jk_test" },
      fetchImpl: onlyVin,
      skipCache: true,
      skipRateLimit: true,
      skipDicts: true,
    });
    expect(none.parse.status).toBe("none");
    expect(none.httpStatus).toBe(404);
    expect(onlyVin).toHaveBeenCalledTimes(1);
  });

  it("VIN 404 + operatora lots bez sludinājuma saites sauc /search-lot", async () => {
    const { JOJ_API_DEFAULT_BASE, fetchJojSearchVin } = await import("@/lib/vin-scan/joj-api");
    const urls: string[] = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      urls.push(url);
      if (url.includes("/search-lot/")) {
        return new Response(foundBody(), { status: 200, headers: { "content-type": "application/json" } });
      }
      return new Response("{}", { status: 404 });
    });
    const found = await fetchJojSearchVin(VIN, {
      env: { JOJ_API_KEY: "jk_test" },
      fetchImpl,
      skipCache: true,
      skipRateLimit: true,
      skipDicts: true,
      knownLot: { lot: "41872206", domain: "iaai_com" },
    });
    expect(found.parse.status).toBe("found");
    expect(urls[0]).toBe(`${JOJ_API_DEFAULT_BASE}/search-vin/${VIN}?prices_history=1`);
    expect(urls[1]).toBe(`${JOJ_API_DEFAULT_BASE}/search-lot/41872206/iaai_com?prices_history=1`);
    expect(found.endpoint).toBe("/search-lot/41872206/iaai_com?prices_history=1");
  });

  it("429 un 401 nav kešojamas; 404 ir none", async () => {
    const { fetchJojSearchVin, jojParseIsCacheable } = await import("@/lib/vin-scan/joj-api");
    const limited = vi.fn(async () => new Response("{}", { status: 429 }));
    const out429 = await fetchJojSearchVin(VIN, {
      env: { JOJ_API_KEY: "jk_test" },
      fetchImpl: limited,
      skipCache: true,
      skipRateLimit: true,
      skipDicts: true,
    });
    expect(out429.parse.status).toBe("unknown");
    expect(out429.parse.summary).toMatch(/limits/);
    expect(out429.httpStatus).toBe(429);
    expect(out429.fromCache).toBe(false);
    const none = await fetchJojSearchVin("WBA5R1C0XLFH42873", {
      env: { JOJ_API_KEY: "jk_test" },
      fetchImpl: vi.fn(async () => new Response("{}", { status: 404 })),
      skipCache: true,
      skipRateLimit: true,
      skipDicts: true,
    });
    expect(none.parse.status).toBe("none");
    expect(none.parse.summary).toBe("nav ierakstu");
    expect(none.httpStatus).toBe(404);
    expect(jojParseIsCacheable({ status: "none", summary: "nav ierakstu" }, 404)).toBe(true);
    expect(jojParseIsCacheable({ status: "found", summary: "Copart" }, 200)).toBe(true);
    expect(jojParseIsCacheable({ status: "unknown", summary: "JoJ API HTTP 502" }, 502)).toBe(false);
    expect(jojParseIsCacheable({ status: "unknown", summary: "JoJ API limits (1 req/s)" }, 429)).toBe(false);
  });

  it("5xx (bezmaksas gateway) netiek kešots, atkārto HTTP", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "joj-5xx-"));
    vi.stubEnv("VIN_SCAN_DIR", dir);
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
    const { fetchJojSearchVin } = await import("@/lib/vin-scan/joj-api");
    const gateway = vi.fn(async () => new Response("{}", { status: 502 }));
    const first = await fetchJojSearchVin(VIN, {
      env: { JOJ_API_KEY: "jk_test" },
      fetchImpl: gateway,
      skipRateLimit: true,
      skipDicts: true,
    });
    expect(first.parse.status).toBe("unknown");
    expect(first.fromCache).toBe(false);
    const second = await fetchJojSearchVin(VIN, {
      env: { JOJ_API_KEY: "jk_test" },
      fetchImpl: gateway,
      skipRateLimit: true,
      skipDicts: true,
    });
    expect(second.parse.status).toBe("unknown");
    expect(second.fromCache).toBe(false);
    expect(gateway).toHaveBeenCalledTimes(2);
    await rm(dir, { recursive: true, force: true });
  });

  it("404/none kešs beidzas pēc 7 dienām, found paliek 30", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "joj-ttl-"));
    vi.stubEnv("VIN_SCAN_DIR", dir);
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
    const { asJojVinCache, jojVinCacheTtlMs, JOJ_VIN_NONE_CACHE_TTL_MS, JOJ_VIN_CACHE_TTL_MS } =
      await import("@/lib/vin-scan/store");
    expect(jojVinCacheTtlMs({ status: "none", summary: "nav ierakstu" }, 404)).toBe(JOJ_VIN_NONE_CACHE_TTL_MS);
    expect(jojVinCacheTtlMs({ status: "found", summary: "Copart" }, 200)).toBe(JOJ_VIN_CACHE_TTL_MS);
    const now = Date.parse("2026-10-15T12:00:00.000Z");
    const noneOld = asJojVinCache(
      {
        vin: VIN,
        cachedAt: new Date(now - 8 * 24 * 60 * 60 * 1000).toISOString(),
        parse: { status: "none", summary: "nav ierakstu" },
        httpStatus: 404,
      },
      now,
    );
    expect(noneOld).toBeNull();
    const noneFresh = asJojVinCache(
      {
        vin: VIN,
        cachedAt: new Date(now - 6 * 24 * 60 * 60 * 1000).toISOString(),
        parse: { status: "none", summary: "nav ierakstu" },
        httpStatus: 404,
      },
      now,
    );
    expect(noneFresh?.parse.status).toBe("none");
    const foundOld = asJojVinCache(
      {
        vin: VIN,
        cachedAt: new Date(now - 8 * 24 * 60 * 60 * 1000).toISOString(),
        parse: { status: "found", summary: "Copart" },
        httpStatus: 200,
      },
      now,
    );
    expect(foundOld?.parse.status).toBe("found");
    await rm(dir, { recursive: true, force: true });
  });

  it("console.info žurnālā ir VIN, endpoint, status, lots, fromCache, request-id, nav API atslēgas", async () => {
    const { fetchJojSearchVin } = await import("@/lib/vin-scan/joj-api");
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const fetchImpl = vi.fn(
      async () =>
        new Response(foundBody(), {
          status: 200,
          headers: { "content-type": "application/json", "x-request-id": "req-joj-1" },
        }),
    );
    const out = await fetchJojSearchVin(VIN, {
      env: { JOJ_API_KEY: "jk_secret_do_not_log" },
      fetchImpl,
      skipCache: true,
      skipRateLimit: true,
      skipDicts: true,
    });
    expect(out.requestId).toBe("req-joj-1");
    const jojLogs = info.mock.calls.filter((call) => call[0] === "[joj]");
    expect(jojLogs.length).toBeGreaterThan(0);
    const payload = jojLogs[0]?.[1] as Record<string, unknown>;
    expect(payload).toMatchObject({
      vin: VIN,
      endpoint: `/search-vin/${VIN}?prices_history=1`,
      httpStatus: 200,
      lotsLength: 1,
      fromCache: false,
      requestId: "req-joj-1",
    });
    expect(JSON.stringify(payload)).not.toMatch(/jk_secret|X-JoJAPI-Key|Authorization/i);
    info.mockRestore();
  });
});
