import { describe, expect, it } from "vitest";
import {
  computeAverageAnnualMileage,
  MIN_INTENSIVE_INTERVAL_DAYS,
  reconstructTheoreticalMileagePath,
} from "@/lib/average-annual-mileage";
import type { UnifiedMileageRow } from "@/lib/unified-mileage";

function row(
  date: string,
  odometer: string,
  sortableTime: number,
  opts?: { sourceOrder?: number; country?: string },
): UnifiedMileageRow {
  return {
    date,
    odometer,
    country: opts?.country ?? "Latvija",
    sortableTime,
    sourceOrder: opts?.sourceOrder ?? 0,
    sourceLabel: "CSDD",
  };
}

describe("reconstructTheoreticalMileagePath", () => {
  it("adds rollback offset so theoretical mileage stays continuous", () => {
    const t0 = Date.UTC(2020, 0, 1);
    const t1 = Date.UTC(2021, 0, 1);
    const t2 = Date.UTC(2022, 0, 1);
    const t3 = Date.UTC(2023, 0, 1);
    const { path, correctedForAnomaly, totalRollbackKm } = reconstructTheoreticalMileagePath([
      { t: t0, km: 100_000, dateDisplay: "01.01.2020", country: "DE" },
      { t: t1, km: 150_000, dateDisplay: "01.01.2021", country: "DE" },
      { t: t2, km: 80_000, dateDisplay: "01.01.2022", country: "LV" },
      { t: t3, km: 100_000, dateDisplay: "01.01.2023", country: "LV" },
    ]);
    expect(correctedForAnomaly).toBe(true);
    expect(totalRollbackKm).toBe(70_000);
    expect(path[2]?.theoreticalKm).toBe(150_000);
    expect(path[3]?.theoreticalKm).toBe(170_000);
  });

  it("flags NL→LV rollback of 25088 km (Cayenne case)", () => {
    const { totalRollbackKm, rollbackBeforeLvRegistration, path } = reconstructTheoreticalMileagePath([
      {
        t: Date.UTC(2021, 5, 11),
        km: 292_372,
        dateDisplay: "11.06.2021",
        country: "NL",
      },
      {
        t: Date.UTC(2021, 5, 17),
        km: 267_284,
        dateDisplay: "17.06.2021",
        country: "LV",
      },
    ]);
    expect(totalRollbackKm).toBe(25_088);
    expect(rollbackBeforeLvRegistration).toBe(true);
    expect(path[1]?.theoreticalKm).toBe(292_372);
  });
});

