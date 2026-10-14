import { describe, expect, it } from "vitest";

import {
  buildCountryTimelineSegments,
  countryTimelineSegmentWeights,
  formatKmLv,
  summarizeMileageRange,
} from "@/lib/admin-pro-overview-bars";
import { buildCountryTimeline } from "@/lib/vehicle-country-timeline";

describe("buildCountryTimelineSegments", () => {
  it("groups consecutive points by country with year labels", () => {
    const tl = buildCountryTimeline([
      { date: "11.04.2022", country: "Vācija" },
      { date: "02.06.2023", country: "Vācija" },
      { date: "10.10.2025", country: "Vācija" },
      { date: "13.01.2026", country: "Latvija" },
    ]);
    const segs = buildCountryTimelineSegments(tl);
    expect(segs.map((s) => [s.country, s.yearLabel])).toEqual([
      ["Vācija", "2022-25"],
      ["Latvija", "2026"],
    ]);
    const w = countryTimelineSegmentWeights(segs);
    expect(w).toHaveLength(2);
    expect(w[0]!).toBeGreaterThan(w[1]!);
  });

  it("returns nothing without data", () => {
    expect(buildCountryTimelineSegments(buildCountryTimeline([]))).toEqual([]);
  });
});

describe("summarizeMileageRange", () => {
  it("uses first and last dated readings", () => {
    expect(
      summarizeMileageRange([
        { date: "02.06.2025", km: "96 400" },
        { date: "11.04.2023", km: "38200" },
        { date: "", km: "1000" },
        { date: "01.01.2024", km: "" },
      ]),
    ).toEqual({ firstYear: 2023, lastYear: 2025, firstKm: 38200, lastKm: 96400, readings: 2 });
  });

  it("is null when nothing is valid", () => {
    expect(summarizeMileageRange([{ date: "", km: "" }])).toBeNull();
  });

  it("formats km with thin grouping", () => {
    expect(formatKmLv(96400)).toBe("96\u00a0400");
  });
});
