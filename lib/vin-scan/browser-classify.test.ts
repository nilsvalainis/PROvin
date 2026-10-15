import { describe, expect, it } from "vitest";

import { VIN_SCAN_BROWSER_CATALOG, VIN_SCAN_BROWSER_IDS, VIN_SCAN_SOURCE_IDS } from "@/lib/vin-scan/catalog";
import {
  browserProbeBlocker,
  classifyBrowserProbe,
  classifyCheckcarPhotos,
  isBrowserChallenge,
} from "@/lib/vin-scan/browser-classify";

const VIN = "WBA5R1C0XLFH42873";

describe("pārlūka katalogs", () => {
  it("id ir servera kataloga apakškopa un URL satur VIN", () => {
    expect(VIN_SCAN_BROWSER_CATALOG.map((s) => s.id)).toEqual([...VIN_SCAN_BROWSER_IDS]);
    for (const id of VIN_SCAN_BROWSER_IDS) {
      expect(VIN_SCAN_SOURCE_IDS.includes(id)).toBe(true);
    }
    expect(VIN_SCAN_BROWSER_CATALOG.find((s) => s.id === "stat_vin")?.openUrl(VIN)).toContain(VIN);
    expect(VIN_SCAN_BROWSER_CATALOG.find((s) => s.id === "carfax_eu")?.openUrl(VIN)).toContain("preview-page");
    expect(VIN_SCAN_BROWSER_CATALOG.find((s) => s.id === "plc_auction")?.openUrl(VIN)).toBe(
      `https://plc.auction/?vin=${VIN}`,
    );
    expect(VIN_SCAN_BROWSER_CATALOG.find((s) => s.id === "lt_itpr")?.openUrl(VIN)).toContain("epolicija.lt");
  });
});

describe("classifyBrowserProbe", () => {
  it("Cloudflare vēl nav rezultāts", () => {
    expect(isBrowserChallenge("Just a moment...")).toBe(true);
    expect(browserProbeBlocker("Please verify you are human")).toBe("cloudflare");
    expect(classifyBrowserProbe("stat_vin", "Just a moment...", VIN)).toBeNull();
  });

  it("izsoles un CARFAX priekšskatījums", () => {
    expect(classifyBrowserProbe("stat_vin", `Lot sold ${VIN} odometer 120000`, VIN)?.status).toBe("found");
    expect(classifyBrowserProbe("stat_vin", "Page not found", VIN)?.status).toBe("none");
    expect(
      classifyBrowserProbe("stat_vin", "Search… No results. Popular cars: No similar cars were found at the auction. 2021 BMW 330I Lot: 45129191", VIN)
        ?.status,
    ).toBe("none");
    expect(classifyBrowserProbe("stat_vin", `RAM 2500 2026 VIN: ${VIN} Sale History (13) Auction Date Final Bid Copart`, VIN)?.status).toBe(
      "found",
    );
    expect(classifyBrowserProbe("carfax_eu", "Success! We found 4 records for this car", VIN)).toMatchObject({
      status: "found",
      summary: "4 ieraksti CARFAX priekšskatījumā",
    });
    expect(classifyBrowserProbe("carfax_eu", "No records found for this VIN", VIN)?.status).toBe("none");
    expect(classifyBrowserProbe("carfax_eu", "Check a car record by record", VIN)).toBeNull();
  });

  it("captcha paliek gaidīšana, CheckCar foto skaita atsevišķi", () => {
    expect(browserProbeBlocker("Please complete the reCAPTCHA")).toBe("captcha");
    expect(classifyBrowserProbe("auchistory", "I'm not a robot", VIN)).toBeNull();
    expect(
      classifyBrowserProbe(
        "bid_cars",
        "Welcome to the auction archive. Browse featured vehicles and recent sale photos from the last week.",
        VIN,
      ),
    ).toMatchObject({ status: "unknown", summary: expect.stringMatching(/bez VIN/) });
    expect(classifyBrowserProbe("poctra", "Search", VIN)).toBeNull();
    expect(classifyCheckcarPhotos(3, false)).toMatchObject({ status: "found", summary: "3 foto" });
    expect(classifyCheckcarPhotos(0, false)).toBeNull();
    expect(classifyCheckcarPhotos(0, true)?.status).toBe("none");
    expect(classifyBrowserProbe("checkcar_vin", "No photos available", VIN)?.status).toBe("none");
    expect(classifyBrowserProbe("checkcar_vin", `${VIN} auction gallery 4 photos`, VIN)?.summary).toBe("4 foto");
  });

  it("plc.auction lots un tukšs meklējums", () => {
    expect(classifyBrowserProbe("plc_auction", "Sorry, could not find what you were looking for..", VIN)).toMatchObject({
      status: "none",
      summary: "Nav ierakstu",
    });
    expect(
      classifyBrowserProbe("plc_auction", "SKODA SUPERB, 2012 (LOT №: 111) Location: LV, Riga Updated: 2024-01-02", VIN)?.status,
    ).toBe("found");
  });
});
