import { describe, expect, it } from "vitest";

import {
  VIN_SCAN_CATALOG,
  VIN_SCAN_REMOVED_IDS,
  VIN_SCAN_SOURCE_IDS,
  defaultVinScanSourceIds,
  vinScanFastSourceIds,
  vinScanPipelineSourceIds,
} from "@/lib/vin-scan/catalog";
import { parseCsddTechDataXml } from "@/lib/csdd-tech-data";
import { emptyVinSourceResult } from "@/lib/vin-sources/types";
import {
  classifyCheckcarVinText,
  classifyPlcAuction,
  dsbScanFromParts,
  esynVehicleSummary,
  formatCsddPlateLookup,
  parseCarpassCsrf,
  parseCarpassRecalls,
  parseCsddTechScan,
  parseDsbEntryCount,
  parseDsbSearchHtml,
  parseEsynChassis,
  parseEsynInspections,
  parseNhtsaDecode,
  parseNummerpladeHtml,
  parseNummerpladeProbe,
  parseTjekbilProbe,
  parseVinSourceScan,
  vehicleFromPlcTitle,
} from "@/lib/vin-scan/parse";
import { countVinScanStatuses } from "@/lib/vin-scan/types";

const DK_VIN = "VF12RFL1H49621453";

describe("vin scan catalog", () => {
  it("katalogā ir unikāli VIN SCAN avoti, bez izņemtajiem maksas avotiem; WMI dekodēšana paliek", () => {
    expect(VIN_SCAN_CATALOG.map((s) => s.id)).toEqual([...VIN_SCAN_SOURCE_IDS]);
    expect(new Set(VIN_SCAN_SOURCE_IDS).size).toBe(VIN_SCAN_SOURCE_IDS.length);
    expect(VIN_SCAN_SOURCE_IDS).toContain("vin_decode");
    expect(VIN_SCAN_SOURCE_IDS[0]).toBe("vin_decode");
    expect(VIN_SCAN_SOURCE_IDS).toContain("tjekbil");
    expect(VIN_SCAN_SOURCE_IDS).toContain("csdd");
    expect(VIN_SCAN_SOURCE_IDS).toContain("nummerplade");
    expect(VIN_SCAN_SOURCE_IDS).toContain("carinfo");
    expect(VIN_SCAN_SOURCE_IDS).toContain("lkf_ee");
    expect(VIN_SCAN_SOURCE_IDS).toContain("rdw");
    expect(VIN_SCAN_SOURCE_IDS).toContain("nhtsa_recalls");
    expect(VIN_SCAN_SOURCE_IDS).toContain("bidfax");
    expect(VIN_SCAN_SOURCE_IDS).toContain("listing_history");
    expect(VIN_SCAN_CATALOG.find((s) => s.id === "traficom")?.needs).toEqual(["vin"]);
    expect(VIN_SCAN_SOURCE_IDS).not.toContain("vp_wanted");
    expect(VIN_SCAN_SOURCE_IDS).not.toContain("uk_mot");
    expect(VIN_SCAN_CATALOG.find((s) => s.id === "nummerplade")?.openUrl("WVWZZZ7NZEV015204")).toContain(
      "/stelnummer/wvwzzz7nzev015204.html",
    );
    expect(defaultVinScanSourceIds()).toEqual([...VIN_SCAN_SOURCE_IDS]);
    expect(vinScanPipelineSourceIds()).toEqual([...VIN_SCAN_SOURCE_IDS]);
    expect(vinScanFastSourceIds()).toEqual([...VIN_SCAN_SOURCE_IDS]);
    for (const removed of VIN_SCAN_REMOVED_IDS) {
      expect(VIN_SCAN_SOURCE_IDS).not.toContain(removed);
    }
  });

  it("katram servera avotam ir VIN meklēšanas URL", () => {
    const vin = "WBA5R1C0XLFH42873";
    for (const item of VIN_SCAN_CATALOG) {
      const url = item.openUrl(vin);
      expect(url).toMatch(/^https:\/\//);
      if (item.needs.includes("listing") && !item.needs.includes("vin")) continue;
      expect(url.toUpperCase()).toContain(vin);
    }
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
    expect(chassis).toMatchObject({ ok: true, vehicle: { make: "Renault", model: "Captur", plate: "AB12345" } });
    const inspections = parseEsynInspections(
      JSON.stringify({
        inspection: [
          { date: "2025-08-22T15:45:00Z", conclusion: "GOD", odometer: 385, exactOdometer: 385537 },
          { date: "2022-02-02T12:13:00Z", conclusion: "OOM", odometer: 320, exactOdometer: null },
        ],
      }),
    );
    expect(inspections.count).toBe(2);
    expect(inspections.inspections).toHaveLength(2);
    expect(inspections.inspections?.[0]?.result).toBe("izturēta");
    expect(inspections.inspections?.[0]?.odometer).toContain("385");
    expect(inspections.summary).toContain("izturēta");
    expect(inspections.detail).toContain("385");
    expect(inspections.detail).toContain("320");
    if (!chassis.ok) throw new Error("expected vehicle");
    const merged = esynVehicleSummary(chassis.vehicle, inspections);
    expect(merged.status).toBe("found");
    expect(merged.summary).toContain("Renault Captur");
  });

  it("neatpazīts VIN ir tukšs avots", () => {
    const miss = parseEsynChassis(404, JSON.stringify({ error: "Resultatet findes ikke" }), DK_VIN);
    expect(miss.ok).toBe(false);
    if (miss.ok) return;
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

describe("nummerplade probe", () => {
  it("mapē found un kvotu", () => {
    expect(parseNummerpladeProbe(200, "{}", true, "nummerplade.net: VW Golf").status).toBe("found");
    expect(parseNummerpladeProbe(429, "", false, "").summary).toContain("limits");
    expect(parseNummerpladeProbe(404, "", false, "").status).toBe("none");
  });

  it("nolasa publisko HTML bez API atslēgas", () => {
    const html = `
      <html><body>
        <dl>
          <dt>Mærke</dt><dd>Volkswagen</dd>
          <dt>Model</dt><dd>Sharan</dd>
          <dt>Nummerplade</dt><dd>CM53865</dd>
          <dt>Stelnummer</dt><dd>${DK_VIN}</dd>
        </dl>
      </body></html>
    `;
    const parsed = parseNummerpladeHtml(200, html, DK_VIN);
    expect(parsed.status).toBe("found");
    expect(parsed.summary).toMatch(/Volkswagen/);
    expect(parseNummerpladeHtml(200, "<html><title>Just a moment...</title></html>", DK_VIN).summary).toMatch(/Cloudflare/);
    expect(parseNummerpladeHtml(200, "<p>Ingen køretøjer fundet</p>", DK_VIN).status).toBe("none");
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

describe("CSDD un valstu reģistri", () => {
  it("CSDD found / none / skipped", () => {
    const xml = parseCsddTechDataXml(
      "<TL_DATI><RN>NG8493</RN><VIN>TMBJH9NP9N7043581</VIN><MARKA>SKODA</MARKA><MODELIS>SUPERB</MODELIS><GADS>2012</GADS><TA_LIDZ>14092028</TA_LIDZ></TL_DATI>",
    );
    expect(parseCsddTechScan(xml)).toMatchObject({
      status: "found",
      vehicle: { make: "SKODA", model: "SUPERB", year: "2012" },
    });
    expect(parseCsddTechScan({ found: false, message: "CSDD relejs nav konfigurēts" }).status).toBe("skipped");
    expect(parseCsddTechScan({ found: false, message: "CSDD neatbildēja (HTTP 502)" }).status).toBe("unknown");
    expect(parseCsddTechScan({ found: false, message: "CSDD reģistrā šāds numurs netika atrasts" }).status).toBe("none");
    expect(formatCsddPlateLookup(xml)).toMatchObject({ ok: true, vin: "TMBJH9NP9N7043581", year: "2012" });
  });

  it("Igaunijas / Zviedrijas avotus mapē no fetchVinSource rezultāta", () => {
    const found = emptyVinSourceResult("mnt_ee", DK_VIN, "Atrasts");
    found.found = true;
    found.message = "Atrasts Igaunijas reģistrā (1 nobraukuma ieraksti)";
    found.mileage = [{ date: "2024-03-12", odometer: "145230", country: "Igaunija" }];
    expect(parseVinSourceScan(found)).toMatchObject({ status: "found", mileage: [{ date: "2024-03-12", odometer: "145230" }] });
    expect(parseVinSourceScan(emptyVinSourceResult("mnt_ee", DK_VIN, "VIN nav Igaunijas transportlīdzekļu reģistrā")).status).toBe(
      "none",
    );
    expect(
      parseVinSourceScan(emptyVinSourceResult("lkf_ee", DK_VIN, "Nav CAPSOLVER_API_KEY. Igaunijas reģistrs no servera vajag CapSolver")).status,
    ).toBe("skipped");
    expect(parseVinSourceScan(emptyVinSourceResult("carinfo", DK_VIN, "car.info HTTP ielase neizdevās")).status).toBe("unknown");
    expect(
      parseVinSourceScan(
        emptyVinSourceResult("carinfo", DK_VIN, "car.info meklēšanā šo VIN neatradīja (Zviedrija un citi Nordics)"),
      ).status,
    ).toBe("none");
    const fi = emptyVinSourceResult("carinfo", DK_VIN, "Atrasts");
    fi.found = true;
    fi.message = "Atrasts car.info";
    fi.mileage = [{ date: "2024-03-12", odometer: "120000", country: "Somija" }];
    expect(parseVinSourceScan(fi).detail).toContain("Somija");
  });
});

describe("plc.auction un CheckCar.vin", () => {
  it("nolasa lotu vai Nav ierakstu", () => {
    expect(classifyPlcAuction("Sorry, could not find what you were looking for..")).toMatchObject({
      status: "none",
      summary: "Nav ierakstu",
    });
    const page = `
      Skoda Superb, 2012 (Lot №: 395157146)
      Location: DE, Greifswald
      Updated: 2026-10-11
      Winning bid: 4 200 EUR
      Mileage: 155 000 km
    `;
    const found = classifyPlcAuction(page);
    expect(found?.status).toBe("found");
    expect(found?.summary).toContain("Greifswald");
    expect(found?.summary).toContain("4 200 EUR");
    expect(vehicleFromPlcTitle("Skoda Superb, 2012 (Lot №: 1)")).toEqual({ make: "Skoda", model: "Superb", year: "2012" });
  });

  it("CheckCar.vin found/none no lapas teksta", () => {
    expect(classifyCheckcarVinText("No photos available for this VIN", DK_VIN)?.status).toBe("none");
    expect(classifyCheckcarVinText(`${DK_VIN} Vehicle history report 12 photos`, DK_VIN)).toMatchObject({
      status: "found",
      summary: "12 foto",
    });
    expect(classifyCheckcarVinText("Loading report…", DK_VIN)).toBeNull();
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
        { status: "needs_input" },
      ]),
    ).toMatchObject({ found: 2, none: 1, manual: 1, unknown: 0, skipped: 0, needs_input: 1 });
  });
});
