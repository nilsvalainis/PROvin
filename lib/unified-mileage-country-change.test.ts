import { describe, expect, it } from "vitest";
import { classifyOdometerAnomalies } from "@/lib/odometer-anomaly-classify";
import { analyzeUnifiedMileageAnomalies, type UnifiedMileageRow } from "@/lib/unified-mileage";

function row(sourceOrder: number, date: string, km: number, country: string, sourceLabel = "CSDD"): UnifiedMileageRow {
  const [d, m, y] = date.split(".").map(Number);
  return {
    date,
    odometer: String(km),
    country,
    sortableTime: Date.UTC(y!, m! - 1, d!),
    sourceOrder,
    sourceLabel,
  } as UnifiedMileageRow;
}

describe("nobraukums ap valsts maiņu (Nils 18.11)", () => {
  it("izolēts zems rādījums tajā pašā valstī ir ievades kļūda", () => {
    const rows = [
      row(1, "01.01.2020", 100_000, "Vācija", "AutoDNA"),
      row(2, "01.03.2020", 60_000, "Vācija", "AutoDNA"),
      row(3, "01.05.2020", 104_000, "Vācija", "AutoDNA"),
    ];
    expect(analyzeUnifiedMileageAnomalies(rows).dataEntryErrorSourceOrders.has(2)).toBe(true);
    expect(classifyOdometerAnomalies(rows).map((a) => a.class)).toEqual(["typo_outlier"]);
  });

  it("tāds pats zems rādījums pirmajā ierakstā jaunajā valstī ir kritums, ne ievades kļūda", () => {
    const rows = [
      row(1, "01.01.2020", 100_000, "Vācija", "AutoDNA"),
      row(2, "01.03.2020", 60_000, "Latvija"),
      row(3, "01.05.2020", 104_000, "Latvija"),
    ];
    const a = analyzeUnifiedMileageAnomalies(rows);
    expect(a.dataEntryErrorSourceOrders.has(2)).toBe(false);
    expect(a.anomalyBySourceOrder.get(2)).toBe(true);
    expect(classifyOdometerAnomalies(rows).map((x) => x.class)).toEqual(["rollback"]);
  });

  it("sludinājuma valsts nav valsts maiņa", () => {
    const rows = [
      row(1, "01.01.2020", 100_000, "Vācija", "AutoDNA"),
      { ...row(2, "01.03.2020", 60_000, "Latvija", "AutoDNA"), countryUnverified: true },
      row(3, "01.05.2020", 104_000, "Vācija", "AutoDNA"),
    ];
    expect(analyzeUnifiedMileageAnomalies(rows).dataEntryErrorSourceOrders.has(2)).toBe(true);
  });
});
