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
});
