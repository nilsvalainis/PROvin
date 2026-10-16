import { describe, expect, it } from "vitest";

import {
  VIN_SCAN_BROWSER_FETCH_IDS,
  browserFetchAwaiting,
  browserFetchLane,
  browserFetchSummary,
  browserFetchToken,
} from "@/lib/vin-scan/browser-fetch";

describe("VIN SCAN from browser", () => {
  it("deviņi bloķētie avoti un stat.vin ir from browser, bez 403", () => {
    expect(VIN_SCAN_BROWSER_FETCH_IDS).toEqual([
      "stat_vin",
      "bid_cars",
      "bidfax",
      "checkcar_vin",
      "plc_auction",
      "carfax_eu",
      "poctra",
      "lt_itpr",
      "biluppgifter",
      "nicb",
    ]);
    for (const id of VIN_SCAN_BROWSER_FETCH_IDS) {
      const lane = browserFetchLane(id);
      expect(lane.status).toBe("browser_only");
      expect(lane.summary).toBe(browserFetchSummary(id));
      expect(lane.summary).toMatch(/from browser/);
      expect(lane.summary).not.toMatch(/403|cloudflare|bloķ/i);
    }
  });

  it("ielādi prasa tikai tukšai from-browser joslai", () => {
    expect(
      browserFetchAwaiting({ id: "bid_cars", status: "browser_only", summary: browserFetchSummary("bid_cars") }),
    ).toBe(true);
    expect(browserFetchAwaiting({ id: "nicb", status: "found", summary: browserFetchSummary("nicb") })).toBe(false);
    expect(browserFetchAwaiting({ id: "lt_itpr", status: "none", summary: "Nav meklēšanā" })).toBe(false);
    expect(browserFetchAwaiting({ id: "auchistory", status: "browser_only", summary: browserFetchSummary("bid_cars") })).toBe(
      false,
    );
    expect(browserFetchToken(" wba5r1c0xlfh42873 ", "2026-10-16T10:00:00.000Z")).toBe(
      "WBA5R1C0XLFH42873:2026-10-16T10:00:00.000Z",
    );
  });
});
