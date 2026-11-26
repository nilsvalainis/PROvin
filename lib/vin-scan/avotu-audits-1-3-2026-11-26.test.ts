/**
 * 26.11 VIN SCAN avotu audita labojumi 1-3 (zurnals/vin-scan-avotu-audits-2026-11-26.md):
 * 1) saišu avoti bez automātikas un CapSolver, 2) NICB tikai ASV, 3) vPIC modelis nav galvenais.
 */
import { describe, expect, it } from "vitest";

import { atraStoryScore, atraVisibleFacts, buildAtraFacts, type AtraFactRow } from "@/lib/atra-parbaude-facts";
import { VIN_SCAN_LINK_ONLY_IDS, vinScanPipelineSourceIds, vinScanSourceLinkOnly } from "@/lib/vin-scan/catalog";
import { freeVinScanSourceIds, vinScanAutoSourceIds } from "@/lib/vin-scan/free-sources";
import { vinScanLinkOnlyRowVisible, vinScanManualLinks } from "@/lib/vin-scan/manual-links";
import { buildVinScanFacts, pickVinScanVehicle } from "@/lib/vin-scan/summary";
import { createVinScanVehicleHint } from "@/lib/vin-scan/vehicle-hint";
import { vinScanSourceAppliesToVin } from "@/lib/vin-scan/wanted";

const VOLVO_VIN = "YV1FW7BCDE1234567";
const VW_DE_VIN = "WVWZZZ3CZEE123456";
const US_VIN = "1FTFW1ET5DFC10312";

const NICB_OVERVIEW = { id: "nicb", label: "NICB", status: "found" as const, summary: "NICB: iespējams zagts", flags: { stolen: true } };

function factsFor(vin: string, rows: AtraFactRow[]) {
  return buildAtraFacts({ vin, plate: "", title: "", year: "", rows, dealer: null, csdd: null, hasListing: false });
}

