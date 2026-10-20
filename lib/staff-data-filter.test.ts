import { describe, expect, it } from "vitest";
import {
  hasForbiddenLogisticsKey,
  logisticsVinShort,
  stripForbiddenLogisticsFields,
  toLogisticsTripView,
} from "@/lib/staff-data-filter";

describe("logistics data filter", () => {
  it("keeps driver name and vehicle, hides prices and client fields", () => {
    const raw = {
      id: "t1",
      vehicleTitle: "VW Passat",
      pointName: "Bremen",
      hours: "8-16",
      driverName: "Jānis Paraugs",
      vehiclePlate: "AB-1234",
      vin: "WVWZZZ3CZWE123456",
      purchasePrice: 8900,
      clientName: "Slepens",
      clientPhone: "+37120000000",
      driverPassport: "LV123",
    };
    expect(hasForbiddenLogisticsKey(raw)).toBe(true);
    const stripped = stripForbiddenLogisticsFields(raw);
    expect(stripped).not.toHaveProperty("purchasePrice");
    expect(stripped).not.toHaveProperty("clientName");
    expect(stripped).not.toHaveProperty("driverPassport");
    expect(stripped.vinShort).toBe("123456");
    const view = toLogisticsTripView(raw);
    expect(view.driverName).toBe("Jānis Paraugs");
    expect(view.vehiclePlate).toBe("AB-1234");
    expect(view.vinShort).toBe("123456");
    expect(view).not.toHaveProperty("purchasePrice");
  });

  it("shortens VIN to the last 6 characters", () => {
    expect(logisticsVinShort("WVWZZZ3CZWE999888")).toBe("999888");
    expect(logisticsVinShort("AB12")).toBe("AB12");
  });
});
