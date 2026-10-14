import { afterEach, describe, expect, it, vi } from "vitest";

import { JOJ_API_DEFAULT_BASE, fetchJojSearchVin, jojApiConfigured, jojNotConfiguredParse } from "@/lib/vin-scan/joj-api";

const VIN = "WBSAE0C06PCL70372";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("JoJ API VIN SCAN", () => {
  it("bez JOJ_API_KEY ir nav konfigurēts, ne kļūda", async () => {
    expect(jojApiConfigured({})).toBe(false);
    expect(jojApiConfigured({ JOJ_API_KEY: "  " })).toBe(false);
    expect(jojApiConfigured({ JOJ_API_KEY: "jk_test" })).toBe(true);
    expect(jojNotConfiguredParse()).toEqual({ status: "skipped", summary: "nav konfigurēts" });
    const out = await fetchJojSearchVin(VIN, { env: { JOJ_API_KEY: "" } });
    expect(out).toEqual({ status: "skipped", summary: "nav konfigurēts" });
  });

  it("sauc GET /search-vin/{vin} ar X-JoJAPI-Key un kešo found", async () => {
    vi.stubEnv("VIN_SCAN_DIR", "off");
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe(`${JOJ_API_DEFAULT_BASE}/search-vin/${VIN}`);
      expect(init?.method).toBe("GET");
      expect((init?.headers as Record<string, string>)["X-JoJAPI-Key"]).toBe("jk_test");
      return new Response(
        JSON.stringify({
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
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    const out = await fetchJojSearchVin(VIN, { env: { JOJ_API_KEY: "jk_test", VIN_SCAN_DIR: "off" }, fetchImpl });
    expect(out.status).toBe("found");
    expect(out.auctions?.[0]?.venue).toBe("Copart");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
