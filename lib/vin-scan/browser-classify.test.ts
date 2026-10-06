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
  it("id nesakrīt ar servera avotiem un URL satur VIN, kur tas vajadzīgs", () => {
    expect(VIN_SCAN_BROWSER_CATALOG.map((s) => s.id)).toEqual([...VIN_SCAN_BROWSER_IDS]);
    for (const id of VIN_SCAN_BROWSER_IDS) {
      expect(VIN_SCAN_SOURCE_IDS.includes(id as (typeof VIN_SCAN_SOURCE_IDS)[number])).toBe(false);
    }
    expect(VIN_SCAN_BROWSER_CATALOG.find((s) => s.id === "stat_vin")?.openUrl(VIN)).toContain(VIN);
    expect(VIN_SCAN_BROWSER_CATALOG.find((s) => s.id === "carfax_eu")?.openUrl(VIN)).toContain("preview-page");
    expect(VIN_SCAN_BROWSER_CATALOG.find((s) => s.id === "auto_vin")?.openUrl(VIN)).toContain("checkout?vin=");
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
    expect(classifyBrowserProbe("carfax_eu", "Success! We found 4 records for this car", VIN)).toMatchObject({
      status: "found",
      summary: "4 ieraksti CARFAX priekšskatījumā",
    });
    expect(classifyBrowserProbe("carfax_eu", "No records found for this VIN", VIN)?.status).toBe("none");
    expect(classifyBrowserProbe("carfax_eu", "Check a car record by record", VIN)).toBeNull();
  });

  it("maksas priekšskatījums neapstiprina pirkumu", () => {
    expect(classifyBrowserProbe("autodna_preview", "Atrasti 3 ieraksti. Pirkt atskaiti", VIN)?.summary).toContain(
      "Pirkums paliek operatoram",
    );
    expect(classifyBrowserProbe("autodna_preview", "Dati nav pieejami", VIN)?.status).toBe("none");
    expect(
      classifyBrowserProbe("auto_vin", "We correctly identified your vehicle BMW 330i 2020", VIN),
    ).toMatchObject({ status: "manual" });
    expect(classifyBrowserProbe("carvertical_preview", `${VIN} Mēs atradām datus par šo auto`, VIN)?.status).toBe("found");
  });

  it("captcha paliek gaidīšana, CheckCar foto skaita atsevišķi", () => {
    expect(browserProbeBlocker("Please complete the reCAPTCHA")).toBe("captcha");
    expect(classifyBrowserProbe("auchistory", "I'm not a robot", VIN)).toBeNull();
    expect(classifyCheckcarPhotos(3, false)).toMatchObject({ status: "found", summary: "3 foto" });
    expect(classifyCheckcarPhotos(0, false)).toBeNull();
    expect(classifyCheckcarPhotos(0, true)?.status).toBe("none");
  });
});
