import { describe, expect, it, vi } from "vitest";

import {
  applyIrissListingMarkPatch,
  diffIrissListingMarks,
  emptyIrissListingMarks,
  mergeIrissListingMarks,
  parseIrissListingMarkPatch,
  parseIrissListingMarks,
} from "@/lib/iriss-listing-marks";
import { irissPdImportFromListing, irissPdListingRef } from "@/lib/iriss-piedavajumi-from-listing";
import { createIrissPdFromListing, irissPdClientFromOrderBrief, irissPdRowsForListing } from "@/lib/iriss-pd-from-listing-client";
import type { IrissListingVehicle } from "@/lib/iriss-listings-types";

const golf = {
  id: "a1b2c3",
  platform: "ecarstrade",
  externalId: "7767999",
  detailUrl: "https://ecarstrade.com/cars/7767999",
  orderIds: [],
  orderBrandModels: [],
  title: "Volkswagen Golf VIII 2.0 TDI 85kW Life DSG 5d",
  manufacturer: "Volkswagen",
  year: "2021",
  firstRegistration: "12/2021",
  mileageKm: 90276,
  fuel: "Dīzelis",
  transmission: "Automātiskā",
  powerKw: "85",
  location: "Brussels, BE",
  countryCode: "BE",
  imageUrl: "https://img.example.com/1.jpg",
  imageUrls: ["https://img.example.com/1.jpg", "https://img.example.com/2.jpg", "http://insecure.example.com/3.jpg"],
  vin: "WVWZZZCDZMW123456",
  vinSource: "source",
  color: "pelēks",
  bodyType: "Hečbeks",
  stockNumber: "7767999",
  currency: "EUR",
  priceStart: null,
  priceMinimal: null,
  priceCurrent: null,
  priceBuyNow: 13100,
} as unknown as IrissListingVehicle;

describe("Sludinājums -> Piedāvājums (vairs ne jauns pasūtījums)", () => {
  it("aizpilda auto datus, bildes un pirkuma cenu no sludinājuma", () => {
    const imp = irissPdImportFromListing(golf);
    expect(imp.source).toBe("ecarstrade");
    expect(imp.sourceRef).toBe(irissPdListingRef("a1b2c3"));
    expect(imp.vehicle).toMatchObject({ title: golf.title, year: "2021", mileageKm: "90276", powerKw: "85", location: "Beļģija" });
    expect(imp.purchasePrice).toBe("13100");
    // Dublikāts un http bilde netiek ņemti.
    expect(imp.photos).toEqual([
      { kind: "url", url: "https://img.example.com/1.jpg" },
      { kind: "url", url: "https://img.example.com/2.jpg" },
    ]);
    expect(imp.historyText).toContain("Sludinājumiem (eCarsTrade, Nr. 7767999)");
  });

  it("Openlane platforma kļūst par Openlane avotu", () => {
    expect(irissPdImportFromListing({ ...golf, platform: "openline" } as IrissListingVehicle).source).toBe("openlane");
  });

  it("klients ir pasūtījuma klients, un API kļūdas teksts nonāk līdz lietotājam", async () => {
    expect(irissPdClientFromOrderBrief({ id: "o1", clientName: " Edgars Priede ", phone: "+371 2", email: "" })).toEqual({
      name: "Edgars Priede",
      phone: "+371 2",
      email: "",
      orderId: "o1",
    });
    const ok = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ ok: true, id: "pd-1" }), { status: 200 }));
    expect(await createIrissPdFromListing("a1b2c3", null, ok)).toEqual({ ok: true, id: "pd-1" });
    expect(JSON.parse(String(ok.mock.calls[0]![1]!.body))).toEqual({ kind: "listing", listingId: "a1b2c3" });
    const gone = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ ok: false, message: "Sludinājums vairs nav atrodams" }), { status: 404 }));
    expect(await createIrissPdFromListing("x", null, gone)).toEqual({ ok: false, status: 404, message: "Sludinājums vairs nav atrodams" });
  });

  it("atrod jau izveidotos piedāvājumus šim auto", () => {
    const rows = [
      { id: "1", sourceRef: "listing:a1b2c3", source: "ecarstrade", sourceKey: "" },
      { id: "2", sourceRef: "", source: "ecarstrade", sourceKey: "7767999" },
      { id: "3", sourceRef: "", source: "auto1", sourceKey: "7767999" },
    ];
    expect(irissPdRowsForListing(rows, golf).map((r) => r.id)).toEqual(["1", "2"]);
  });
});

describe("Piezīmes un favorīti serverī (nevis tikai šajā ierīcē)", () => {
  it("izmaiņa skar tikai savu auto; tukša piezīme dzēš", () => {
    let m = parseIrissListingMarks({ notes: { a: "Zvanīt" }, fav: ["b"] });
    m = applyIrissListingMarkPatch(m, { id: "c", note: "Laba cena" });
    m = applyIrissListingMarkPatch(m, { id: "a", note: "  " });
    m = applyIrissListingMarkPatch(m, { id: "b", fav: false });
    m = applyIrissListingMarkPatch(m, { id: "c", fav: true });
    expect(m).toEqual({ notes: { c: "Laba cena" }, fav: ["c"] });
  });

  it("atverot lapu: serveris galvenais, vecās lokālās piezīmes tiek aizsūtītas", () => {
    const merged = mergeIrissListingMarks({ notes: { a: "lokāla", b: "vecā" }, fav: ["x", "y"] }, { notes: { a: "servera" }, fav: ["x"] });
    expect(merged.notes).toEqual({ a: "servera", b: "vecā" });
    expect(merged.fav).toEqual(["x", "y"]);
    expect(merged.toPush).toEqual([{ id: "b", note: "vecā" }, { id: "y", fav: true }]);
  });

  it("sūta tikai mainītos auto", () => {
    expect(diffIrissListingMarks({ notes: { a: "1" }, fav: ["f"] }, { notes: { a: "12", b: "jauns" }, fav: [] })).toEqual([
      { id: "a", note: "12" },
      { id: "b", note: "jauns" },
      { id: "f", fav: false },
    ]);
  });

  it("nepieņem nederīgus ierakstus", () => {
    expect(parseIrissListingMarkPatch({ id: "../x", note: "a" })).toBeNull();
    expect(parseIrissListingMarkPatch({ id: "ok" })).toBeNull();
    expect(parseIrissListingMarks({ notes: { "bad id": "x", ok: 5 }, fav: [1, "ok", "ok"] })).toEqual({ notes: {}, fav: ["ok"] });
    expect(parseIrissListingMarks(null)).toEqual(emptyIrissListingMarks());
  });
});
