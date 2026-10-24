import { describe, expect, it } from "vitest";
import { normalizeAutoparksCar } from "@/lib/iriss-autoparks";
import { autoparksV2Basics, emptyCarV2 } from "@/lib/iriss-autoparks-v2";
import { autoparksV2PriceSheet, engineLabel } from "@/lib/iriss-autoparks-v2-cenu-lapa";

describe("Cenu lapa", () => {
  const car = normalizeAutoparksCar({
    id: "a",
    make: "Audi",
    model: "A6 Avant",
    year: "2018",
    displayName: "AUDI A6 AVANT 40 TDI",
    equipmentLine: "MATRIX LED / ACC",
    salePriceEur: 18900,
    purchasePriceEur: 9850,
    registry: { odometerKm: 162400, gearbox: "Automāts", airbags: "yes", esp: "yes_checked", abs: "yes", importedAt: "x" },
  })!;

  it("nav iepirkuma cenas un pašizmaksas; v1 vērtības, ja v2 nav labots", () => {
    const v2 = emptyCarV2();
    const s = autoparksV2PriceSheet(car, v2, autoparksV2Basics(car, v2));
    expect(s).toMatchObject({ displayName: "AUDI A6 AVANT 40 TDI", salePriceEur: 18900, listPriceEur: 18900, gearbox: "Automāts", safety: "Ir" });
    expect(s.mileage).toEqual({ value: "162 400 km", csdd: true });
    expect(JSON.stringify(s)).not.toContain("9850");
  });

  it("v2 labojums uzvar, v1 paliek", () => {
    const v2 = emptyCarV2();
    v2.priceSheet.listPriceEur = 18500;
    const s = autoparksV2PriceSheet(car, v2, autoparksV2Basics(car, v2));
    expect(s.listPriceEur).toBe(18500);
    expect(car.listPriceEur).toBeUndefined();
  });

  it("motors", () => {
    expect(engineLabel(1968, 150)).toBe("2.0 · 150 kW");
    expect(engineLabel(null, 110)).toBe("110 kW");
  });

  it("J30: īpašnieks rādās cenu lapā", () => {
    const v2 = emptyCarV2();
    const s = autoparksV2PriceSheet(car, v2, autoparksV2Basics(car, v2));
    expect(s.owner).toBe("IRISS");
    expect(s.ownerLabel).toBeTruthy();
  });

  it("J30: ar roku ievadīts dzinējs cenu lapā uzvar pār aprēķināto no tilpuma+jaudas", () => {
    const v2 = emptyCarV2();
    v2.tech.displacementCm3 = 1968;
    v2.tech.powerKw = 150;
    const noManual = autoparksV2PriceSheet(car, v2, autoparksV2Basics(car, v2));
    expect(noManual.engine).toEqual({ value: "2.0 · 150 kW", csdd: false });

    v2.tech.engine = "2.0 TDI hibrīds";
    const withManual = autoparksV2PriceSheet(car, v2, autoparksV2Basics(car, v2));
    expect(withManual.engine).toEqual({ value: "2.0 TDI hibrīds", csdd: false });
  });

  it("J30: pārnesumkārba ar roku ievadīta cenu lapā uzvar pār registry.gearbox", () => {
    const v2 = emptyCarV2();
    v2.tech.gearbox = "Manuālā";
    const s = autoparksV2PriceSheet(car, v2, autoparksV2Basics(car, v2));
    expect(s.gearbox).toBe("Manuālā");
  });
});
