import { describe, expect, it } from "vitest";

import {
  analyzeMileageRates,
  analyzeOdometerRollbackBounds,
  analyzeSourceIndependence,
  buildMileageRateBrief,
  buildOdometerRollbackBoundsBrief,
  buildSourceIndependenceBrief,
  formatForensicsInt,
} from "@/lib/admin-ai-mileage-forensics";
import type { UnifiedMileageRow } from "@/lib/unified-mileage";

function row(
  partial: Partial<UnifiedMileageRow> & Pick<UnifiedMileageRow, "date" | "odometer" | "sourceLabel">,
): UnifiedMileageRow {
  return {
    country: "IT",
    sourceOrder: 0,
    sortableTime: partial.sortableTime ?? 0,
    ...partial,
  };
}

/** BMW X5 e70 WBAFF41000L134369 - saīsināta hronoloģija no audita. */
function x5Rows(): UnifiedMileageRow[] {
  return [
    row({
      date: "02.10.2009",
      odometer: "58589",
      sourceLabel: "OFICIĀLĀ DĪLERA DATI",
      sourceOrder: 0,
      sortableTime: Date.UTC(2009, 9, 2),
    }),
    row({
      date: "01.12.2009",
      odometer: "90577",
      sourceLabel: "CarVertical",
      sourceOrder: 1,
      sortableTime: Date.UTC(2009, 11, 1),
    }),
    row({
      date: "22.12.2009",
      odometer: "90599",
      sourceLabel: "OFICIĀLĀ DĪLERA DATI",
      sourceOrder: 2,
      sortableTime: Date.UTC(2009, 11, 22),
    }),
    row({
      date: "01.12.2011",
      odometer: "63573",
      sourceLabel: "CarVertical",
      sourceOrder: 3,
      sortableTime: Date.UTC(2011, 11, 1),
    }),
    row({
      date: "23.12.2011",
      odometer: "63595",
      sourceLabel: "OFICIĀLĀ DĪLERA DATI",
      sourceOrder: 4,
      sortableTime: Date.UTC(2011, 11, 23),
    }),
    row({
      date: "01.02.2016",
      odometer: "87356",
      sourceLabel: "CarVertical",
      sourceOrder: 5,
      sortableTime: Date.UTC(2016, 1, 1),
    }),
    row({
      date: "02.02.2016",
      odometer: "87378",
      sourceLabel: "OFICIĀLĀ DĪLERA DATI",
      sourceOrder: 6,
      sortableTime: Date.UTC(2016, 1, 2),
    }),
    row({
      date: "01.06.2016",
      odometer: "93173",
      sourceLabel: "CarVertical",
      sourceOrder: 7,
      sortableTime: Date.UTC(2016, 5, 1),
    }),
    row({
      date: "30.06.2016",
      odometer: "93195",
      sourceLabel: "OFICIĀLĀ DĪLERA DATI",
      sourceOrder: 8,
      sortableTime: Date.UTC(2016, 5, 30),
    }),
    row({
      date: "01.03.2018",
      odometer: "120010",
      sourceLabel: "CarVertical",
      sourceOrder: 9,
      sortableTime: Date.UTC(2018, 2, 1),
    }),
    row({
      date: "12.03.2018",
      odometer: "120032",
      sourceLabel: "OFICIĀLĀ DĪLERA DATI",
      sourceOrder: 10,
      sortableTime: Date.UTC(2018, 2, 12),
    }),
  ];
}

function quietLinearRows(): UnifiedMileageRow[] {
  return [
    row({
      date: "01.01.2018",
      odometer: "80000",
      sourceLabel: "CSDD",
      sourceOrder: 0,
      sortableTime: Date.UTC(2018, 0, 1),
    }),
    row({
      date: "01.01.2019",
      odometer: "100000",
      sourceLabel: "CSDD",
      sourceOrder: 1,
      sortableTime: Date.UTC(2019, 0, 1),
    }),
    row({
      date: "01.01.2020",
      odometer: "120000",
      sourceLabel: "CSDD",
      sourceOrder: 2,
      sortableTime: Date.UTC(2020, 0, 1),
    }),
  ];
}

describe("mileage rate brief", () => {
  it("flags the X5 2009 burst as extreme and the later crawl as idle", () => {
    const { notable, idleAfterIntense } = analyzeMileageRates(x5Rows());
    expect(notable.some((x) => x.rateClass === "extreme")).toBe(true);
    const burst = notable.find((x) => x.fromKm === 58589);
    expect(burst?.deltaKm).toBe(32010);
    expect(burst?.days).toBe(81);
    expect(Math.round(burst?.kmPerDay ?? 0)).toBe(395);
    expect(idleAfterIntense.length).toBeGreaterThan(0);

    const brief = buildMileageRateBrief(x5Rows());
    expect(brief).toMatch(/EKSTRĒMS/);
    expect(brief).toMatch(/395 km\/dienā/);
    expect(brief).toMatch(/līdz galam izskaidrot nevaram/);
  });

  it("stays silent on a quiet 20 000 km/year line", () => {
    expect(buildMileageRateBrief(quietLinearRows())).toBe("");
  });
});

describe("source independence brief", () => {
  it("flags CarVertical vs dealer when the offset is constant across months", () => {
    const pairs = analyzeSourceIndependence(x5Rows());
    expect(pairs).toHaveLength(1);
    expect(pairs[0]?.pairCount).toBeGreaterThanOrEqual(4);
    expect(Math.round(Math.abs(pairs[0]?.medianOffsetKm ?? 0))).toBe(22);

    const brief = buildSourceIndependenceBrief(x5Rows());
    expect(brief).toMatch(/NAV neatkarīgi/);
    expect(brief).toMatch(/CarVertical/);
    expect(brief).toMatch(/22 km/);
  });

  it("does not flag a single source", () => {
    expect(analyzeSourceIndependence(quietLinearRows())).toEqual([]);
    expect(buildSourceIndependenceBrief(quietLinearRows())).toBe("");
  });
});

describe("odometer rollback bounds brief", () => {
  it("reports the X5 minimum drop and an arithmetic ceiling", () => {
    const bounds = analyzeOdometerRollbackBounds(x5Rows());
    expect(bounds).toHaveLength(1);
    expect(bounds[0]?.minDropKm).toBe(27004);
    expect(bounds[0]?.gapDays).toBe(731);
    expect(bounds[0]?.maxDropKm).toBeGreaterThan(27004);

    const brief = buildOdometerRollbackBoundsBrief(x5Rows());
    expect(brief).toMatch(/27 004 km/);
    expect(brief).toMatch(/731 dienas/);
    expect(brief).toMatch(/APRĒĶINA robeža/);
    expect(brief).toMatch(/nevaram/);
  });

  it("stays silent when km only climbs", () => {
    expect(buildOdometerRollbackBoundsBrief(quietLinearRows())).toBe("");
  });
});

describe("formatForensicsInt", () => {
  it("uses a regular space thousands separator", () => {
    expect(formatForensicsInt(27004)).toBe("27 004");
  });
});
