import { describe, expect, it } from "vitest";

import { VIN_SCAN_CATALOG, VIN_SCAN_SOURCE_IDS } from "@/lib/vin-scan/catalog";
import {
  dsbScanFromParts,
  esynVehicleSummary,
  oneautoScanCopy,
  outvinScanCopy,
  parseCarpassCsrf,
  parseCarpassRecalls,
  parseDsbEntryCount,
  parseDsbSearchHtml,
  parseEsynChassis,
  parseEsynInspections,
  parseNhtsaDecode,
  parseNummerpladeProbe,
  parseTjekbilProbe,
} from "@/lib/vin-scan/parse";
import { countVinScanStatuses } from "@/lib/vin-scan/types";

const DK_VIN = "VF12RFL1H49621453";

describe("vin scan catalog", () => {
  it("katalogā ir unikāli A līmeņa avoti", () => {
    expect(VIN_SCAN_CATALOG.map((s) => s.id)).toEqual([...VIN_SCAN_SOURCE_IDS]);
    expect(new Set(VIN_SCAN_SOURCE_IDS).size).toBe(VIN_SCAN_SOURCE_IDS.length);
  });
});

describe("parseTjekbilProbe", () => {
  it("nolasa reģistrā atrastu auto", () => {
    const parsed = parseTjekbilProbe(
      200,
      JSON.stringify({
        basic: { regNr: "AB12345", stelNr: DK_VIN, status: "Registreret", maerkeTypeNavn: "RENAULT", modelTypeNavn: "Captur" },
      }),
    );
    expect(parsed.status).toBe("found");
    expect(parsed.summary).toContain("RENAULT");
    expect(parsed.summary).toContain("AB12345");
  });

  it("404 ir tukšs avots", () => {
    expect(parseTjekbilProbe(404, "").status).toBe("none");
  });
});

describe("esyn", () => {
  it("izvēlas rindu ar šo VIN un saskaita apskates", () => {
    const chassis = parseEsynChassis(
      200,
      JSON.stringify([
        { registrationNumber: "AB12345", chassisNumber: "OTHER", model: "640 DUKE", make: "KTM" },
        { registrationNumber: "AB12345", chassisNumber: DK_VIN, model: "Captur", make: "Renault" },
      ]),
      DK_VIN,
    );
    expect(chassis).toMatchObject({ vehicle: { make: "Renault", model: "Captur", plate: "AB12345" } });
    const inspections = parseEsynInspections(
      JSON.stringify({
        inspection: [
          { date: "2025-08-22T15:45:00Z", conclusion: "GOD", odometer: 385, exactOdometer: 385537 },
          { date: "2022-02-02T12:13:00Z", conclusion: "OOM", odometer: 320, exactOdometer: null },
        ],
      }),
    );
    expect(inspections.count).toBe(2);
    expect(inspections.summary).toContain("izturēta");
    expect(inspections.detail).toContain("385");
    expect(inspections.detail).toContain("320");
    if (!("vehicle" in chassis)) throw new Error("expected vehicle");
    const merged = esynVehicleSummary(chassis.vehicle, inspections);
    expect(merged.status).toBe("found");
    expect(merged.summary).toContain("Renault Captur");
  });

  it("neatpazīts VIN ir tukšs avots", () => {
    const miss = parseEsynChassis(404, JSON.stringify({ error: "Resultatet findes ikke" }), DK_VIN);
    expect("vehicle" in miss).toBe(false);
    if ("vehicle" in miss) return;
    expect(miss.status).toBe("none");
  });
});

describe("digital servicebook", () => {
  const html = `
    <h2 id="header-car-name" style="text-align: center">Bmw 330i</h2>
    <span class="search-result-country__label">Result for <strong>Global.eu (EU)</strong></span>
    url: '/Search/LoadServices?vin=WBA5R1C0XLFH42873&amp;country=eu',
  `;

  it("nolasa auto, valsti un servisa ceļu", () => {
    expect(parseDsbSearchHtml(html)).toEqual({
      vehicle: "Bmw 330i",
      country: "Global.eu (EU)",
      servicesPath: "/Search/LoadServices?vin=WBA5R1C0XLFH42873&country=eu",
    });
  });

  it("ierakstu skaits nosaka zaļo vai sarkano", () => {
    const search = { vehicle: "Bmw 330i", country: "Global.eu (EU)" };
    expect(parseDsbEntryCount("To view the 14 entries we found, you need to be logged in")).toBe(14);
    expect(parseDsbEntryCount("To view the <strong>0</strong> entries we found")).toBe(0);
    expect(dsbScanFromParts(search, 14).status).toBe("found");
    expect(dsbScanFromParts(search, 0)).toMatchObject({ status: "none", summary: expect.stringContaining("servisa ierakstu nav") });
    expect(dsbScanFromParts({ vehicle: "", country: "" }, 0).summary).toContain("nav Digital Servicebook");
  });
});

describe("car-pass", () => {
  it("nolasa csrf un neatpazītu VIN", () => {
    expect(parseCarpassCsrf('<meta name="_csrf" content="abc+def"/>')).toBe("abc+def");
    expect(parseCarpassRecalls(200, JSON.stringify({ result: "Vehicle unknown", success: false })).status).toBe("none");
  });

  it("atsaukumu saraksts ir atradums", () => {
    const parsed = parseCarpassRecalls(200, JSON.stringify({ result: "ok", success: true, recalls: [{ id: 1 }, { id: 2 }] }));
    expect(parsed.status).toBe("found");
    expect(parsed.summary).toContain("2");
  });
});

describe("nhtsa", () => {
  it("tīrs dekodējums ir atradums", () => {
    const parsed = parseNhtsaDecode(
      200,
      JSON.stringify({
        Results: [{ Make: "BMW", Model: "330i", ModelYear: "2020", ErrorCode: "0", ErrorText: "0 - VIN decoded clean" }],
      }),
    );
    expect(parsed).toMatchObject({ status: "found", summary: "2020 BMW 330i" });
  });

  it("bez ražotāja ir tukšs avots", () => {
    expect(parseNhtsaDecode(200, JSON.stringify({ Results: [{ Make: "", ErrorCode: "6" }] })).status).toBe("none");
  });
});

describe("maksas avoti paliek līdz pogai", () => {
  it("oneauto un outvin nepērk datus", () => {
    expect(oneautoScanCopy(false).status).toBe("skipped");
    expect(oneautoScanCopy(true).status).toBe("manual");
    expect(outvinScanCopy("WBA5R1C0XLFH42873", true).summary).toContain("Eiropas VIN");
    expect(outvinScanCopy("1HGCM82633A123456", true).status).toBe("manual");
    expect(outvinScanCopy("1HGCM82633A123456", false).status).toBe("skipped");
  });

  it("nummerplade limits nav sarkanais", () => {
    expect(parseNummerpladeProbe(429, "", false, "").status).toBe("unknown");
    expect(parseNummerpladeProbe(404, "", false, "").status).toBe("none");
    expect(parseNummerpladeProbe(200, "{}", true, "RENAULT Captur").status).toBe("found");
  });
});

describe("countVinScanStatuses", () => {
  it("saskaita indikatorus", () => {
    expect(
      countVinScanStatuses([
        { status: "found" },
        { status: "found" },
        { status: "none" },
        { status: "manual" },
      ]),
    ).toMatchObject({ found: 2, none: 1, manual: 1, unknown: 0, skipped: 0 });
  });
});
