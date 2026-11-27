import { describe, expect, it } from "vitest";

import { createDefaultSourceBlocks } from "@/lib/admin-source-blocks";
import { buildQuickEvalV4View, ssListingMakeModel } from "@/lib/quick-eval-v4";
import { vinScanV4VehicleTitle } from "@/lib/vin-scan/v4-view";
import type { VinScanIndicator } from "@/lib/vin-scan/types";

const URL = "https://www.ss.com/msg/lv/transport/cars/renault/laguna/bmjmh.html";

const ind = (p: Partial<VinScanIndicator> & { id: string }): VinScanIndicator =>
  ({ label: p.id, country: "", status: "found", summary: "", detail: "", openUrl: null, ...p }) as VinScanIndicator;

function blocksWithListing() {
  const b = createDefaultSourceBlocks();
  b.tirgus = { ...b.tirgus, listingCreated: "27.11.2026", listingMileageOdometer: "208 000", listingMileageDate: "27.11.2026" };
  return b;
}

describe("buildQuickEvalV4View (27.11 Ātrie vērtējumi)", () => {
  it("sludinājuma km kļūst par v4 rindu ar nobraukuma punktu; kartīte netiek dublēta", () => {
    const v = buildQuickEvalV4View({
      blocks: blocksWithListing(),
      parts: { csdd: "not_found", listing: "ok" },
      sourceAt: {},
      seedAt: "2026-11-27T16:42:00Z",
      listingUrl: URL,
      vinScan: { at: "2026-11-27T18:47:00Z", indicators: [ind({ id: "vin_decode", summary: "Renault · Ražots: Francija" }), ind({ id: "csdd", status: "none" })] },
      ccVin: null,
      ccVinUrl: "https://checkcar.vin/",
    });
    const listing = v.rows.find((r) => r.id === "listing_history");
    expect(listing?.status).toBe("found");
    expect(listing?.mileage).toEqual([{ date: "27.11.2026", odometer: "208 000", source: "Sludinājums" }]);
    expect(v.absorbed.has("listing")).toBe(true);
    // CSDD bez datiem netiek dublēta v4 sarakstā; ārzemju auto -> «Nav LV reģistrā».
    expect(v.rows.some((r) => r.id === "csdd")).toBe(false);
    expect(v.csddNotLv).toBe(true);
    expect(v.title).toBe("Renault Laguna");
  });

  it("CSDD kļūda nav «Nav LV reģistrā»", () => {
    const v = buildQuickEvalV4View({
      blocks: createDefaultSourceBlocks(),
      parts: { csdd: "error" },
      sourceAt: {},
      seedAt: null,
      listingUrl: "",
      vinScan: null,
      ccVin: null,
      ccVinUrl: "",
    });
    expect(v.csddNotLv).toBe(false);
    expect(v.title).toBe("");
  });

  it("izsoļu portālu arhīva foto skaits -> priekšskatījuma rinda", () => {
    const v = buildQuickEvalV4View({
      blocks: createDefaultSourceBlocks(),
      parts: {},
      sourceAt: {},
      seedAt: null,
      listingUrl: "",
      vinScan: null,
      ccVin: { at: "2026-11-27T18:00:00Z", count: 12 },
      ccVinUrl: "https://checkcar.vin/x",
    });
    expect(v.rows).toEqual([expect.objectContaining({ id: "checkcar_vin", status: "found", summary: "12 foto", media: { photoCount: 12 } })]);
  });

  it("DK reģistra bloks ar nobraukumu -> v4 rinda ar valsti", () => {
    const b = createDefaultSourceBlocks();
    b.tjekbil = { ...b.tjekbil, mileage: [{ date: "2019-05-01", odometer: "120000", country: "DK", origin: "" }] };
    const v = buildQuickEvalV4View({ blocks: b, parts: {}, sourceAt: {}, seedAt: null, listingUrl: "", vinScan: null, ccVin: null, ccVinUrl: "" });
    const dk = v.rows.find((r) => r.id === "tjekbil");
    expect(dk?.country).toBe("DK");
    expect(dk?.mileage?.[0]).toMatchObject({ date: "2019-05-01", odometer: "120000", country: "DK" });
    expect(v.absorbed.has("tjekbil")).toBe(true);
  });
});

describe("ssListingMakeModel / vinScanV4VehicleTitle", () => {
  it("ss.com saite -> marka un modelis", () => {
    expect(ssListingMakeModel(URL)).toEqual({ make: "Renault", model: "Laguna" });
    expect(ssListingMakeModel("https://www.ss.lv/msg/lv/transport/cars/bmw/x5/abc.html")).toEqual({ make: "BMW", model: "X5" });
    expect(ssListingMakeModel("https://example.com")).toBeNull();
  });

  it("reģistrs pirms WMI; WMI tikai marka; gads, ja zināms", () => {
    expect(vinScanV4VehicleTitle([{ id: "vin_decode", status: "found", summary: "Renault · Ražots: Francija" }])).toBe("Renault");
    expect(
      vinScanV4VehicleTitle([
        { id: "vin_decode", status: "found", summary: "x", vehicle: { make: "VOLVO", model: "740 Series", year: "" } },
        { id: "carinfo", status: "found", vehicle: { make: "Volvo", model: "V60", year: "2014" } },
      ]),
    ).toBe("Volvo V60 · 2014");
    expect(vinScanV4VehicleTitle([{ id: "mnt_ee", status: "none" }])).toBe("");
  });
});
