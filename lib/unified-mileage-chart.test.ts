import { describe, expect, it } from "vitest";
import {
  buildUnifiedMileageChartWrapHtml,
  pickNonOverlappingYearTicks,
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
});
