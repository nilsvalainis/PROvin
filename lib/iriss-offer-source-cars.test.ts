import { describe, expect, it } from "vitest";
import {
  filterOfferSourceCars,
  offerSourceCarsFromAutoparks,
  offerSourceCarsFromLogistics,
} from "@/lib/iriss-offer-source-cars";

describe("offer source cars", () => {
  it("lists Autoparks cars without archived and sold ones", () => {
    const base = { make: "BMW", model: "320d Touring", year: "2020", color: "melna", vin: "WBA00000000123456", displayName: "" };
    const rows = offerSourceCarsFromAutoparks([
      { ...base, id: "a1", status: "for_sale", archivedAt: "" },
      { ...base, id: "a2", status: "sold", archivedAt: "" },
      { ...base, id: "a3", status: "in_service", archivedAt: "2026-10-01T00:00:00.000Z" },
      { ...base, id: "a4", status: "reserved", archivedAt: "", displayName: "BMW 320d Touring M Sport" },
    ]);
    expect(rows.map((r) => [r.id, r.title, r.sub])).toEqual([
      ["a1", "BMW 320d Touring", "2020 · melna"],
      ["a4", "BMW 320d Touring M Sport", "2020 · melna"],
    ]);
  });

  it("lists Logistics cars except archived ones and searches by VIN", () => {
    const rows = offerSourceCarsFromLogistics([
      { id: "l1", make: "Audi", model: "A6", title: "", vin: "WAUZZZ4G0EN123456", stockNo: "S-1", archived: false, status: "delivered" },
      { id: "l2", make: "VW", model: "Passat", title: "", vin: "", stockNo: "", archived: true, status: "ready" },
    ] as never);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: "l1", title: "Audi A6", sub: "VIN ...123456 · lot S-1" });
    expect(filterOfferSourceCars(rows, "en123")).toHaveLength(1);
    expect(filterOfferSourceCars(rows, "passat")).toHaveLength(0);
  });
});
