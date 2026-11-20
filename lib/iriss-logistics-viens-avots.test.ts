import { describe, expect, it } from "vitest";
import { emptyCarV2 } from "@/lib/iriss-autoparks-v2";
import {
  applySharedCarPatchToV2,
  linkedCarForOrder,
  overlayOrderWithCar,
  sharedCarPatchIsEmpty,
  splitSharedCarPatch,
  type LinkedCarFields,
} from "@/lib/iriss-logistics-viens-avots";

const VIN = "WBA5R1C0XLFH42873";
const order = { id: "ord_1", vin: "", make: "BMW", model: "3 sērija", title: "BMW 3 sērija (2019)", mileageKm: 90000, priceEur: 15000 };
const car: LinkedCarFields = { id: "ap-1", vin: VIN, make: "BMW", model: "320d", year: "2019", color: "Melna", mileageKm: 91500 };

describe("P3 viens avots: sasaiste", () => {
  const cars = [
    { id: "ap-arch", orderId: "", vin: VIN, archivedAt: "2026-10-01" },
    { id: "ap-1", orderId: "", vin: VIN.toLowerCase() },
    { id: "ap-2", orderId: "ord_9", vin: "" },
  ];
  it("pēc orderId (arī bez VIN)", () => {
    expect(linkedCarForOrder(cars, { id: "ord_9", vin: "" })?.id).toBe("ap-2");
  });
  it("pēc VIN ≥11 tikai nearhivētiem", () => {
    expect(linkedCarForOrder(cars, { id: "x", vin: VIN })?.id).toBe("ap-1");
  });
  it("īss VIN nesasaista", () => {
    expect(linkedCarForOrder(cars, { id: "x", vin: "WBA5R1" })).toBeUndefined();
  });
});

describe("P3 viens avots: lasīšana", () => {
  it("bez auto - vecie Loģistikas lauki (rezerve)", () => {
    expect(overlayOrderWithCar(order, undefined, true)).toBe(order);
  });
  it("ar auto - kopējie lauki no Autoparka, summas neaiztiek", () => {
    const v = overlayOrderWithCar(order, car, true);
    expect(v).toMatchObject({ vin: VIN, make: "BMW", model: "320d", title: "BMW 320d", mileageKm: 91500, year: "2019", color: "Melna" });
    expect(v.autoparksCarId).toBe("ap-1");
    expect(v.carFieldsReadOnly).toBe(true);
    expect(v.priceEur).toBe(15000);
  });
  it("tukšs Autoparka lauks -> Loģistikas vērtība", () => {
    const v = overlayOrderWithCar(order, { ...car, vin: "", make: "", model: "", mileageKm: null }, false);
    expect(v).toMatchObject({ vin: "", make: "BMW", model: "3 sērija", title: "BMW 3 sērija (2019)", mileageKm: 90000 });
  });
});

describe("P3 viens avots: labošana", () => {
  it("kopējie lauki -> Autoparks tikai, ja mainīti; title nekur", () => {
    const current = overlayOrderWithCar(order, car, false);
    const { shared, rest } = splitSharedCarPatch({ vin: VIN, make: "bmw", model: "330e", title: "x", mileageKm: 92000, pickupDate: "2026-11-21" }, current);
    expect(shared).toEqual({ model: "330e", mileageKm: 92000 });
    expect(rest).toEqual({ pickupDate: "2026-11-21" });
  });
  it("nemainīts pilns ieraksts -> nekas nav jāraksta Autoparkā", () => {
    const current = overlayOrderWithCar(order, car, false);
    const { shared } = splitSharedCarPatch({ ...current }, current);
    expect(sharedCarPatchIsEmpty(shared)).toBe(true);
  });
  it("raksta v2 pārrakstus kā Pamatdati", () => {
    const c = emptyCarV2();
    const out = applySharedCarPatchToV2(c, car, { model: " 330e ", year: "2020", mileageKm: 92000, vin: "wba5r1c0xlfh42873" });
    expect(out.ok).toBe(true);
    expect(c.fields).toMatchObject({ model: "330e", year: "2020", vin: VIN });
    expect(c.tech.mileageKm).toBe(92000);
    expect(c.sources["tech.mileageKm"]).toBe("manual");
  });
  it("nederīgas vērtības atraida", () => {
    expect(applySharedCarPatchToV2(emptyCarV2(), car, { vin: "ABC" })).toEqual({ ok: false, error: "invalid_vin" });
    expect(applySharedCarPatchToV2(emptyCarV2(), car, { year: "19" })).toEqual({ ok: false, error: "invalid_year" });
    expect(applySharedCarPatchToV2(emptyCarV2(), car, { mileageKm: -5 })).toEqual({ ok: false, error: "invalid_mileage" });
  });
});
