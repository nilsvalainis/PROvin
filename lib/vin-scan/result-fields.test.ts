import { describe, expect, it } from "vitest";

import { buildVinScanResultCard } from "@/lib/vin-scan/result-fields";

describe("buildVinScanResultCard", () => {
  it("veido kartīti no markas un nobraukuma", () => {
    const card = buildVinScanResultCard({
      id: "tjekbil",
      label: "tjekbil.dk",
      status: "found",
      vehicle: { make: "VOLKSWAGEN", model: "SHARAN", year: "2013" },
      mileage: [{ date: "2026-09-15", odometer: "198 579 km", source: "esyn.dk" }],
    });
    expect(card?.vehicle).toEqual({ make: "VOLKSWAGEN", model: "SHARAN", year: "2013" });
    expect(card?.mileage[0]?.odometer).toBe("198 579 km");
  });

  it("parsē apskates no detail, ja masīva nav", () => {
    const card = buildVinScanResultCard({
      id: "esyn",
      label: "esyn.dk",
      status: "found",
      detail: "2026-09-15, izturēta, 198 579 km\n2026-01-28, izturēta, 188 528 km",
    });
    expect(card?.inspections).toHaveLength(2);
    expect(card?.inspections[0]).toMatchObject({ date: "2026-09-15", result: "izturēta", odometer: "198 579 km" });
  });

  it("tukšs avots bez kartītes", () => {
    expect(
      buildVinScanResultCard({
        id: "bidfax",
        label: "BidFax",
        status: "none",
        summary: "Nav",
      }),
    ).toBeNull();
  });

  it("Nav statuss ar tukšu marku nav kartīte", () => {
    expect(
      buildVinScanResultCard({
        id: "nhtsa_recalls",
        label: "NHTSA atsaukumi",
        status: "none",
        vehicle: { make: "VOLKSWAGEN", model: "", year: "1984" },
      }),
    ).toBeNull();
  });

  it("apskates no detail nav atsaukumi", () => {
    const card = buildVinScanResultCard({
      id: "esyn",
      label: "esyn.dk",
      status: "found",
      detail: "2026-09-15, izturēta, 198 579 km\n2026-01-28, izturēta, 188 528 km",
    });
    expect(card?.inspections).toHaveLength(2);
    expect(card?.recalls).toEqual([]);
  });
});
