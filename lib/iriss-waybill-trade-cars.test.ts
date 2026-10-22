import { describe, expect, it } from "vitest";
import type { AutoparksCar } from "@/lib/iriss-autoparks";
import { emptyRegistryValues, type AutoparksRegistry } from "@/lib/iriss-autoparks-registry";
import { filterWaybillTradeCars, waybillTradeCars } from "@/lib/iriss-waybill-trade-cars";

function registry(tradeActNo: string, makeModel = "", extra: Partial<AutoparksRegistry> = {}): AutoparksRegistry {
  return { ...emptyRegistryValues(), tradeActNo, makeModel, importedAt: "", importFile: "", registryDate: "", manual: [], removedAt: "", ...extra };
}

function car(over: Partial<AutoparksCar>): AutoparksCar {
  return {
    id: "c1",
    orderId: "",
    vin: "",
    make: "",
    model: "",
    year: "",
    plate: "",
    color: "",
    mileageKm: null,
    status: "for_sale",
    statusChangedAt: "",
    location: "",
    purchasePriceEur: 12000,
    salePriceEur: 15000,
    arrivedAt: "",
    archivedAt: "",
    createdAt: "",
    updatedAt: "",
    ...over,
  };
}

describe("waybill trade cars", () => {
  const cars = [
    car({ id: "a", make: "Volvo", model: "XC60", vin: "yv1uza8v1m1765432", year: "2021", registry: registry("A-12") }),
    car({ id: "b", make: "Audi", model: "A6 Avant", vin: "WAUZZZF27LN004512", status: "in_service", registry: registry("A-13") }),
    car({ id: "sold", make: "BMW", model: "320d", status: "sold", registry: registry("A-14") }),
    car({ id: "arch", make: "BMW", model: "520d", archivedAt: "2026-10-01", registry: registry("A-15") }),
    car({ id: "noact", make: "Škoda", model: "Superb", registry: registry("") }),
    car({ id: "noreg", make: "Opel", model: "Astra" }),
    car({ id: "reg", vin: "W1K2132041A876543", registry: registry("A-16", "MERCEDES-BENZ E 220 D") }),
    // Reģistra nolasījumā vairs nav / statuss "Pārdots" - pavadzīmju sarakstā neparādās (tas pats avots kā Autoparkam).
    car({ id: "removed", make: "Kia", model: "Ceed", registry: registry("A-17", "", { removedAt: "2026-10-23T00:30:00.000Z" }) }),
    car({ id: "regsold", make: "Kia", model: "Sportage", registry: registry("A-18", "", { status: "Pārdots" }) }),
  ];

  it("lists only accepted-for-trade (act no.), unsold, unarchived cars, sorted, without prices", () => {
    const out = waybillTradeCars(cars);
    expect(out.map((c) => c.id)).toEqual(["b", "reg", "a"]);
    expect(out[0]).toEqual({ id: "b", brandModel: "Audi A6 Avant", vin: "WAUZZZF27LN004512", year: "", statusLabel: "Servisā" });
    expect(out[1]?.brandModel).toBe("MERCEDES-BENZ E 220 D");
    expect(out[2]?.vin).toBe("YV1UZA8V1M1765432");
    expect(JSON.stringify(out)).not.toMatch(/12000|15000|Price/);
  });

  it("filters by make, model or VIN part", () => {
    const out = waybillTradeCars(cars);
    expect(filterWaybillTradeCars(out, "audi").map((c) => c.id)).toEqual(["b"]);
    expect(filterWaybillTradeCars(out, "xc60 2021").map((c) => c.id)).toEqual(["a"]);
    expect(filterWaybillTradeCars(out, "876543").map((c) => c.id)).toEqual(["reg"]);
    expect(filterWaybillTradeCars(out, "  ")).toHaveLength(3);
  });
});
