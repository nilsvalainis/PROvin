import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  AUCTION_VIN_PROVIDER_COVERAGE,
  COPART_FI_PROVIDER_COVERAGE,
  JOJ_COPART_IAAI_COVERAGE,
  THECARAPI_EU_COVERAGE,
  jojSearchVinCoversCopartEu,
  jojSearchVinCoversCopartFi,
  mergeAuctionVinParses,
} from "@/lib/vin-scan/auction-vin-coverage";
import {
  EXTRA_AUCTION_VIN_PROVIDERS,
  configuredExtraAuctionVinProviders,
  fetchAuctionVinLots,
} from "@/lib/vin-scan/auction-vin-providers";
import { JOJ_API_DEFAULT_BASE } from "@/lib/vin-scan/joj-api";
import { lotOpenUrl, parseJojSearchVin, venueFromDomain } from "@/lib/vin-scan/parse-joj";
import { emptyVinScanPlates } from "@/lib/vin-scan/plates";
import { vinScanProbeFor } from "@/lib/vin-scan/probes";

const VIN = "WBA5R1C0XLFH42873";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("JoJ / Copart FI coverage", () => {
  it("JoJ /search-vin nesedz copart.fi / EU", () => {
    expect(jojSearchVinCoversCopartFi()).toBe(false);
    expect(jojSearchVinCoversCopartEu()).toBe(false);
    expect(JOJ_COPART_IAAI_COVERAGE.region).toBe("us_ca");
    expect(JOJ_COPART_IAAI_COVERAGE.lotDomains).toEqual(["copart_com", "iaai_com"]);
    expect(JOJ_COPART_IAAI_COVERAGE.sites).not.toContain("copart.fi");
    expect(COPART_FI_PROVIDER_COVERAGE.implemented).toBe(false);
    expect(COPART_FI_PROVIDER_COVERAGE.sites).toEqual(["copart.fi"]);
    expect(AUCTION_VIN_PROVIDER_COVERAGE.map((p) => p.id)).toEqual(["joj_copart_iaai", "copart_fi"]);
    expect(THECARAPI_EU_COVERAGE.id).toBe("thecarapi_eu");
    expect(THECARAPI_EU_COVERAGE.implemented).toBe(true);
    expect(THECARAPI_EU_COVERAGE.sites).toEqual(["auto1", "openlane", "bca", "autorola", "dealercars", "encar", "ecarstrade"]);
    expect(THECARAPI_EU_COVERAGE.sites).not.toContain("copart.com");
  });

  it("Copart/IAAI flīze sauc tikai JoJ; papildu (Copart FI, thecarapi) klientu aiz tās nav", async () => {
    expect(EXTRA_AUCTION_VIN_PROVIDERS).toEqual([]);
    expect(configuredExtraAuctionVinProviders({ JOJ_API_KEY: "jk_test", THECARAPI_API_KEY: "tk_test" })).toEqual([]);
    /* JoJ kešs šajā testā nedrīkst rakstīt projekta mapē. */
    vi.stubEnv("VIN_SCAN_DIR", "off");
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
    const urls: string[] = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      urls.push(String(input));
      return new Response(
        JSON.stringify({
          data: { lots: [{ lot: "94166665", domain: { name: "copart_com", id: 3 }, sale_date: "2026-03-25T15:55:05.000000Z", final_bid: 56500 }] },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    const parse = await fetchAuctionVinLots(VIN, {
      env: { JOJ_API_KEY: "jk_test", THECARAPI_API_KEY: "tk_test" },
      fetchImpl,
      skipCache: true,
      skipRateLimit: true,
      skipDicts: true,
    });
    expect(parse.status).toBe("found");
    expect(parse.auctions?.map((a) => a.venue)).toEqual(["Copart"]);
    expect(urls).toHaveLength(1);
    for (const url of urls) {
      expect(url.startsWith(`${JOJ_API_DEFAULT_BASE}/`), url).toBe(true);
      expect(url).not.toMatch(/thecarapi|copart\.fi/i);
    }
  });

  it("bez JoJ atslēgas flīze ir 'nav konfigurēts' un tīklā neiet", async () => {
    const fetchImpl = vi.fn();
    expect(await fetchAuctionVinLots(VIN, { env: {}, fetchImpl })).toEqual({ status: "skipped", summary: "nav konfigurēts" });
    expect(fetchImpl).not.toHaveBeenCalled();
    /* VIN SCAN zonde šai flīzei iet caur to pašu ceļu. */
    vi.stubEnv("JOJ_API_KEY", "");
    vi.stubEnv("VIN_SCAN_DIR", "off");
    const fetchSpy = vi.fn(async () => {
      throw new Error("tīkls nav atļauts");
    });
    vi.stubGlobal("fetch", fetchSpy);
    const row = await vinScanProbeFor("joj_copart_iaai")!({ vin: VIN, plates: emptyVinScanPlates(), listingUrl: "" });
    expect(row).toMatchObject({ id: "joj_copart_iaai", status: "skipped", summary: "nav konfigurēts" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("copart_fi domain un FI location ir Copart FI, saite uz copart.fi", () => {
    expect(venueFromDomain({ name: "copart_fi" })).toBe("Copart FI");
    expect(venueFromDomain({ name: "copart_com", id: 3 })).toBe("Copart");
    expect(venueFromDomain({ name: "copart_com", id: 3 }, { country: { iso: "fi" } })).toBe("Copart FI");
    expect(lotOpenUrl("Copart FI", "12345", VIN)).toContain("copart.fi/lot/12345");
    const parsed = parseJojSearchVin({
      status: 200,
      json: {
        data: {
          lots: [
            {
              lot: "88001122",
              domain: { name: "copart_fi" },
              sale_date: "2026-04-01T10:00:00.000000Z",
              final_bid: 4200,
              odometer: { km: 180000 },
              damage: { main: { name: "Front End" } },
              images: { downloaded: ["https://www.copart.fi/photo/a.jpg"] },
            },
          ],
        },
      },
      vin: VIN,
    });
    expect(parsed.auctions?.[0]).toMatchObject({ venue: "Copart FI", date: "2026-04-01" });
    expect(parsed.auctions?.[0]?.price).toMatch(/4.?200 EUR|4200 EUR/);
    expect(parsed.openUrl).toContain("copart.fi");
  });

  it("merge pievieno Copart FI lots blakus JoJ US, skipped FI neslēpj none", () => {
    const us = parseJojSearchVin({
      status: 200,
      json: {
        data: {
          lots: [
            {
              lot: "94166665",
              domain: { name: "copart_com", id: 3 },
              sale_date: "2026-03-25T15:55:05.000000Z",
              final_bid: 56500,
            },
          ],
        },
      },
      vin: VIN,
    });
    const fi = parseJojSearchVin({
      status: 200,
      json: {
        data: {
          lots: [
            {
              lot: "88001122",
              domain: { name: "copart_fi" },
              sale_date: "2026-04-01T10:00:00.000000Z",
              final_bid: 4200,
            },
          ],
        },
      },
      vin: VIN,
    });
    const merged = mergeAuctionVinParses([us, fi]);
    expect(merged.status).toBe("found");
    expect(merged.auctions?.map((a) => a.venue)).toEqual(["Copart", "Copart FI"]);
    expect(
      mergeAuctionVinParses([{ status: "none", summary: "Nav izsoles ieraksta" }, { status: "skipped", summary: "nav konfigurēts" }])
        .status,
    ).toBe("none");
  });
});
