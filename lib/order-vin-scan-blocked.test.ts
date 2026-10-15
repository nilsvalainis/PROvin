import { describe, expect, it } from "vitest";
import { buildOrderVinScanSummary, type OrderVinScanRecord } from "@/lib/order-vin-scan";

const rec = (indicators: Array<{ id: string; status: string; summary: string }>): OrderVinScanRecord =>
  ({
    at: "2026-10-14T08:00:00Z",
    vin: "WAUZZZF50NA000001",
    status: "done",
    indicators: indicators.map((i) => ({ ...i, label: i.id, openUrl: `https://x/${i.id}` })),
  }) as unknown as OrderVinScanRecord;

describe("VIN SCAN Cloudflare-blocked browser sources", () => {
  it("blocked stat.vin/bid.cars/checkcar/BidFax → neutral 'open_import', not counted as kļūda", () => {
    const s = buildOrderVinScanSummary(
      rec([
        { id: "stat_vin", status: "error", summary: "Cloudflare 403" },
        { id: "bid_cars", status: "unknown", summary: "Lapa nav atpazīta" },
        { id: "checkcar_vin", status: "error", summary: "Cloudflare challenge" },
        { id: "bidfax", status: "error", summary: "HTTP 403" },
        { id: "carfax_eu", status: "error", summary: "Cloudflare 403" },
      ]),
    )!;
    const by = Object.fromEntries(s.rows.map((r) => [r.id, r]));
    for (const id of ["stat_vin", "bid_cars", "checkcar_vin", "bidfax"]) {
      expect(by[id]!.action).toBe("open_import");
      expect(by[id]!.blocked).toBe(true);
    }
    expect(by.carfax_eu!.action).toBe("retry");
    expect(s.error).toBe(1);
    expect(s.browser).toBe(4);
  });
  it("timeout text on those sources is timeout state, still retry", () => {
    const s = buildOrderVinScanSummary(rec([{ id: "stat_vin", status: "error", summary: "timeout" }]))!;
    expect(s.rows[0]!.action).toBe("retry");
    expect(s.rows[0]!.state).toBe("timeout");
    expect(s.timeout).toBe(1);
    expect(s.error).toBe(0);
  });
});
