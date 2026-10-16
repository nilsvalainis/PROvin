import { describe, expect, it } from "vitest";

import {
  STAT_VIN_FROM_BROWSER_SUMMARY,
  statVinAwaitingBrowserFetch,
  statVinBrowserFetchToken,
  statVinBrowserLane,
} from "@/lib/vin-scan/stat-vin-browser";

describe("stat.vin from browser", () => {
  it("servera josla nav 403", () => {
    const lane = statVinBrowserLane();
    expect(lane.status).toBe("browser_only");
    expect(lane.summary).toBe(STAT_VIN_FROM_BROWSER_SUMMARY);
    expect(lane.summary).toMatch(/from browser/);
    expect(lane.summary).not.toMatch(/403|cloudflare|bloķ/i);
  });

  it("ielādi prasa tikai tukšai from-browser joslai", () => {
    expect(statVinAwaitingBrowserFetch({ id: "stat_vin", status: "browser_only", summary: STAT_VIN_FROM_BROWSER_SUMMARY })).toBe(
      true,
    );
    expect(statVinAwaitingBrowserFetch({ id: "stat_vin", status: "found", summary: STAT_VIN_FROM_BROWSER_SUMMARY })).toBe(false);
    expect(statVinAwaitingBrowserFetch({ id: "stat_vin", status: "none", summary: "Nav izsoles ieraksta" })).toBe(false);
    expect(statVinAwaitingBrowserFetch({ id: "stat_vin", status: "unknown", summary: "HTTP 403" })).toBe(false);
    expect(statVinAwaitingBrowserFetch({ id: "bid_cars", status: "browser_only", summary: STAT_VIN_FROM_BROWSER_SUMMARY })).toBe(
      false,
    );
    expect(statVinBrowserFetchToken(" wba5r1c0xlfh42873 ", "2026-10-16T10:00:00.000Z")).toBe(
      "WBA5R1C0XLFH42873:2026-10-16T10:00:00.000Z",
    );
  });
});
