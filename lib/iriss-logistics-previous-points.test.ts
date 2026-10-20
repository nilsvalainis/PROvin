import { describe, expect, it } from "vitest";
import { previousLogisticsPoints } from "@/lib/iriss-logistics-previous-points";
import type { LogisticsOrder, LogisticsPoint } from "@/lib/iriss-logistics-types";

describe("previous points (12 months)", () => {
  it("counts uses and sorts by frequency", () => {
    const point = {
      id: "lp-1",
      workspace: "iriss",
      auction: "Openlane",
      name: "Openlane Bremen",
      street: "Musterstraße 1",
      postcode: "28000",
      city: "Bremen",
      country: "DE",
      lat: 53.08,
      lng: 8.8,
      hours: [],
      hoursText: "",
      contactName: "",
      phone: "",
      email: "",
      parkingRule: null,
      rules: "",
      requiredDocs: [],
      notes: "",
      pickupCodes: [],
      active: true,
      createdAt: "",
      updatedAt: "",
      updatedBy: "",
    } as LogisticsPoint;
    const mk = (id: string, pickupDate: string): LogisticsOrder =>
      ({
        id,
        pickupPointId: "lp-1",
        pickupDate,
        createdAt: pickupDate,
      }) as LogisticsOrder;
    const now = Date.parse("2026-10-20T00:00:00.000Z");
    const rows = previousLogisticsPoints({
      points: [point],
      orders: [mk("a", "2026-09-01"), mk("b", "2026-01-01"), mk("old", "2024-01-01")],
      nowMs: now,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.useCount).toBe(2);
    expect(rows[0]?.lastPickupDate.startsWith("2026-09-01")).toBe(true);
  });
});
