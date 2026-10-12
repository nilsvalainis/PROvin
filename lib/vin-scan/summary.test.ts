import { describe, expect, it } from "vitest";

import { buildVinScanIndicator } from "@/lib/vin-scan/types";
import {
  buildVinScanOverview,
  collectVinScanMileage,
  formatVinScanExportJson,
  formatVinScanExportText,
  formatVinScanScannedAt,
  pickVinScanVehicle,
} from "@/lib/vin-scan/summary";

const VIN = "TMBJH9NP9N7043581";

function row(
  id: Parameters<typeof buildVinScanIndicator>[0],
  parsed: Parameters<typeof buildVinScanIndicator>[2],
) {
  return buildVinScanIndicator(id, VIN, parsed);
}

describe("vin scan summary", () => {
  const rows = [
    row("nhtsa", { status: "found", summary: "2012 Volkswagen Golf", vehicle: { make: "Volkswagen", model: "Golf", year: "2012" } }),
    row("tjekbil", {
      status: "found",
      summary: "2012 SKODA SUPERB",
      vehicle: { make: "SKODA", model: "SUPERB", year: "2012" },
    }),
    row("esyn", {
      status: "found",
      summary: "1 apskate",
      mileage: [{ date: "2025-08-22", odometer: "385 537 km" }],
    }),
    row("mnt_ee", {
      status: "found",
      summary: "EE",
      mileage: [{ date: "2024-03-12", odometer: "145 230 km" }],
    }),
  ];

  it("tjekbil marku/gadu ņem pirmām kārtām un savāc nobraukumu", () => {
    expect(pickVinScanVehicle(rows)).toEqual({ make: "SKODA", model: "SUPERB", year: "2012" });
    expect(collectVinScanMileage(rows).map((r) => r.date)).toEqual(["2025-08-22", "2024-03-12"]);
    expect(buildVinScanOverview(rows).vehicleLine).toBe("2012 SKODA SUPERB");
    expect(buildVinScanOverview(rows).mileageLine).toContain("esyn.dk");
    expect(buildVinScanOverview(rows).mileageLine).toContain("mnt.ee");
  });

  it("Rīgas laiks un eksports", () => {
    const when = formatVinScanScannedAt("2026-10-12T09:00:00.000Z");
    expect(when).toMatch(/12\.10\.2026/);
    expect(when).toMatch(/12:00/);
    const text = formatVinScanExportText({ vin: VIN, scannedAt: "2026-10-12T09:00:00.000Z", rows });
    expect(text).toContain(VIN);
    expect(text).toContain("SKODA SUPERB");
    expect(text).toContain("tjekbil.dk");
    const json = JSON.parse(formatVinScanExportJson({ vin: VIN, scannedAt: "2026-10-12T09:00:00.000Z", rows })) as {
      vehicle: { make: string };
      mileage: unknown[];
    };
    expect(json.vehicle.make).toBe("SKODA");
    expect(json.mileage).toHaveLength(2);
  });

  it("policijas avotam eksportā raksta meklēšanā / nav meklēšanā", () => {
    const text = formatVinScanExportText({
      vin: VIN,
      scannedAt: "2026-10-12T09:00:00.000Z",
      rows: [
        {
          id: "vp_wanted",
          label: "VP meklētie",
          country: "LV",
          status: "found",
          summary: "Meklēšanā",
        },
        {
          id: "lt_itpr",
          label: "LT policija",
          country: "LT",
          status: "none",
          summary: "Nav meklēšanā",
        },
      ],
    });
    expect(text).toContain("meklēšanā");
    expect(text).toContain("nav meklēšanā");
  });
});
