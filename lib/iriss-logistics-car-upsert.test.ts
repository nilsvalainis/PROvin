import { describe, expect, it } from "vitest";
import {
  isLogisticsUpsertVin,
  normalizeLogisticsVin,
  parseLogisticsCarUpsertInput,
} from "@/lib/iriss-logistics-car-upsert";
import {
  LOGISTICS_ORDER_STATUS_LV,
  parseLogisticsIsoDate,
  parseLogisticsOrderStatus,
} from "@/lib/iriss-logistics-types";

describe("Loģistika car upsert parsing", () => {
  it("accepts the v5.1 pipeline statuses from Latvian labels", () => {
    expect(parseLogisticsOrderStatus("gaida apmaksu")).toBe("awaiting_payment");
    expect(parseLogisticsOrderStatus("dokumenti tiek izdoti")).toBe("documents_issuing");
    expect(parseLogisticsOrderStatus("gatavs savākšanai")).toBe("ready_for_pickup");
    expect(parseLogisticsOrderStatus("savākšana apstiprināta")).toBe("pickup_confirmed");
    expect(parseLogisticsOrderStatus("ceļā uz noliktavu")).toBe("in_transit_to_warehouse");
    expect(LOGISTICS_ORDER_STATUS_LV.awaiting_payment).toBe("Gaida apmaksu");
    expect(LOGISTICS_ORDER_STATUS_LV.documents_issuing).toBe("Dokumenti tiek izdoti");
    expect(LOGISTICS_ORDER_STATUS_LV.ready_for_pickup).toBe("Gatavs savākšanai");
    expect(LOGISTICS_ORDER_STATUS_LV.pickup_confirmed).toBe("Savākšana apstiprināta");
    expect(LOGISTICS_ORDER_STATUS_LV.in_transit_to_warehouse).toBe("Ceļā uz noliktavu");
  });

  it("keeps existing archive statuses and English keys", () => {
    expect(parseLogisticsOrderStatus("picked_up")).toBe("picked_up");
    expect(parseLogisticsOrderStatus("Izņemts")).toBe("picked_up");
    expect(parseLogisticsOrderStatus("ready")).toBe("ready");
    expect(parseLogisticsOrderStatus("nav tada")).toBe(null);
  });

  it("parses parking dates and VIN", () => {
    expect(parseLogisticsIsoDate("2026-11-02")).toBe("2026-11-02");
    expect(parseLogisticsIsoDate("02.11.2026")).toBe("2026-11-02");
    expect(normalizeLogisticsVin(" wvw zzz 3cz le012345 ")).toBe("WVWZZZ3CZLE012345");
    expect(isLogisticsUpsertVin("WVWZZZ3CZLE012345")).toBe(true);
    expect(isLogisticsUpsertVin("SHORT")).toBe(false);
  });

  it("maps Bearer car fields including stock/lot, pickup and note", () => {
    const parsed = parseLogisticsCarUpsertInput({
      vin: "WVWZZZ3CZLE012345",
      auction: "auto1",
      stock_no: "11630702",
      make: "Volkswagen",
      model: "Passat",
      pickup_point: "Openlane Bremen",
      address: "Musterstraße 1, 28000 Bremen, DE",
      status: "gatavs savākšanai",
      pickup_code: "AB-19",
      free_parking_until: "05.11.2026",
      note: "Zvanīt pirms izbraukšanas",
    });
    expect(parsed.error).toBe("");
    expect(parsed.patch).toMatchObject({
      vin: "WVWZZZ3CZLE012345",
      auction: "Auto1",
      stockNo: "11630702",
      make: "Volkswagen",
      model: "Passat",
      pickupPointId: "Openlane Bremen",
      pickupAddress: "Musterstraße 1, 28000 Bremen, DE",
      status: "ready_for_pickup",
      pickupRef: "AB-19",
      freeParkingUntil: "2026-11-05",
      notes: "Zvanīt pirms izbraukšanas",
    });
  });

  it("rejects a missing VIN and an unknown status", () => {
    expect(parseLogisticsCarUpsertInput({ make: "BMW" }).error).toBe("invalid_vin");
    expect(parseLogisticsCarUpsertInput({ vin: "WVWZZZ3CZLE012345", status: "izdomats" }).error).toBe(
      "invalid_status",
    );
  });
});