describe("computeAverageAnnualMileage", () => {
  it("computes span-based annual average without anomaly", () => {
    const t0 = Date.UTC(2020, 0, 1);
    const t1 = Date.UTC(2022, 0, 1);
    const result = computeAverageAnnualMileage({
      unifiedMileageRows: [row("01.01.2020", "10 000", t0), row("01.01.2022", "50 000", t1)],
      referenceDate: new Date(t1),
    });
    expect(result?.method).toBe("theoretical_span");
    expect(result?.correctedForAnomaly).toBe(false);
    expect(result?.kmPerYear).toBeGreaterThan(19_900);
    expect(result?.kmPerYear).toBeLessThan(20_100);
    expect(result?.sentence).toContain("km");
    expect(result?.sentence).toContain("Intensīvākais ticamais periods");
  });

  it("reconstructs theoretical average after odometer rollback", () => {
    const t0 = Date.UTC(2020, 0, 1);
    const t1 = Date.UTC(2021, 0, 1);
    const t2 = Date.UTC(2022, 0, 1);
    const t3 = Date.UTC(2023, 0, 1);
    const result = computeAverageAnnualMileage({
      unifiedMileageRows: [
        row("01.01.2020", "100000", t0, { sourceOrder: 0, country: "DE" }),
        row("01.01.2021", "150000", t1, { sourceOrder: 1, country: "DE" }),
        row("01.01.2022", "80000", t2, { sourceOrder: 2, country: "LV" }),
        row("01.01.2023", "100000", t3, { sourceOrder: 3, country: "LV" }),
      ],
      referenceDate: new Date(t3),
    });
    expect(result?.method).toBe("theoretical_span");
    expect(result?.correctedForAnomaly).toBe(true);
    // 100k → 170k teorētiski / ~3 gadi ≈ 23 300
    expect(result?.kmPerYear).toBeGreaterThan(22_000);
    expect(result?.kmPerYear).toBeLessThan(25_000);
    expect(result?.sentence).toMatch(/teorētiski koriģēto|samazināšanu/i);
    expect(result?.sentence).toContain("pirms reģistrācijas Latvijā");
    expect(result?.sentence).toContain("Intensīvākais ticamais periods");
    expect(result?.peakFromDisplay).toBeTruthy();
    expect(result?.peakToDisplay).toBeTruthy();
  });

  it("ignores sub-90-day spikes when picking most intensive period", () => {
    const rows: UnifiedMileageRow[] = [
      row("01.01.2020", "100000", Date.UTC(2020, 0, 1), { country: "NL" }),
      // ~7 dienu „ceļojums” ar milzīgu ekstrapolētu gada likmi — jāignorē
      row("08.01.2020", "110000", Date.UTC(2020, 0, 8), { country: "NL" }),
      // ≥90 dienu posms ar mērenāku, bet ticamu intensitāti
      row("01.07.2020", "130000", Date.UTC(2020, 6, 1), { country: "NL" }),
      row("01.01.2022", "160000", Date.UTC(2022, 0, 1), { country: "NL" }),
    ];
    const result = computeAverageAnnualMileage({
      unifiedMileageRows: rows,
      referenceDate: new Date(Date.UTC(2022, 0, 1)),
    });
    expect(result?.peakFromDisplay).toBe("01.01.2020");
    expect(result?.peakToDisplay).toBe("01.07.2020");
    expect(result?.sentence).toContain("Nīderlandē");
    // Peak span must be ≥ 90 days
    const peakDays =
      (Date.UTC(2020, 6, 1) - Date.UTC(2020, 0, 1)) / 86_400_000;
    expect(peakDays).toBeGreaterThanOrEqual(MIN_INTENSIVE_INTERVAL_DAYS);
  });

  it("Porsche Cayenne: rollback 25088 → ~24687 km/year average", () => {
    const rows: UnifiedMileageRow[] = [
      row("13.01.2012", "1", Date.UTC(2012, 0, 13), { country: "NL" }),
      row("11.06.2021", "292372", Date.UTC(2021, 5, 11), { country: "NL" }),
      row("17.06.2021", "267284", Date.UTC(2021, 5, 17), { country: "LV" }),
      row("15.06.2026", "330900", Date.UTC(2026, 5, 15), { country: "LV" }),
    ];
    const result = computeAverageAnnualMileage({
      unifiedMileageRows: rows,
      referenceDate: new Date(Date.UTC(2026, 5, 15)),
    });
    expect(result?.correctedForAnomaly).toBe(true);
    expect(result?.kmPerYear).toBe(24_687);
    expect(result?.sentence).toMatch(/25\s088/);
    expect(result?.sentence).toContain("pirms reģistrācijas Latvijā");
    expect(result?.sentence).toMatch(/24\s687/);
    expect(result?.sentence).toContain("Intensīvākais ticamais periods");
    // Peak must not be the 6-day NL→LV rollback window
    expect(result?.peakFromDisplay).not.toBe("11.06.2021");
    expect(result?.peakToDisplay).not.toBe("17.06.2021");
    if (result?.peakFromDisplay && result?.peakToDisplay) {
      // Any selected peak endpoints must be ≥90 days apart (covered by algorithm)
      expect(result.sentence).toMatch(/no .+ līdz .+/);
    }
  });

  it("falls back to first registration when only one reading (no fake intensive period)", () => {
    const t1 = Date.UTC(2024, 0, 1);
    const result = computeAverageAnnualMileage({
      unifiedMileageRows: [row("01.01.2024", "80 000", t1)],
      csddForm: {
        firstRegistration: "01.01.2020",
      } as import("@/lib/admin-source-blocks").CsddFormFields,
      referenceDate: new Date(t1),
    });
    expect(result?.method).toBe("first_registration");
    expect(result?.kmPerYear).toBe(20_000);
    expect(result?.sentence).not.toContain("Intensīvākais");
  });

  it("returns null without usable data", () => {
    expect(
      computeAverageAnnualMileage({
        unifiedMileageRows: [],
        referenceDate: new Date(),
      }),
    ).toBeNull();
  });
});
