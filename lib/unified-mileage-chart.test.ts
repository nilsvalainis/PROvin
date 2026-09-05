import { describe, expect, it } from "vitest";
import {
  buildSourceMileageSparkHtml,
  buildUnifiedMileageChartWrapHtml,
  monotoneCubicSvgPath,
  pickNonOverlappingYearTicks,
  splitMileageChartRuns,
  yearLabelXInRange,
} from "@/lib/unified-mileage-chart";
import type { UnifiedMileageRow } from "@/lib/unified-mileage";

describe("yearLabelXInRange", () => {
  it("places truncated first year mid-range instead of left edge", () => {
    const tMin = Date.UTC(2016, 10, 1); // Nov 2016
    const tMax = Date.UTC(2019, 5, 1);
    const padL = 12;
    const plotW = 496;
    const xOf = (time: number) => padL + ((time - tMin) / (tMax - tMin)) * plotW;
    const x2016 = yearLabelXInRange(2016, tMin, tMax, xOf, padL, plotW)!;
    const x2017 = yearLabelXInRange(2017, tMin, tMax, xOf, padL, plotW)!;
    expect(x2016).toBeGreaterThan(padL);
    expect(x2017 - x2016).toBeGreaterThan(30);
  });
});

describe("pickNonOverlappingYearTicks", () => {
  it("drops middle labels that collide", () => {
    const kept = pickNonOverlappingYearTicks(
      [
        { year: 2016, x: 12 },
        { year: 2017, x: 20 },
        { year: 2018, x: 200 },
        { year: 2019, x: 400 },
      ],
      34,
    );
    expect(kept.map((k) => k.year)).toEqual([2016, 2018, 2019]);
  });
});