describe("1. saišu avoti (0 trāpījumu / CapSolver bez rezultāta / dublikāts)", () => {
  it("netiek palaisti automātiski: ne VIN SCAN, ne Ātrā pārbaude, ne pasūtījuma auto-scan", () => {
    for (const id of ["lt_itpr", "auchistory", "nummerplade", "biluppgifter", "stat_vin", "checkcar_vin", "plc_auction", "bidfax", "poctra", "carpass", "traficom", "regitra", "recall_vw", "recall_bmw", "recall_mercedes", "recall_volvo", "recall_toyota"]) {
      expect(vinScanSourceLinkOnly(id), id).toBe(true);
      expect(freeVinScanSourceIds(), id).not.toContain(id);
      expect(vinScanPipelineSourceIds(), id).not.toContain(id);
    }
    // Arī tad, ja izsaucējs tos nosauc skaidri (vecs klients / pasūtījuma saraksts).
    expect(vinScanAutoSourceIds({ sourceIds: ["lt_itpr", "auchistory", "csdd"] })).toEqual(["csdd"]);
    // Strādājošie avoti paliek.
    for (const id of ["csdd", "tjekbil", "mnt_ee", "lkf_ee", "carinfo", "carfax_eu", "bid_cars", "autodna_precheck"]) {
      expect(freeVinScanSourceIds(), id).toContain(id);
    }
  });

  it("paliek kā saites «Atvērt pārlūkā»: ražotāja atsaukums tikai pēc WMI markas, nummerplade bez dublēšanas", () => {
    const links = vinScanManualLinks(VOLVO_VIN);
    const ids = links.map((l) => l.id);
    expect(ids).toContain("auchistory");
    expect(ids).toContain("lt_itpr");
    expect(ids).toContain("stat_vin");
    expect(ids).toContain("recall_volvo");
    expect(ids).not.toContain("recall_bmw");
    expect(ids).not.toContain("recall_vw");
    expect(links.every((l) => /^https:\/\//.test(l.href))).toBe(true);
    expect(links.find((l) => l.id === "auchistory")?.href).toContain("auchistory.com");
    expect(vinScanManualLinks("")).toEqual([]);
    expect(VIN_SCAN_LINK_ONLY_IDS.length).toBe(17);
  });

  it("veca momentuzņēmuma «pārlūks» rinda neskaitās, rinda ar reāliem datiem (pārlūka imports) paliek", () => {
    expect(vinScanLinkOnlyRowVisible("stat_vin", "browser_only")).toBe(false);
    expect(vinScanLinkOnlyRowVisible("lt_itpr", "unknown")).toBe(false);
    expect(vinScanLinkOnlyRowVisible("stat_vin", "found")).toBe(true);
    expect(vinScanLinkOnlyRowVisible("csdd", "unknown")).toBe(true);
  });
});

describe("2. NICB tikai ASV auto", () => {
  const nicbStolen: AtraFactRow = {
    id: "nicb",
    label: "NICB",
    country: "US",
    status: "found",
    summary: "NICB: iespējams zagts",
    flags: { stolen: true },
  };

  it("ne-ASV VIN: «Meklēšanā» kartīte neieslēdzas un stāsta potenciāls nesaņem punktus", () => {
    expect(vinScanSourceAppliesToVin("nicb", VW_DE_VIN)).toBe(false);
    const f = factsFor(VW_DE_VIN, [nicbStolen]);
    expect(f.wanted).toEqual([]);
    expect(atraVisibleFacts(f)).not.toContain("wanted");
    expect(atraStoryScore(f).points).toBe(0);
    expect(buildVinScanFacts([NICB_OVERVIEW], VW_DE_VIN).wanted).toEqual([]);
  });

  it("NICB total loss ne-ASV auto arī nedod «Total loss» punktus", () => {
    const f = factsFor(VOLVO_VIN, [{ ...nicbStolen, summary: "NICB: total loss / salvage ieraksts", flags: {} }]);
    expect(f.flags.totalLoss).toBe(false);
  });

  it("ASV VIN: NICB trāpījums paliek", () => {
    expect(vinScanSourceAppliesToVin("nicb", US_VIN)).toBe(true);
    const f = factsFor(US_VIN, [nicbStolen]);
    expect(f.wanted).toEqual(["NICB"]);
    expect(buildVinScanFacts([NICB_OVERVIEW], US_VIN).wanted).toEqual(["NICB"]);
  });

  it("citi avoti (tjekbil, lt_itpr) uz VIN valsti neattiecas", () => {
    expect(vinScanSourceAppliesToVin("tjekbil", VW_DE_VIN)).toBe(true);
    expect(vinScanSourceAppliesToVin("lt_itpr", VW_DE_VIN)).toBe(true);
  });
});

describe("3. vPIC modelis nav galvenais ne-ASV auto", () => {
  const vpicRow = {
    id: "vin_decode",
    status: "found" as const,
    vehicle: { make: "VOLVO", model: "740 Series", year: "2014" },
  };

  it("CSDD / car.info / CARFAX modelis ir pirms vPIC", () => {
    expect(
      pickVinScanVehicle([vpicRow, { id: "csdd", status: "found", vehicle: { make: "VOLVO", model: "V60", year: "2014" } }]),
    ).toEqual({ make: "VOLVO", model: "V60", year: "2014" });
    expect(
      pickVinScanVehicle([vpicRow, { id: "carinfo", status: "found", vehicle: { make: "Volvo", model: "V60", year: "2014" } }])?.model,
    ).toBe("V60");
    expect(
      pickVinScanVehicle([vpicRow, { id: "carfax_eu", status: "found", vehicle: { make: "VOLVO", model: "V60", year: "" } }])?.model,
    ).toBe("V60");
    // Ja neviens cits auto nenosauc - vPIC paliek rezerve.
    expect(pickVinScanVehicle([vpicRow])?.model).toBe("740 Series");
  });

  it("Safety Gate gaida tā paša skenējuma reģistru modeli (CSDD), nevis vPIC", async () => {
    const hint = createVinScanVehicleHint(["vin_decode", "csdd", "tjekbil", "eu_safety_gate"], { waitMs: 2_000 });
    const pending = hint.wait();
    hint.report(vpicRow);
    hint.report({ id: "csdd", status: "found", vehicle: { make: "VOLVO", model: "V60", year: "2014" } });
    // CSDD ir pirmais rangā un ar modeli - tjekbil nav jāgaida.
    await expect(pending).resolves.toEqual({ make: "VOLVO", model: "V60", year: "2014" });
  });

  it("bez reģistru avotiem hint uzreiz ir null (vPIC rezerve probe pusē)", async () => {
    const hint = createVinScanVehicleHint(["vin_decode", "eu_safety_gate"], { waitMs: 5_000 });
    await expect(hint.wait()).resolves.toBeNull();
  });
});
