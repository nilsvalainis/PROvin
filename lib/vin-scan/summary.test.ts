import { describe, expect, it } from "vitest";

import { buildVinScanIndicator } from "@/lib/vin-scan/types";
import {
  buildVinScanOverview,
  collectVinScanMileage,
  detectVinScanMileageRollback,
  formatVinScanExportJson,
  formatVinScanExportText,
  formatVinScanScannedAt,
  mileageDateMs,
  odometerKm,
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
    row("rdw", { status: "found", summary: "2012 Volkswagen Golf", vehicle: { make: "Volkswagen", model: "Golf", year: "2012" } }),
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
          id: "lt_itpr",
          label: "LT policija",
          country: "LT",
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

describe("odometerKm (nobraukuma teksts)", () => {
  it("tūkstošu atdalītāji dod pilnus km", () => {
    expect(odometerKm("120,000 km")).toBe(120_000);
    expect(odometerKm("145.230 km")).toBe(145_230);
    expect(odometerKm("198 000 km")).toBe(198_000);
    expect(odometerKm("198 000 km")).toBe(198_000);
    expect(odometerKm("198 000 km")).toBe(198_000);
    expect(odometerKm("1.234.567 km")).toBe(1_234_567);
    expect(odometerKm("12345")).toBe(12_345);
  });

  it("mazs skaitlis joprojām nozīmē tūkstošus", () => {
    expect(odometerKm("12,5 tūkst. km")).toBe(12_500);
    expect(odometerKm("45")).toBe(45_000);
  });

  it("tukšs vai nulle nav rādījums", () => {
    expect(odometerKm("")).toBeNull();
    expect(odometerKm("km")).toBeNull();
    expect(odometerKm("0 km")).toBeNull();
  });
});

describe("mileageDateMs", () => {
  it("pieņem ISO, YYYYMMDD, DD.MM.YYYY un YYYY", () => {
    const iso = Date.UTC(2024, 2, 12);
    expect(mileageDateMs("2024-03-12")).toBe(iso);
    expect(mileageDateMs("20240312")).toBe(iso);
    expect(mileageDateMs("12.03.2024")).toBe(iso);
    expect(mileageDateMs("2024")).toBe(Date.UTC(2024, 0, 1));
  });

  it("nederīgu datumu neņem", () => {
    expect(mileageDateMs("")).toBeNull();
    expect(mileageDateMs("vakar")).toBeNull();
    expect(mileageDateMs("20241345")).toBeNull();
    expect(mileageDateMs("31.02.2024")).toBeNull();
  });
});

describe("detectVinScanMileageRollback ar jauktiem formātiem", () => {
  it("atrod reālu atritinājumu dažādos datuma un km formātos", () => {
    expect(
      detectVinScanMileageRollback([
        { date: "12.03.2021", odometer: "120,000 km", source: "a" },
        { date: "20220610", odometer: "145.230 km", source: "b" },
        { date: "2024", odometer: "98 000 km", source: "c" },
      ]),
    ).toBe(true);
  });

  it("augošs nobraukums jauktos formātos nav atritinājums", () => {
    expect(
      detectVinScanMileageRollback([
        { date: "2021", odometer: "98 000 km", source: "c" },
        { date: "20220610", odometer: "120,000 km", source: "a" },
        { date: "12.03.2024", odometer: "145.230 km", source: "b" },
      ]),
    ).toBe(false);
  });

  it("agrāk kļūdaini: 120,000 un 145.230 nedrīkst izskatīties kā 120 un 145 km", () => {
    // Ar veco parsēšanu 145.230 -> 145,23 km un 120,000 -> 120 km, tāpēc kritums netika pamanīts.
    expect(
      detectVinScanMileageRollback([
        { date: "2022-01-01", odometer: "145.230 km", source: "a" },
        { date: "2023-01-01", odometer: "120,000 km", source: "b" },
      ]),
    ).toBe(true);
  });
});

describe("odometerKm ar papildu tekstu", () => {
  it("neapvieno km ar gadu, kas seko aiz teksta", () => {
    expect(odometerKm("145 230 km · 2024")).toBe(145_230);
  });
});
