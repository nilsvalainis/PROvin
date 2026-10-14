import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  AUCTION_VIN_PROVIDER_COVERAGE,
  COPART_FI_PROVIDER_COVERAGE,
  JOJ_COPART_IAAI_COVERAGE,
  jojSearchVinCoversCopartEu,
  jojSearchVinCoversCopartFi,
  mergeAuctionVinParses,
} from "@/lib/vin-scan/auction-vin-coverage";
import { lotOpenUrl, parseJojSearchVin, venueFromDomain } from "@/lib/vin-scan/parse-joj";

const VIN = "WBA5R1C0XLFH42873";

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
    const providers = readFileSync(path.join(process.cwd(), "lib/vin-scan/auction-vin-providers.ts"), "utf8");
    expect(providers).toMatch(/EXTRA_AUCTION_VIN_PROVIDERS[^=]*= \[\s*\]/);
    expect(providers).toContain("id: \"copart_fi\"");
    const probe = readFileSync(path.join(process.cwd(), "lib/vin-scan/probes-extra.ts"), "utf8");
    expect(probe).toContain("fetchAuctionVinLots");
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
