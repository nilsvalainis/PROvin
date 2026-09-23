import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { createDefaultSourceBlocks, toPdfManualVendorBlocks } from "@/lib/admin-source-blocks";
import {
  applyFinnikReportToBlock,
  parseDutchOdometer,
  parseFinnikReport,
} from "@/lib/finnik-report-parse";
import { buildVehicleLifecycleEvents } from "@/lib/vehicle-lifecycle-timeline";

function fixture(name: string): string {
  return readFileSync(path.join(process.cwd(), "lib/fixtures/finnik", name), "utf8");
}

function kmOf(text: string, date: string): string | undefined {
  return parseFinnikReport(text)?.mileage.find((row) => row.date === date)?.odometer;
}

describe("parseDutchOdometer", () => {
  it("treats the dot as a thousands separator, including spaced premium digits", () => {
    expect(parseDutchOdometer("101.303 km")).toBe("101303");
    expect(parseDutchOdometer("8.686")).toBe("8686");
    expect(parseDutchOdometer("2 2 2 . 9 4 8")).toBe("222948");
    expect(parseDutchOdometer("8 . 6 8 6")).toBe("8686");
    expect(parseDutchOdometer("3 0")).toBe("30");
  });
});

describe("parseFinnikReport", () => {
  it("parses the ID.3 scan: reported km only, taxi Ja, APK mark without the finding", () => {
    const parsed = parseFinnikReport(fixture("k587dt.txt"));
    expect(parsed).toBeTruthy();
    expect(parsed!.plate).toBe("k587dt");
    expect(parsed!.taxi).toBe("ja");
    expect(parsed!.fuel).toBe("elektrība");
    expect(parsed!.mileage.map((row) => `${row.date} ${row.odometer}`)).toEqual([
      "04.08.2026 101303",
      "13.07.2026 101247",
    ]);
    expect(parsed!.exportDate).toBe("");
    expect(parsed!.statusRecords).toMatch(/Eksports: Jā/);
    expect(parsed!.statusRecords).toMatch(/TAXI: Jā/);
    expect(parsed!.statusRecords).toMatch(/Paralēlais imports: Nē/);
    expect(parsed!.statusRecords).toMatch(/Atsaukumi: nav/);
    expect(parsed!.ownersSummary).toMatch(/Importētājs/);
    expect(parsed!.ownersSummary).toMatch(/04\.08\.2026-šobrīd Autosalons/);
    const apk = parsed!.timeline.find((row) => row.date === "23.12.2024");
    expect(apk?.event).toBe("Tehniskā apskate");
    expect(apk?.event).not.toMatch(/393|sproei/i);
    const ownerKm = parsed!.timeline.find((row) => row.date === "04.08.2026" && row.event.startsWith("Īpašnieks"));
    expect(ownerKm?.odometer).toBe("101303");
    expect(parsed!.timeline.some((row) => row.event === "Nobraukums reģistrā" && row.date === "04.08.2026")).toBe(
      false,
    );
    expect(parsed!.timeline.some((row) => row.event === "Eksportēts")).toBe(false);
    expect(parsed!.aiContextRaw).toMatch(/kods 393/);
    expect(parsed!.aiContextRaw).toMatch(/Vermoedelijke kilometerstand/);
    expect(parsed!.aiContextRaw).not.toMatch(/€|35\.438|\bBPM\b/i);
  });

  it("keeps Tesla presumed kilometres and the listing out of the official chart", () => {
    const text = fixture("h208bf.txt");
    const parsed = parseFinnikReport(text);
    expect(parsed!.plate).toBe("h208bf");
    expect(parsed!.taxi).toBe("ja");
    expect(parsed!.mileage.map((row) => row.date)).toEqual(["09.05.2025", "02.05.2025", "26.02.2025"]);
    expect(new Set(parsed!.mileage.map((row) => row.odometer))).toEqual(new Set(["110663"]));
    expect(kmOf(text, "28.04.2025")).toBeUndefined();
    expect(kmOf(text, "14.05.2024")).toBeUndefined();
    expect(parsed!.timeline.find((row) => row.date === "15.01.2024")?.event).toBe("Tehniskā apskate");
    expect(parsed!.timeline.find((row) => row.date === "09.05.2025")?.event).toBe("Nobraukums reģistrā");
    expect(parsed!.statusRecords).toMatch(/Atsaukumi: 1 \(bez apraksta\)/);
    expect(parsed!.aiContextRaw).toMatch(/029/);
    expect(parsed!.aiContextRaw).toMatch(/Sludinājumi/);
    expect(parsed!.aiContextRaw).not.toMatch(/€/);
    expect(parsed!.exportDate).toBe("");
  });

  it("parses the premium e-tron layout: dated export, long reported history, no taxi, no 248.9", () => {
    const parsed = parseFinnikReport(fixture("h910db.txt"));
    expect(parsed!.plate).toBe("H-910-DB");
    expect(parsed!.taxi).toBeNull();
    expect(parsed!.statusRecords).not.toMatch(/TAXI/);
    expect(parsed!.exportDate).toBe("17.02.2025");
    expect(parsed!.timeline.some((row) => row.date === "17.02.2025" && row.event === "Eksportēts")).toBe(true);
    expect(parsed!.mileage.find((row) => row.odometer === "222948")).toBeTruthy();
    expect(parsed!.mileage.find((row) => row.odometer === "8686")).toBeTruthy();
    expect(parsed!.mileage.find((row) => row.odometer === "30")).toBeTruthy();
    expect(parsed!.mileage.find((row) => row.odometer === "20")).toBeTruthy();
    expect(parsed!.timeline.find((row) => row.date === "07.11.2023")?.event).toBe("Tehniskā apskate");
    expect(parsed!.aiContextRaw).toMatch(/kods 205/);
    expect(parsed!.aiContextRaw).toMatch(/22\.9 kWh/);
    expect(parsed!.aiContextRaw).not.toMatch(/248[.,]9/);
    expect(parsed!.aiContextRaw).not.toMatch(/€/);
    expect(parsed!.statusRecords).toMatch(/Atsaukumi: nav/);
  });

  it("parses the Kodiaq scan: taxi on a diesel, clean APK, unknown validity", () => {
    const parsed = parseFinnikReport(fixture("rj384j.txt"));
    expect(parsed!.plate).toBe("rj384j");
    expect(parsed!.taxi).toBe("ja");
    expect(parsed!.fuel).toBe("dīzelis");
    expect(parsed!.mileage.map((row) => `${row.date} ${row.odometer}`)).toEqual([
      "08.02.2022 109237",
      "01.02.2022 109212",
      "02.12.2021 109211",
    ]);
    expect(parsed!.apkValidUnknown).toBe(true);
    expect(parsed!.statusRecords).toMatch(/APK derīga līdz: nav datu/);
    expect(parsed!.timeline.filter((row) => row.event === "Tehniskā apskate").map((row) => row.date)).toEqual([
      "03.12.2020",
      "08.02.2022",
    ]);
    expect(parsed!.timeline.find((row) => row.date === "08.02.2022")?.odometer).toBe("109237");
    expect(parsed!.ownersSummary).toMatch(/Juridiska persona/);
    expect(parsed!.aiContextRaw).toMatch(/bez aizrādījumiem/);
    expect(parsed!.aiContextRaw).not.toMatch(/€|12\.148/);
    expect(parsed!.exportDate).toBe("");
  });

  it("puts APK on the timeline as an inspection mark and keeps findings out of the card", () => {
    const applied = applyFinnikReportToBlock(createDefaultSourceBlocks().finnik, fixture("k587dt.txt"));
    const blocks = createDefaultSourceBlocks();
    blocks.finnik = applied!.block;
    const section = toPdfManualVendorBlocks(blocks).find((block) => /nīderland/i.test(block.title));
    expect(section?.mileageRows.map((row) => row.odometer)).toEqual(["101303", "101247"]);
    const events = buildVehicleLifecycleEvents({ manualVendorBlocks: section ? [section] : [] });
    const inspections = events.filter((event) => event.kind === "inspection");
    expect(inspections.length).toBeGreaterThan(0);
    expect(inspections.every((event) => event.detail === "" && event.title === "Tehniskā apskate")).toBe(true);
  });

  it("does not replace an existing AI context", () => {
    const existing = createDefaultSourceBlocks().finnik;
    existing.aiContextRaw = "operatora piezīme";
    const applied = applyFinnikReportToBlock(existing, fixture("k587dt.txt"));
    expect(applied!.block.aiContextRaw).toBe("operatora piezīme");
    expect(applied!.block.mileage.some((row) => row.odometer === "101303")).toBe(true);
  });
});
