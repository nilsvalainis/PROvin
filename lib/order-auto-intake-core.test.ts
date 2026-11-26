import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createDefaultSourceBlocks, emptyCsddFields } from "@/lib/admin-source-blocks";
import {
  applyVinScanImportsToBlocks,
  buildOrderAutoIntakePush,
  decideOrderAutoIntakeMode,
  orderAutoIntakeLockKey,
  orderAutoIntakeScanInputFromCsdd,
  ORDER_AUTO_INTAKE_FUNCTION_BUDGET_MS,
} from "@/lib/order-auto-intake-core";
import { buildVinScanIndicator } from "@/lib/vin-scan/types";
import { findKfzAtSectionIndex, readKfzAtStore } from "@/lib/kfzgutachten/apply-citi";

const VIN = "WBA5R1C0XLFH42873";
const src = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8");

describe("25.11: VIN SCAN pēc CSDD - numurzīme un 1. reģistrācijas datums", () => {
  it("LV numurzīme un precīzs datums no CSDD bloka", () => {
    const csdd = { ...emptyCsddFields(), registrationNumber: "ab-1234", firstRegistration: "2019-03-12" };
    const r = orderAutoIntakeScanInputFromCsdd(csdd);
    expect(r.plates.lv).toBe("AB1234");
    expect(r.firstRegDate).toBe("12.03.2019");
  });

  it("bez CSDD datiem - tukšs (VIN SCAN iet tikai ar VIN)", () => {
    const r = orderAutoIntakeScanInputFromCsdd(emptyCsddFields());
    expect(r.plates.lv).toBe("");
    expect(r.firstRegDate).toBe("");
    expect(orderAutoIntakeScanInputFromCsdd(null).plates.lv).toBe("");
  });
});

