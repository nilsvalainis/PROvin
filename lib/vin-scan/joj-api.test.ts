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

  it("sauc GET /search-vin/{vin} ar X-JoJAPI-Key", async () => {
    const { JOJ_API_DEFAULT_BASE, fetchJojSearchVin } = await import("@/lib/vin-scan/joj-api");
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe(`${JOJ_API_DEFAULT_BASE}/search-vin/${VIN}`);
      expect(init?.method).toBe("GET");
      expect((init?.headers as Record<string, string>)["X-JoJAPI-Key"]).toBe("jk_test");
      return new Response(foundBody(), { status: 200, headers: { "content-type": "application/json" } });
    });
    const out = await fetchJojSearchVin(VIN, {
      env: { JOJ_API_KEY: "jk_test" },
      fetchImpl,
      skipCache: true,
      skipRateLimit: true,
    });
    expect(out.status).toBe("found");
    expect(out.auctions?.[0]?.venue).toBe("Copart");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("kešs pēc VIN atkārtoti nesauc HTTP", async () => {
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
    });
    expect(first.status).toBe("found");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const second = await fetchJojSearchVin(VIN, {
      env: { JOJ_API_KEY: "jk_test" },
      fetchImpl,
      skipRateLimit: true,
    });
    expect(second.status).toBe("found");
    expect(second.auctions?.[0]?.venue).toBe("Copart");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    await rm(dir, { recursive: true, force: true });
  });

  it("429 un 401 nav kešojamas; 404 ir none", async () => {
    const { fetchJojSearchVin } = await import("@/lib/vin-scan/joj-api");
    const limited = vi.fn(async () => new Response("{}", { status: 429 }));
    const out429 = await fetchJojSearchVin(VIN, {
      env: { JOJ_API_KEY: "jk_test" },
      fetchImpl: limited,
      skipCache: true,
      skipRateLimit: true,
    });
    expect(out429.status).toBe("unknown");
    expect(out429.summary).toMatch(/limits/);
    const none = await fetchJojSearchVin("WBA5R1C0XLFH42873", {
      env: { JOJ_API_KEY: "jk_test" },
      fetchImpl: vi.fn(async () => new Response("{}", { status: 404 })),
      skipCache: true,
      skipRateLimit: true,
    });
    expect(none.status).toBe("none");
  });
});
