import { describe, expect, it } from "vitest";
import { logisticsCarMapLabel, logisticsPreviousPointLabel, pickLogisticsLabelSides } from "@/lib/iriss-logistics-labels";

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
