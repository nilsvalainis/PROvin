import { describe, expect, it } from "vitest";

import {
  VIN_SCAN_BROWSER_FETCH_IDS,
  browserFetchAwaiting,
  browserFetchHandoff,
  browserFetchLane,
  browserFetchSummary,
  browserFetchToken,
  browserImportErrorLv,
  parseVinScanBrowserEventDetail,
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

  it("handoff atribūti Tampermonkey: visi from-browser avoti, found paliek ārā", () => {
    const at = "2026-10-16T10:00:00.000Z";
    const vin = "WBA5R1C0XLFH42873";
    const awaiting = VIN_SCAN_BROWSER_FETCH_IDS.map((id) => ({
      id,
      status: "browser_only" as const,
      summary: browserFetchSummary(id),
    }));
    const handoff = browserFetchHandoff(vin, at, [
      ...awaiting,
      { id: "csdd", status: "found", summary: "CSDD" },
      { id: "carvertical", status: "manual", summary: "Līdz pogai" },
    ]);
    expect(handoff?.token).toBe(`${vin}:${at}`);
    expect(handoff?.ids).toEqual([...VIN_SCAN_BROWSER_FETCH_IDS]);
    expect(handoff?.attrs["data-provin-browser-fetch"]).toBe(`${vin}:${at}`);
    expect(handoff?.attrs["data-provin-browser-fetch-ids"]).toBe(VIN_SCAN_BROWSER_FETCH_IDS.join(","));
    expect(handoff?.attrs["data-provin-stat-vin-fetch"]).toBe(`${vin}:${at}`);
    expect(
      browserFetchHandoff(vin, at, [{ id: "stat_vin", status: "found", summary: browserFetchSummary("stat_vin") }]),
    ).toBeNull();
    expect(browserFetchHandoff(vin, "", awaiting)).toBeNull();
  });

  it("handoff bez stat.vin neliek stat.vin atribūtu", () => {
    const handoff = browserFetchHandoff("WBA5R1C0XLFH42873", "2026-10-16T10:00:00.000Z", [
      { id: "nicb", status: "browser_only", summary: browserFetchSummary("nicb") },
    ]);
    expect(handoff?.ids).toEqual(["nicb"]);
    expect(handoff?.attrs["data-provin-stat-vin-fetch"]).toBeUndefined();
    expect(handoff?.attrs["data-provin-browser-fetch-ids"]).toBe("nicb");
  });

  it("provin-vin-scan-result notikums: HTML vai found/none, ne tukšs unknown", () => {
    expect(parseVinScanBrowserEventDetail(null)).toBeNull();
    expect(parseVinScanBrowserEventDetail({ id: "stat_vin", vin: "WBA5R1C0XLFH42873", status: "unknown" })).toBeNull();
    expect(
      parseVinScanBrowserEventDetail({
        id: "stat_vin",
        vin: " wba5r1c0xlfh42873 ",
        status: "unknown",
        html: "<html>ok</html>",
        pageUrl: "https://stat.vin/cars/WBA5R1C0XLFH42873",
        httpStatus: 200,
      }),
    ).toEqual({
      id: "stat_vin",
      vin: "WBA5R1C0XLFH42873",
      status: "unknown",
      summary: "",
      html: "<html>ok</html>",
      pageUrl: "https://stat.vin/cars/WBA5R1C0XLFH42873",
      httpStatus: 200,
    });
    expect(
      parseVinScanBrowserEventDetail({
        id: "nicb",
        vin: "WBA5R1C0XLFH42873",
        status: "none",
        summary: "Nav datu (pārlūkā)",
      }),
    ).toMatchObject({ id: "nicb", status: "none", html: "" });
    expect(
      parseVinScanBrowserEventDetail({
        id: "stat_vin",
        vin: "WBA5R1C0XLFH42873",
        status: "unknown",
        html: "<html>ok</html>",
        finalUrl: "https://stat.vin/car-not-found",
      })?.pageUrl,
    ).toBe("https://stat.vin/car-not-found");
    expect(browserImportErrorLv("page_not_ready")).toMatch(/Lapa vēl nav gatava/);
    expect(browserImportErrorLv("vin_mismatch")).toMatch(/VIN lapā nesakrīt/);
    expect(browserImportErrorLv("write_failed")).toMatch(/saglabāt/);
  });
});