describe("buildUnifiedMileageChartWrapHtml", () => {
  it("does not stack consecutive year labels when data starts late in first year", () => {
    const rows: UnifiedMileageRow[] = [
      {
        date: "01.11.2016",
        odometer: "50000",
        country: "LV",
        sortableTime: Date.UTC(2016, 10, 1),
        sourceOrder: 0,
        sourceLabel: "CSDD",
      },
      {
        date: "01.06.2017",
        odometer: "70000",
        country: "LV",
        sortableTime: Date.UTC(2017, 5, 1),
        sourceOrder: 1,
        sourceLabel: "CSDD",
      },
      {
        date: "01.06.2018",
        odometer: "90000",
        country: "LV",
        sortableTime: Date.UTC(2018, 5, 1),
        sourceOrder: 2,
        sourceLabel: "CSDD",
      },
      {
        date: "01.06.2019",
        odometer: "110000",
        country: "LV",
        sortableTime: Date.UTC(2019, 5, 1),
        sourceOrder: 3,
        sourceLabel: "CSDD",
      },
    ];
    const html = buildUnifiedMileageChartWrapHtml(rows, new Map());
    const xs = [...html.matchAll(/class="pdf-mileage-chart-year" x="([\d.]+)"/g)].map((m) =>
      Number.parseFloat(m[1]!),
    );
    expect(xs.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < xs.length; i++) {
      expect(xs[i]! - xs[i - 1]!).toBeGreaterThanOrEqual(30);
    }
  });

  it("marks a rollback with a red segment and year band, without halo dots", () => {
    const rows: UnifiedMileageRow[] = [
      {
        date: "01.01.2020",
        odometer: "100000",
        country: "NL",
        sortableTime: Date.UTC(2020, 0, 1),
        sourceOrder: 0,
        sourceLabel: "AutoDNA",
      },
      {
        date: "01.01.2021",
        odometer: "150000",
        country: "NL",
        sortableTime: Date.UTC(2021, 0, 1),
        sourceOrder: 1,
        sourceLabel: "AutoDNA",
      },
      {
        date: "01.01.2022",
        odometer: "80000",
        country: "LV",
        sortableTime: Date.UTC(2022, 0, 1),
        sourceOrder: 2,
        sourceLabel: "CSDD",
      },
    ];
    const anomalyMap = new Map<number, boolean>([
      [0, false],
      [1, false],
      [2, true],
    ]);
    const html = buildUnifiedMileageChartWrapHtml(rows, anomalyMap);
    expect(html).toContain("pdf-mileage-chart-wrap--has-anomaly");
    expect(html).toContain("pdf-mileage-chart-rollback");
    expect(html).toContain("pdf-mileage-chart-fill");
    expect(html).not.toContain("pdf-mileage-chart-grid");
    expect(html).not.toContain("pdf-mileage-chart-year-band");
    expect(html).toContain("pdf-mileage-chart-legend-rollback");
    expect(html).toContain("Odometra anomālija");
    expect(html).not.toContain("pdf-mileage-chart-anomaly-halo");
    expect(html).not.toContain("pdf-mileage-chart-dot--anomaly");
    expect(html).not.toContain("pdf-mileage-chart-anomaly-pin");
  });

  it("keeps the rollback as a discrete drop: blue path stops, red segment falls", () => {
    const rows: UnifiedMileageRow[] = [
      {
        date: "01.01.2020",
        odometer: "100000",
        country: "NL",
        sortableTime: Date.UTC(2020, 0, 1),
        sourceOrder: 0,
        sourceLabel: "AutoDNA",
      },
      {
        date: "01.01.2021",
        odometer: "150000",
        country: "NL",
        sortableTime: Date.UTC(2021, 0, 1),
        sourceOrder: 1,
        sourceLabel: "AutoDNA",
      },
      {
        date: "01.01.2022",
        odometer: "80000",
        country: "LV",
        sortableTime: Date.UTC(2022, 0, 1),
        sourceOrder: 2,
        sourceLabel: "CSDD",
      },
      {
        date: "01.01.2023",
        odometer: "95000",
        country: "LV",
        sortableTime: Date.UTC(2023, 0, 1),
        sourceOrder: 3,
        sourceLabel: "CSDD",
      },
    ];
    const anomalyMap = new Map<number, boolean>([
      [0, false],
      [1, false],
      [2, true],
      [3, false],
    ]);
    const html = buildUnifiedMileageChartWrapHtml(rows, anomalyMap);
    const paths = [...html.matchAll(/class="pdf-mileage-chart-path"[^>]*d="([^"]+)"/g)].map((m) => m[1]!);
    expect(paths).toHaveLength(2);
    const rollback = html.match(
      /class="pdf-mileage-chart-rollback" x1="([\d.]+)" y1="([\d.]+)" x2="([\d.]+)" y2="([\d.]+)"/,
    );
    expect(rollback).toBeTruthy();
    const y1 = Number.parseFloat(rollback![2]!);
    const y2 = Number.parseFloat(rollback![4]!);
    // SVG Y grows downward: 80k is below 150k.
    expect(y2).toBeGreaterThan(y1);
  });

  it("omits extra-digit spike from chart path so Y scale stays sane", () => {
    const rows: UnifiedMileageRow[] = [
      {
        date: "01.03.2010",
        odometer: "25581",
        country: "DE",
        sortableTime: Date.UTC(2010, 2, 1),
        sourceOrder: 0,
        sourceLabel: "DNA",
      },
      {
        date: "29.03.2010",
        odometer: "255811",
        country: "DE",
        sortableTime: Date.UTC(2010, 2, 29),
        sourceOrder: 1,
        sourceLabel: "DEALER",
      },
      {
        date: "01.01.2011",
        odometer: "49481",
        country: "DE",
        sortableTime: Date.UTC(2011, 0, 1),
        sourceOrder: 2,
        sourceLabel: "CV",
      },
    ];
    const anomalyMap = new Map<number, boolean>([
      [0, false],
      [1, true],
      [2, false],
    ]);
    const html = buildUnifiedMileageChartWrapHtml(rows, anomalyMap, {
      compact: true,
      chartExcludeSourceOrders: new Set([1]),
    });
    // Spike excluded → no anomaly marker on chart (table still warns).
    expect(html).not.toContain("pdf-mileage-chart-dot--anomaly");
    expect(html).not.toContain("pdf-mileage-chart-wrap--has-anomaly");
    const pathMatch = html.match(/class="pdf-mileage-chart-path"[^>]*d="([^"]+)"/);
    expect(pathMatch?.[1]).toBeTruthy();
    // Only two vertices (25k → 49k); spike would add a third L segment.
    expect(pathMatch![1]!.match(/ L /g)?.length ?? 0).toBe(1);
  });

  it("uses a cubic path when there are several non-anomaly readings", () => {
    const rows: UnifiedMileageRow[] = [2016, 2017, 2018, 2019].map((year, i) => ({
      date: `01.06.${year}`,
      odometer: String(50000 + i * 20000),
      country: "LV",
      sortableTime: Date.UTC(year, 5, 1),
      sourceOrder: i,
      sourceLabel: "CSDD",
    }));
    const html = buildUnifiedMileageChartWrapHtml(rows, new Map());
    expect(html).toContain(" C ");
    expect(html).toContain("pdf-mileage-chart-fill");
    expect(html).not.toContain("pdf-mileage-chart-grid");
    expect(html).not.toContain("pdf-mileage-chart-year-band");
  });
});

