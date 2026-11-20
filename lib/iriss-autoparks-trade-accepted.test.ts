import { describe, expect, it } from "vitest";
import type { AutoparksCar } from "@/lib/iriss-autoparks";
import { emptyAutoparksRegistry, isTradeAcceptedCar, listTradeAcceptedCars } from "@/lib/iriss-autoparks-registry";
import { waybillTradeCars } from "@/lib/iriss-waybill-trade-cars";

function car(id: string, over: Partial<AutoparksCar> = {}, reg: { tradeActNo?: string; tradeActDate?: string; status?: string } | null = { tradeActNo: "A-1" }): AutoparksCar {
  return {
    id,
    orderId: "",
    vin: `VIN${id.toUpperCase()}00000000`,
    make: "Volvo",
    model: id,
    year: "",
    plate: "",
    color: "",
    mileageKm: null,
    status: "for_sale",
    statusChangedAt: "",
    location: "",
    purchasePriceEur: null,
    salePriceEur: null,
    arrivedAt: "",
    archivedAt: "",
    createdAt: "",
    updatedAt: "",
    ...(reg ? { registry: { ...emptyAutoparksRegistry(), tradeActNo: reg.tradeActNo ?? "", tradeActDate: reg.tradeActDate ?? "", status: reg.status ?? "" } } : {}),
    ...over,
  };
}

describe("listTradeAcceptedCars (vienīgais tirdzniecībā pieņemto auto avots)", () => {
  const cars = [
    car("ok"),
    car("intrade", {}, { tradeActNo: "A-2", status: "Tirdzniecībā" }),
    car("service", { status: "in_service" }),
    // Autoparkā «Pārdots», bet CSDD reģistrā vēl pieņemts - paliek (Nils 20.11; izņem reģistra nolasījums).
    car("sold", { status: "sold" }),
    // Hetzner nolasījums: akta nr. nav, ir akta datums (20.11).
    car("dateonly", {}, { tradeActDate: "2026-11-10" }),
    car("arch", { archivedAt: "2026-10-01T00:00:00Z" }),
    car("noact", {}, { tradeActNo: "  " }),
    car("noreg", {}, null),
    car("removed", {}, { tradeActNo: "A-3", status: "Noņemts no tirdzniecības" }),
    car("regsold", {}, { tradeActNo: "A-4", status: "PĀRDOTS" }),
    car("excl", {}, { tradeActNo: "A-5", status: "Izslēgts" }),
  ];

  it("atstāj tikai auto ar akta nr. vai datumu, nearhivētus un reģistrā nenoņemtus, krātuves secībā", () => {
    expect(listTradeAcceptedCars(cars).map((c) => c.id)).toEqual(["ok", "intrade", "service", "sold", "dateonly"]);
  });

  it("atdod pilnus auto ierakstus (sinhronizācijai), nevis kopijas", () => {
    const out = listTradeAcceptedCars(cars);
    expect(out[0]).toBe(cars[0]);
  });

  it("isTradeAcceptedCar sakrīt ar saraksta filtru", () => {
    for (const c of cars) expect(isTradeAcceptedCar(c)).toBe(listTradeAcceptedCars([c]).length === 1);
  });

  it("pavadzīmju saraksts ir tieši tie paši auto", () => {
    const ids = new Set(listTradeAcceptedCars(cars).map((c) => c.id));
    expect(new Set(waybillTradeCars(cars).map((c) => c.id))).toEqual(ids);
  });
});
