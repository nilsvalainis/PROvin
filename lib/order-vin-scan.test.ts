import { describe, expect, it } from "vitest";

import { emptyCcVinBlock } from "@/lib/cc-vin-report";
import { emptyCsddFields, emptyListingAnalysisBlock } from "@/lib/admin-source-blocks";
import { applyVinScanCsddToBlock, applyVinScanListingToBlock } from "@/lib/order-vin-scan-apply";
import {
  applyVinScanAuctionsToCcVin,
  buildOrderVinScanSummary,
  formatOrderVinScanClock,
  mergeVinScanIndicators,
  orderVinScanCompactHint,
  parseOrderVinScanRecord,
  shouldStartOrderVinScanOnDraftPatch,
  vinScanAuctionsToCcVinParsed,
} from "@/lib/order-vin-scan";
import type { VinScanIndicator } from "@/lib/vin-scan/types";

function indicator(partial: Partial<VinScanIndicator> & Pick<VinScanIndicator, "id" | "status" | "summary">): VinScanIndicator {
  return {
    label: partial.label || partial.id,
    country: partial.country || "US",
    detail: "",
    openUrl: partial.openUrl ?? `https://stat.vin/cars/WBA`,
    ...partial,
  };
}

const STAT: VinScanIndicator = indicator({
  id: "stat_vin",
  label: "stat.vin",
  status: "found",
  summary: "Copart 2025, 20 foto",
  auctions: [{ title: "Copart · lots 50558298 · Front", date: "2025-09-02", venue: "Copart", photoCount: 20, photoUrl: "https://cs.copart.com/a.jpg" }],
  media: { photoCount: 20, photoUrl: "https://cs.copart.com/a.jpg" },
});

describe("pasūtījuma VIN SCAN ieraksts", () => {
  it("parse atmet miskasti un saglabā indikatorus", () => {
    expect(parseOrderVinScanRecord(null)).toBeNull();
    expect(parseOrderVinScanRecord({ at: "2026-10-14T00:00:00.000Z", vin: "WBA5R1C0XLFH42873" })).toBeNull();
    const rec = parseOrderVinScanRecord({
      at: "2026-10-14T09:00:00.000Z",
      vin: "wba5r1c0xlfh42873",
      status: "done",
      indicators: [STAT, { id: "nope" }],
    });
    expect(rec?.vin).toBe("WBA5R1C0XLFH42873");
    expect(rec?.indicators).toHaveLength(1);
    expect(rec?.indicators[0]?.auctions?.[0]?.venue).toBe("Copart");
  });

  it("kopsavilkums: found / none / kļūda, tukšie sakļauti, stat.vin importējams", () => {
    const rec = parseOrderVinScanRecord({
      at: "2026-10-14T09:00:00.000Z",
      vin: "WBA5R1C0XLFH42873",
      status: "done",
      indicators: [
        STAT,
        indicator({ id: "tjekbil", label: "tjekbil.dk", status: "none", summary: "Nav" }),
        indicator({ id: "regitra", label: "Regitra", status: "none", summary: "Nav" }),
        indicator({ id: "bid_cars", label: "bid.cars", status: "unknown", summary: "Cloudflare bloķē" }),
      ],
    });
    const sum = buildOrderVinScanSummary(rec);
    expect(sum?.found).toBe(1);
    expect(sum?.none).toBe(2);
    expect(sum?.error).toBe(1);
    expect(sum?.noneCollapsedLabels).toEqual(["Regitra", "tjekbil.dk"]);
    const stat = sum?.rows.find((r) => r.id === "stat_vin");
    expect(stat).toMatchObject({
      state: "found",
      hint: "Copart 2025, 20 foto",
      valuable: true,
      canImportAuction: true,
      photoCount: 20,
      action: "import_auction",
    });
    expect(stat?.photoUrls).toContain("https://cs.copart.com/a.jpg");
    expect(sum?.rows[0]?.id).toBe("stat_vin");
    expect(sum?.noneRows.map((r) => r.id).sort()).toEqual(["regitra", "tjekbil"]);
    expect(orderVinScanCompactHint(sum)).toContain("Copart 2025, 20 foto");
  });

  it("CSDD un sludinājuma rindām ir Ielikt darbība", () => {
    const rec = parseOrderVinScanRecord({
      at: "2026-10-14T09:00:00.000Z",
      vin: "WBA5R1C0XLFH42873",
      status: "done",
      indicators: [
        STAT,
        indicator({
          id: "csdd",
          label: "CSDD",
          status: "found",
          summary: "1. reģ. 29.09.2017",
        }),
        indicator({
          id: "listing_history",
          label: "ss.com",
          status: "found",
          summary: "Sludinājums · 21 foto",
        }),
      ],
    });
    const sum = buildOrderVinScanSummary(rec);
    expect(sum?.rows.map((r) => r.id)).toEqual(["stat_vin", "csdd", "listing_history"]);
    expect(sum?.rows.find((r) => r.id === "csdd")?.action).toBe("import_csdd");
    expect(sum?.rows.find((r) => r.id === "listing_history")?.action).toBe("import_listing");
  });

  it("pulkstenis ir Rīgas HH:MM ar kolu", () => {
    expect(formatOrderVinScanClock("2026-10-14T06:14:00.000Z")).toBe("09:14");
    expect(formatOrderVinScanClock("nav")).toBe("");
  });

  it("kļūdas statusā rāda ieraksta ziņu, ne kļūdu skaitu", () => {
    const rec = parseOrderVinScanRecord({
      at: "2026-10-14T09:00:00.000Z",
      vin: "WBA5R1C0XLFH42873",
      status: "error",
      error: "scan_failed",
      indicators: [],
    });
    const sum = buildOrderVinScanSummary(rec);
    expect(orderVinScanCompactHint(sum)).toBe("VIN SCAN: kļūda (scan_failed)");
  });
});

