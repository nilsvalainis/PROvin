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
    expect(out).toEqual({ status: "skipped", summary: "nav konfigurēts" });
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
    expect(out.status).toBe("found");
    expect(out.auctions?.[0]?.venue).toBe("Copart");
    expect(out.jojFacts?.sales[0]?.venue).toBe("Copart");
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
    expect(first.status).toBe("found");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const second = await fetchJojSearchVin(VIN, {
      env: { JOJ_API_KEY: "jk_test" },
      fetchImpl,
      skipRateLimit: true,
      skipDicts: true,
    });
    expect(second.status).toBe("found");
    expect(second.auctions?.[0]?.venue).toBe("Copart");
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const noneVin = "WBA5R1C0XLFH42873";
    const noneFetch = vi.fn(async () => new Response("{}", { status: 404 }));
    const none1 = await fetchJojSearchVin(noneVin, {
      env: { JOJ_API_KEY: "jk_test" },
      fetchImpl: noneFetch,
      skipRateLimit: true,
      skipDicts: true,
    });
    expect(none1).toMatchObject({ status: "none", summary: "nav ierakstu" });
    expect(noneFetch).toHaveBeenCalledTimes(1);
    const none2 = await fetchJojSearchVin(noneVin, {
      env: { JOJ_API_KEY: "jk_test" },
      fetchImpl: noneFetch,
      skipRateLimit: true,
      skipDicts: true,
    });
    expect(none2.status).toBe("none");
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
    expect(found.status).toBe("found");
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
    expect(none.status).toBe("none");
    expect(onlyVin).toHaveBeenCalledTimes(1);
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
    expect(out429.status).toBe("unknown");
    expect(out429.summary).toMatch(/limits/);
    const none = await fetchJojSearchVin("WBA5R1C0XLFH42873", {
      env: { JOJ_API_KEY: "jk_test" },
      fetchImpl: vi.fn(async () => new Response("{}", { status: 404 })),
      skipCache: true,
      skipRateLimit: true,
      skipDicts: true,
    });
    expect(none.status).toBe("none");
    expect(none.summary).toBe("nav ierakstu");
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
    expect(first.status).toBe("unknown");
    const second = await fetchJojSearchVin(VIN, {
      env: { JOJ_API_KEY: "jk_test" },
      fetchImpl: gateway,
      skipRateLimit: true,
      skipDicts: true,
    });
    expect(second.status).toBe("unknown");
    expect(gateway).toHaveBeenCalledTimes(2);
    await rm(dir, { recursive: true, force: true });
  });
});
