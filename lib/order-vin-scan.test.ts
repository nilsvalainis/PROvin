import { describe, expect, it } from "vitest";

import { emptyCcVinBlock } from "@/lib/cc-vin-report";
import {
  applyVinScanAuctionsToCcVin,
  buildOrderVinScanSummary,
  orderVinScanCompactHint,
  parseOrderVinScanRecord,
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
    expect(sum?.noneCollapsedLabels).toEqual(["tjekbil.dk", "Regitra"]);
    const stat = sum?.rows.find((r) => r.id === "stat_vin");
    expect(stat).toMatchObject({ state: "found", hint: "Copart 2025, 20 foto", valuable: true, canImportAuction: true, photoCount: 20 });
    expect(orderVinScanCompactHint(sum)).toContain("Copart 2025, 20 foto");
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