describe("monotoneCubicSvgPath", () => {
  it("does not overshoot the y-range of each segment", () => {
    const d = monotoneCubicSvgPath([
      { x: 0, y: 40 },
      { x: 10, y: 20 },
      { x: 20, y: 10 },
      { x: 30, y: 30 },
    ]);
    expect(d.startsWith("M ")).toBe(true);
    expect(d).toContain(" C ");
    const nums = [...d.matchAll(/-?[\d.]+/g)].map((m) => Number.parseFloat(m[0]!));
    const ys = nums.filter((_, i) => i % 2 === 1);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(10 - 0.05);
    expect(Math.max(...ys)).toBeLessThanOrEqual(40 + 0.05);
  });
});

describe("buildSourceMileageSparkHtml", () => {
  const dnaEarly: UnifiedMileageRow = {
    date: "01.03.2016",
    odometer: "50000",
    country: "DE",
    sortableTime: Date.UTC(2016, 2, 1),
    sourceOrder: 0,
    sourceLabel: "AutoDNA",
  };
  const dnaMid: UnifiedMileageRow = {
    date: "01.06.2018",
    odometer: "80000",
    country: "DE",
    sortableTime: Date.UTC(2018, 5, 1),
    sourceOrder: 1,
    sourceLabel: "AutoDNA",
  };
  const csddLate: UnifiedMileageRow = {
    date: "01.06.2020",
    odometer: "120000",
    country: "LV",
    sortableTime: Date.UTC(2020, 5, 1),
    sourceOrder: 2,
    sourceLabel: "CSDD",
  };

  it("returns empty when the source has no chartable km", () => {
    expect(buildSourceMileageSparkHtml([csddLate], "autodna")).toBe("");
    expect(buildSourceMileageSparkHtml([], "csdd")).toBe("");
  });

  it("draws a ghost unified curve and a source path in AutoDNA blue", () => {
    const html = buildSourceMileageSparkHtml([dnaEarly, dnaMid, csddLate], "autodna");
    expect(html).toContain("pdf-src-mileage-spark");
    expect(html).toContain('data-src-spark="autodna"');
    expect(html).toContain("pdf-src-mileage-spark-ghost");
    expect(html).toContain("pdf-src-mileage-spark-fill");
    expect(html).toContain('class="pdf-src-mileage-spark-path"');
    expect(html).toContain('stroke="#1E3A8A"');
    expect(html).not.toContain("pdf-src-mileage-spark-grid");
    expect(html).not.toContain("pdf-mileage-chart-rollback");
    expect(html).not.toContain("Nobraukums");
  });

  it("labels this source start and end dates, not year ticks", () => {
    const html = buildSourceMileageSparkHtml([dnaEarly, dnaMid, csddLate], "autodna");
    expect(html).toContain("01.03.2016");
    expect(html).toContain("01.06.2018");
    expect(html).not.toContain("pdf-mileage-chart-year");
    expect(html).not.toContain(">2020<");
  });

  it("shares the unified time scale so an early DNA point sits left of a late CSDD point", () => {
    const rows = [dnaEarly, csddLate];
    const dna = buildSourceMileageSparkHtml(rows, "autodna");
    const csdd = buildSourceMileageSparkHtml(rows, "csdd");
    const dnaX = Number.parseFloat(dna.match(/class="pdf-src-mileage-spark-dot" cx="([\d.]+)"/)![1]!);
    const csddX = Number.parseFloat(csdd.match(/class="pdf-src-mileage-spark-dot" cx="([\d.]+)"/)![1]!);
    expect(dnaX).toBeLessThan(csddX);
  });
});

describe("splitMileageChartRuns", () => {
  it("starts a new run at each anomaly so the drop is not smoothed", () => {
    const runs = splitMileageChartRuns([
      { x: 0, y: 10, isAnomaly: false },
      { x: 1, y: 5, isAnomaly: false },
      { x: 2, y: 20, isAnomaly: true },
      { x: 3, y: 18, isAnomaly: false },
    ]);
    expect(runs).toEqual([
      [
        { x: 0, y: 10 },
        { x: 1, y: 5 },
      ],
      [
        { x: 2, y: 20 },
        { x: 3, y: 18 },
      ],
    ]);
  });
});
