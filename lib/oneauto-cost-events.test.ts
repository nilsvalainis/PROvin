import { describe, expect, it } from "vitest";
import { oneautoChargedCostEventDrafts } from "@/lib/oneauto-cost-events";

describe("oneauto charged cost events", () => {
  it("ieraksta OE vēsturi 3.00 EUR un VIN Lookup 0.36 EUR, ne Decoder", () => {
    const rows = oneautoChargedCostEventDrafts({
      vin: "WAUZZZF59KA075097",
      products: ["oe_service_history", "oe_vin_lookup", "vin_decoder"],
      results: {
        oe_service_history: { ok: true },
        oe_vin_lookup: { ok: true },
        vin_decoder: { ok: false, error: "no_data" },
      },
      eurToUsd: 1,
    });
    expect(rows).toEqual([
      {
        sku: "oe_service_history",
        units: 1,
        eur: 3,
        usd: 3,
        ref: "WAUZZZF59KA075097:oe_service_history",
      },
      {
        sku: "oe_vin_lookup",
        units: 1,
        eur: 0.36,
        usd: 0.36,
        ref: "WAUZZZF59KA075097:oe_vin_lookup",
      },
    ]);
  });

  it("no_data produktus neiekasē", () => {
    expect(
      oneautoChargedCostEventDrafts({
        vin: "WAUZZZ4M0JD000001",
        products: ["oe_service_history", "oe_vin_lookup"],
        results: {
          oe_service_history: { ok: false, error: "no_data" },
        },
      }),
    ).toEqual([]);
  });
});