describe("VIN SCAN izsoles → AUCTION (cc_vin)", () => {
  it("ieliek pārdošanas rindu un foto URL, nedzēš esošos datus", () => {
    const prev = emptyCcVinBlock();
    prev.sales = [{ date: "01.01.2020", venue: "Manheim", odometer: "10 000 km", price: "", status: "Pārdots" }];
    const parsed = vinScanAuctionsToCcVinParsed([STAT]);
    expect(parsed.sales.some((r) => r.venue === "Copart")).toBe(true);
    expect(parsed.damages.some((r) => /Front/i.test(r.description))).toBe(true);

    const applied = applyVinScanAuctionsToCcVin(prev, [STAT]);
    expect(applied.sales).toBeGreaterThan(0);
    expect(applied.photoUrls).toContain("https://cs.copart.com/a.jpg");
    expect(applied.block.sales.some((r) => r.venue === "Manheim")).toBe(true);
    expect(applied.block.sales.some((r) => r.venue === "Copart")).toBe(true);
    expect(applied.block.rawUnprocessedData).toContain("cs.copart.com");
  });
});

describe("VIN SCAN ielikšana CSDD / sludinājumā", () => {
  it("aizpilda tukšos CSDD laukus un nepārraksta aizpildītos", () => {
    const empty = applyVinScanCsddToBlock(
      emptyCsddFields(),
      indicator({
        id: "csdd",
        status: "found",
        summary: "1. reģ. 29.09.2017",
        vehicle: { make: "Mercedes-Benz", model: "CLA 180", year: "2017" },
      }),
    );
    expect(empty.makeModel).toBe("Mercedes-Benz CLA 180");
    expect(empty.modelYear).toBe("2017");
    const kept = applyVinScanCsddToBlock(
      { ...emptyCsddFields(), makeModel: "Operatora marka", modelYear: "2016" },
      indicator({
        id: "csdd",
        status: "found",
        summary: "CSDD",
        vehicle: { make: "Mercedes-Benz", model: "CLA 180", year: "2017" },
      }),
    );
    expect(kept.makeModel).toBe("Operatora marka");
    expect(kept.modelYear).toBe("2016");
  });

  it("ieliek sludinājuma rindas tukšā paste laukā", () => {
    const next = applyVinScanListingToBlock(
      emptyListingAnalysisBlock(),
      indicator({
        id: "listing_history",
        status: "found",
        summary: "Sludinājums",
        listings: [{ date: "12.10.2026", price: "12 000 €", odometer: "185 389 km" }],
      }),
    );
    expect(next.listingPasteRaw).toContain("12 000 €");
    expect(next.listingPasteRaw).toContain("185 389 km");
  });
});

describe("VIN SCAN palaišana no draft PATCH", () => {
  it("nesāk skenēšanu, ja VIN nav mainījies (lapas atvēršana)", () => {
    expect(shouldStartOrderVinScanOnDraftPatch("WBA5R1C0XLFH42873", "WBA5R1C0XLFH42873")).toBe(false);
    expect(shouldStartOrderVinScanOnDraftPatch("", "WBA5R1C0XLFH42873")).toBe(true);
    expect(shouldStartOrderVinScanOnDraftPatch("AAA", "WBA5R1C0XLFH42873")).toBe(true);
  });

  it("apvieno atkārtota avota rindu ar esošajām", () => {
    const merged = mergeVinScanIndicators(
      [STAT, indicator({ id: "bid_cars", status: "unknown", summary: "Cloudflare" })],
      [indicator({ id: "bid_cars", status: "found", summary: "Ir izsoles ieraksts" })],
    );
    expect(merged.find((r) => r.id === "stat_vin")?.status).toBe("found");
    expect(merged.find((r) => r.id === "bid_cars")?.status).toBe("found");
  });
});