describe("webhook laika budžets (maxDuration 300 s)", () => {
  it("pēc ātras sēklas paliek šajā izsaukumā", () => {
    expect(decideOrderAutoIntakeMode({ elapsedMs: 60_000, canDispatch: true })).toBe("inline");
  });

  it("pēc lēnas sēklas aiziet fona maršrutā", () => {
    expect(decideOrderAutoIntakeMode({ elapsedMs: 200_000, canDispatch: true })).toBe("background");
  });

  it("ja fona maršrutu nevar (ne production) - dara pats, cik laiks atļauj", () => {
    expect(decideOrderAutoIntakeMode({ elapsedMs: 200_000, canDispatch: false })).toBe("inline");
    expect(ORDER_AUTO_INTAKE_FUNCTION_BUDGET_MS).toBe(300_000);
  });

  it("webhook VIN SCAN vairs nepalaiž paralēli sēklai; fona maršruts ar savu 300 s", () => {
    const webhook = src("app/api/webhooks/stripe/route.ts");
    expect(webhook).not.toMatch(/runOrderFreeVinScan\(/);
    expect(webhook).toMatch(/decideOrderAutoIntakeMode/);
    expect(webhook).toMatch(/runOrderAutoIntake\(/);
    const route = src("app/api/cron/order-auto-intake/route.ts");
    expect(route).toMatch(/export const maxDuration = 300/);
    expect(route).toMatch(/orderAutoIntakeRouteGate/);
  });

  it("numurs → VIN (#1248) iet caur to pašu automātiku, nevis atsevišķu VIN SCAN; atslēga pasūtījumam + VIN", () => {
    const plate = src("lib/order-plate-vin-resolve.ts");
    expect(plate).not.toMatch(/runOrderFreeVinScan\(/);
    expect(plate).toMatch(/startOrderAutoIntake\(/);
    const webhook = src("app/api/webhooks/stripe/route.ts");
    expect(webhook).toMatch(/runDownstream: false/);
    const key = orderAutoIntakeLockKey("cs_live_a1B2", "wba5r1c0xlfh42873");
    expect(key).toBe("auto-intake_cs_live_a1B2_WBA5R1C0XLFH42873");
    expect(key).toMatch(/^[a-zA-Z0-9._-]{1,200}$/);
  });

  it("automātika neko nepērk: nav AutoDNA / CarVertical / CARFAX / OneAuto pirkuma izsaukumu", () => {
    const intake = src("lib/order-auto-intake.ts");
    expect(intake).not.toMatch(/purchase|Purchase|pirkt|buyCarfax|oneauto|carvertical-fona|autodna-fona/i);
    expect(intake).not.toMatch(/allowPaid/);
  });
});

describe("imports blokos (tas pats, ko pogas «Importēt»)", () => {
  const auctionRow = buildVinScanIndicator("bidfax", VIN, {
    status: "found",
    summary: "1 izsole",
    auctions: [{ date: "2021-05-04", venue: "Copart", price: "4 500 $", odometer: "85 000 km", damage: "Front End" }],
  });
  const csddRow = buildVinScanIndicator("csdd", VIN, {
    status: "found",
    summary: "CSDD",
    vehicle: { make: "BMW", model: "320d", year: "2019" },
  });
  const listingRow = buildVinScanIndicator("listing_history", VIN, {
    status: "found",
    summary: "Sludinājumi",
    listings: [{ date: "01.10.2026", price: "18 400 €", odometer: "120 000 km" }],
  });

  it("izsoles -> Izsoļu portālu arhīvs, CSDD un sludinājums aizpilda tukšo", () => {
    const blocks = createDefaultSourceBlocks();
    const r = applyVinScanImportsToBlocks(blocks, [auctionRow, csddRow, listingRow]);
    expect(r.changed).toBe(true);
    expect(r.sales + r.damages).toBeGreaterThan(0);
    expect(r.blocks.csdd.makeModel).toBe("BMW 320d");
    expect(r.blocks.listing_analysis.listingPasteRaw).toContain("18 400 €");
  });

  it("operatora ievadīto nepārraksta; atkārtots imports neko nemaina", () => {
    const blocks = createDefaultSourceBlocks();
    blocks.csdd = { ...emptyCsddFields(), makeModel: "Operatora teksts" };
    const once = applyVinScanImportsToBlocks(blocks, [csddRow]);
    expect(once.blocks.csdd.makeModel).toBe("Operatora teksts");
    const first = applyVinScanImportsToBlocks(createDefaultSourceBlocks(), [csddRow, listingRow]);
    const again = applyVinScanImportsToBlocks(first.blocks, [csddRow, listingRow]);
    expect(again.changed).toBe(false);
  });

  it("Austrija §57a: atrastais saraksts -> Citi avoti «Austrija · §57a apskates»; atkārtoti nedublē", () => {
    const KVIN = "WBAFB71080LV66575";
    const kfzRow = buildVinScanIndicator("kfz_at", KVIN, {
      status: "found",
      summary: "kfzgutachten.at: 2 atzinumi (13.11.2015, 04.08.2016)",
      inspections: [
        { date: "13.11.2015", plate: "W 44154Z", model: "BMW X5", result: "BMW X5 · W 44154Z" },
        { date: "04.08.2016", plate: "W 81763N", model: "BMW X53", result: "BMW X53 · W 81763N" },
      ],
    });
    const first = applyVinScanImportsToBlocks(createDefaultSourceBlocks(), [kfzRow], { vin: KVIN });
    expect(first.changed).toBe(true);
    const idx = findKfzAtSectionIndex(first.blocks.citi_avoti);
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(readKfzAtStore(first.blocks.citi_avoti.sections[idx]).list.map((r) => r.date)).toEqual(["13.11.2015", "04.08.2016"]);
    expect(applyVinScanImportsToBlocks(first.blocks, [kfzRow], { vin: KVIN }).changed).toBe(false);
    const queued = buildVinScanIndicator("kfz_at", KVIN, { status: "browser_only", summary: "kfzgutachten.at: nav pārbaudīts (rindā 1.)" });
    expect(applyVinScanImportsToBlocks(createDefaultSourceBlocks(), [queued], { vin: KVIN }).changed).toBe(false);
  });

  it("bez atrastām rindām - nekā", () => {
    const none = buildVinScanIndicator("bidfax", VIN, { status: "none", summary: "nav" });
    expect(applyVinScanImportsToBlocks(createDefaultSourceBlocks(), [none]).changed).toBe(false);
  });
});

describe("push ziņa Nilam", () => {
  it("AutoDNA / CARFAX priekšskatījuma skaiti, bez VIN un personas datiem, pirkums tikai ar klikšķi", () => {
    const indicators = [
      buildVinScanIndicator("autodna_precheck", VIN, { status: "found", summary: "AutoDNA priekšskatījums: 12 foto · 5 ieraksti" }),
      buildVinScanIndicator("carfax_eu", VIN, { status: "found", summary: "8 ieraksti CARFAX priekšskatījumā (DE, SE)" }),
      buildVinScanIndicator("bidfax", VIN, { status: "none", summary: "nav" }),
    ];
    const msg = buildOrderAutoIntakePush({
      sessionId: "cs_test_abc",
      vehicleLabel: "BMW 320d 2019",
      indicators,
      auctionSales: 1,
      photosImported: 14,
      thecarapiAuctions: 2,
    });
    expect(msg.title).toBe("Pasūtījums gatavs pārskatam: BMW 320d 2019");
    expect(msg.body).toContain("12 foto · 5 ieraksti");
    expect(msg.body).toContain("8 ieraksti CARFAX");
    expect(msg.body).toContain("izsoles 3");
    expect(msg.body).toContain("foto 14");
    expect(msg.body).toContain("Pirkums tikai ar Tavu klikšķi");
    expect(msg.body).not.toContain(VIN);
    expect(msg.url).toBe("/admin/orders/cs_test_abc");
    expect(msg.tag).toBe("intake-cs_test_abc");
    expect(msg.audience).toBe("pro");
    expect(msg.body).not.toMatch(/[–—]/);
  });

  it("priekšskatījums nav pieejams serverī - skaidri pateikts", () => {
    const msg = buildOrderAutoIntakePush({
      sessionId: "cs_x",
      vehicleLabel: "",
      indicators: [buildVinScanIndicator("carfax_eu", VIN, { status: "unknown", summary: "Avots neatbildēja laikā" })],
      auctionSales: 0,
      photosImported: 0,
      thecarapiAuctions: 0,
    });
    expect(msg.title).toBe("Pasūtījums gatavs pārskatam");
    expect(msg.body).toContain("CARFAX: nav datu (Avots neatbildēja laikā)");
    expect(msg.body).toContain("AutoDNA: nav pārbaudīts");
  });
});
