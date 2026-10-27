import { describe, expect, it } from "vitest";
import {
  GERMANY_BOUNDS,
  logisticsCarMapLabel,
  logisticsDefaultBox,
  logisticsDefaultPadding,
  logisticsPreviousPointLabel,
  pickLogisticsLabelSides,
} from "@/lib/iriss-logistics-labels";

describe("Loģistikas kartes noklusējuma skats (Nils 27.10: visa Vācija)", () => {
  it("bez punktiem un ar punktiem Vācijā - tieši Vācijas rāmis", () => {
    expect(logisticsDefaultBox([])).toEqual(GERMANY_BOUNDS);
    expect(logisticsDefaultBox([{ lat: 51.05, lng: 13.74 }, { lat: 50.1, lng: 8.68 }])).toEqual(GERMANY_BOUNDS);
  });

  it("auto ārpus Vācijas (Venlo, Rīga) paplašina rāmi", () => {
    const box = logisticsDefaultBox([{ lat: 51.37, lng: 6.17 }, { lat: 56.95, lng: 24.1 }]);
    expect(box.north).toBe(56.95);
    expect(box.east).toBe(24.1);
    expect(box.west).toBe(5.8);
  });

  it("datorā labajā pusē vieta Kravu plānam, telefonā mazas atstarpes", () => {
    expect(logisticsDefaultPadding(1600).right).toBe(480);
    expect(logisticsDefaultPadding(390)).toEqual({ top: 24, right: 16, bottom: 24, left: 16 });
  });
});

describe("map labels", () => {
  it("uses make + model · auction without numbers", () => {
    expect(logisticsCarMapLabel({ make: "Volkswagen", model: "Passat Variant 2.0 TDI", auction: "Openlane" })).toBe(
      "VW Passat · Openlane",
    );
    expect(logisticsCarMapLabel({ make: "BMW", model: "520d Touring", auction: "Autobid" })).toBe("BMW 520d · Autobid");
    expect(logisticsPreviousPointLabel({ city: "Bremen", name: "Openlane Bremen", auction: "Openlane" })).toBe(
      "Bremen · Openlane",
    );
  });

  it("hides overlapping unselected labels", () => {
    const sides = pickLogisticsLabelSides(
      [
        { id: "a", x: 40, y: 40, selected: true },
        { id: "b", x: 44, y: 40, selected: false },
      ],
      { w: 200, h: 80, labelW: 90, labelH: 16 },
    );
    expect(sides.a).not.toBe("hidden");
    expect(["left", "right", "top", "bottom", "hidden"]).toContain(sides.b);
  });
});
