import { describe, expect, it } from "vitest";
import {
  buildDealerCoverMileageChartHtml,
  collectDealerCoverMileagePoints,
  computeDealerCoverYearlyMileage,
  filterDealerCoverPrecisePoints,
  interpolateDealerCoverBoundary,
  parseDealerCoverOdometerKm,
  type DealerCoverMileagePoint,
  type DealerCoverYearlyFlag,
} from "@/lib/pdf-dealer-cover-mileage";
import { buildDealerSectionCoverHtml } from "@/lib/pdf-dealer-section-cover";
import { emptyOutvinVehicleInfo } from "@/lib/outvin-dealer-types";

/** BMW 525d kanona punkti (91 precīzs ieraksts; 4 mākslīgie kritumi jau izņemti). */
const BMW525_TSV = `
01.06.2008	15
12.01.2009	19565
14.08.2009	19565
01.10.2009	23405
31.10.2009	23605
01.03.2010	26741
10.03.2010	26941
01.04.2010	29965
30.04.2010	30165
01.10.2010	39025
04.10.2010	39225
01.03.2011	46487
25.03.2011	46687
01.05.2011	48829
13.05.2011	49024
13.05.2011	49029
20.05.2011	49224
23.05.2011	49650
01.07.2011	51064
31.10.2011	51064
11.11.2011	57047
01.01.2012	59715
02.01.2012	59915
27.01.2012	60755
01.05.2012	67726
23.05.2012	67926
12.07.2012	72315
01.11.2012	81973
12.11.2012	82173
01.01.2013	85387
10.01.2013	85587
26.02.2013	86817
16.05.2013	86817
02.07.2013	93133
02.07.2013	95204
01.10.2013	102696
14.10.2013	103196
01.04.2014	111354
07.04.2014	111854
23.04.2014	112907
01.06.2014	115374
30.06.2014	115874
04.09.2014	118003
01.10.2014	119975
23.10.2014	120452
23.10.2014	120475
01.07.2015	135501
03.07.2015	135992
03.07.2015	136001
01.10.2015	140577
14.10.2015	141077
14.10.2015	141103
01.06.2016	152170
13.06.2016	152670
01.07.2016	154291
29.07.2016	154791
30.08.2016	157927
01.11.2016	160718
21.11.2016	161206
21.11.2016	161218
03.07.2017	167921
23.05.2018	180614
01.06.2018	180883
22.06.2018	181383
01.08.2018	183920
20.08.2018	184420
01.07.2019	196665
29.07.2019	197247
01.09.2019	198333
05.09.2019	198833
20.05.2020	208192
01.06.2021	220695
28.06.2021	221195
06.07.2021	221482
01.08.2021	222828
05.08.2021	223328
01.06.2022	234784
13.06.2022	235284
27.01.2023	249272
26.07.2023	259085
01.07.2025	289683
01.09.2025	294640
01.10.2025	295671
30.10.2025	296171
01.04.2026	300621
01.04.2026	301123
16.04.2026	301672
01.05.2026	303116
12.05.2026	303616
12.05.2026	303938
29.07.2026	305048
`.trim();

const BMW525_YEARLY: { year: number; km: number; flag: DealerCoverYearlyFlag }[] = [
  { year: 2008, km: 18594, flag: "partial" },
  { year: 2009, km: 6603, flag: "precise" },
  { year: 2010, km: 18380, flag: "precise" },
  { year: 2011, km: 16123, flag: "precise" },
  { year: 2012, km: 25672, flag: "precise" },
  { year: 2013, km: 21623, flag: "precise" },
  { year: 2014, km: 17656, flag: "precise" },
  { year: 2015, km: 20222, flag: "precise" },
  { year: 2016, km: 17557, flag: "precise" },
  { year: 2017, km: 12606, flag: "precise" },
  { year: 2018, km: 14578, flag: "precise" },
  { year: 2019, km: 13484, flag: "precise" },
  { year: 2020, km: 12574, flag: "precise" },
  { year: 2021, km: 13331, flag: "precise" },
  { year: 2022, km: 18659, flag: "precise" },
  { year: 2023, km: 18299, flag: "estimate" },
  { year: 2024, km: 15862, flag: "estimate" },
  { year: 2025, km: 16165, flag: "estimate" },
  { year: 2026, km: 7045, flag: "partial" },
];

function parseTsv(tsv: string): DealerCoverMileagePoint[] {
  return tsv.split("\n").map((line) => {
    const [date, kmRaw] = line.split("\t");
    const [dd, mm, yyyy] = date!.split(".").map(Number);
    const ms = Date.UTC(yyyy!, mm! - 1, dd);
    return {
      day: Math.floor(ms / 86_400_000),
      ms,
      km: Number(kmRaw),
      dateDisplay: date!,
    };
  });
}

function bmwPoints(): DealerCoverMileagePoint[] {
  return parseTsv(BMW525_TSV);
}

describe("parseDealerCoverOdometerKm", () => {
  it("keeps first-registration readings under 100 km", () => {
    expect(parseDealerCoverOdometerKm("15")).toBe(15);
    expect(parseDealerCoverOdometerKm("15 km")).toBe(15);
  });
});

describe("computeDealerCoverYearlyMileage", () => {
  it("classifies BMW 525d years as precise / estimate / partial without annualizing incomplete years", () => {
    const points = bmwPoints();
    expect(points).toHaveLength(91);
    const rows = computeDealerCoverYearlyMileage(points);
    expect(rows.map((r) => ({ year: r.year, km: r.km, flag: r.flag }))).toEqual(BMW525_YEARLY);
    const sum = rows.reduce((n, r) => n + r.kmUnrounded, 0);
    expect(Math.abs(sum - (305048 - 15))).toBeLessThan(1e-6);
    expect(rows.find((r) => r.year === 2008)?.readings).toBe(1);
    expect(rows.find((r) => r.year === 2024)?.readings).toBe(0);
    expect(rows.find((r) => r.year === 2023)?.boundaryEndUncertain).toBe(true);
    expect(rows.find((r) => r.year === 2025)?.boundaryStartUncertain).toBe(true);
  });

  it("returns no yearly bars for a single record", () => {
    const one = bmwPoints().slice(0, 1);
    expect(computeDealerCoverYearlyMileage(one)).toEqual([]);
  });

  it("marks a year without interior records as estimate when it is only a multi-year gap split", () => {
    const points = parseTsv(`15.03.2020	100000
15.03.2023	160000`);
    const rows = computeDealerCoverYearlyMileage(points);
    expect(rows.find((r) => r.year === 2020)?.flag).toBe("partial");
    expect(rows.find((r) => r.year === 2021)?.flag).toBe("estimate");
    expect(rows.find((r) => r.year === 2022)?.flag).toBe("estimate");
    expect(rows.find((r) => r.year === 2023)?.flag).toBe("partial");
    expect(rows.find((r) => r.year === 2021)?.readings).toBe(0);
    expect(rows.find((r) => r.year === 2021)?.boundaryStartUncertain).toBe(true);
  });

  it("keeps a full calendar year precise when it has an interior record and consecutive-year bounds", () => {
    const points = parseTsv(`01.06.2018	40000
01.06.2019	60000
01.06.2020	80000`);
    const rows = computeDealerCoverYearlyMileage(points);
    expect(rows.find((r) => r.year === 2019)?.flag).toBe("precise");
    expect(rows.find((r) => r.year === 2018)?.flag).toBe("partial");
    expect(rows.find((r) => r.year === 2020)?.flag).toBe("partial");
  });
});

describe("interpolateDealerCoverBoundary", () => {
  it("uses the last reading on an exact boundary date", () => {
    const points = parseTsv(`01.01.2012	59715
01.01.2012	59915
02.01.2012	60755`);
    const day = Math.floor(Date.UTC(2012, 0, 1) / 86_400_000);
    expect(interpolateDealerCoverBoundary(points, day)).toEqual({ km: 59915, uncertain: false });
  });
});

describe("filterDealerCoverPrecisePoints", () => {
  it("drops an isolated artificial odometer drop and does not treat it as tampering", () => {
    const points = parseTsv(`01.01.2018	100000
01.06.2018	40000
01.07.2018	101000
01.01.2019	110000`);
    const { precise, excludedCount } = filterDealerCoverPrecisePoints(points);
    expect(excludedCount).toBe(1);
    expect(precise.map((p) => p.km)).toEqual([100000, 101000, 110000]);
    const html = buildDealerCoverMileageChartHtml({ precise, excludedCount });
    expect(html).toContain("mākslīgu kritumu");
    expect(html).not.toContain("viltoj");
  });
});

describe("collectDealerCoverMileagePoints", () => {
  it("prefers the dealer mileage table over visit odometers", () => {
    const pts = collectDealerCoverMileagePoints(
      [
        {
          date: "01.06.2018",
          odometer: "40000",
          location: "BMW",
          works: "Apkope",
        },
        {
          date: "01.06.2020",
          odometer: "90000",
          location: "BMW",
          works: "Apkope",
        },
      ],
      [
        { date: "01.06.2018", odometer: "40000", country: "Vācija" },
        { date: "01.06.2019", odometer: "60000", country: "Vācija" },
        { date: "01.06.2020", odometer: "80000", country: "Vācija" },
      ],
    );
    expect(pts.map((p) => p.km)).toEqual([40000, 60000, 80000]);
  });
});

describe("buildDealerCoverMileageChartHtml", () => {
  it("draws a continuous jewelled line and yearly bars, without a vidēji KPI", () => {
    const points = bmwPoints();
    const html = buildDealerCoverMileageChartHtml({ precise: points, excludedCount: 4 });
    expect(html).toContain("pdf-dealer-cover-curve");
    expect(html).toContain("91 precīzi ieraksti");
    expect(html).toContain('stroke-width="2.05"');
    expect(html).toContain('stroke-linecap="round"');
    expect(html).not.toMatch(/pdf-dealer-cover-curve-path[^>]*stroke-dasharray/);
    expect(html).toContain('data-status="precise"');
    expect(html).toContain('data-status="estimate"');
    expect(html).toContain('data-status="partial"');
    expect(html).toContain("nepilns");
    expect(html).toContain("NOBRAUKUMS PA GADIEM");
    expect(html).toContain("precīzs ieraksts");
    expect(html).toContain("nepārtraukta līnija savieno precīzos ierakstus");
    expect(html).toContain("aptuveni (nav precīzu datu)");
    expect(html).toContain("15 km");
    expect(html).toContain("305 048 km");
    expect(html).toContain("91 ieraksti");
    expect(html).not.toMatch(/vidēji/i);
    expect(html).not.toContain("\u2014");
    expect(html).not.toContain("\u2013");
    expect(html).toContain("r=\"5.6\"");
    expect(html).toContain("r=\"3.7\"");
    expect(html).toContain("fill-opacity=\"0.15\"");
  });

  it("shows a single jewel and no yearly bars for one record", () => {
    const html = buildDealerCoverMileageChartHtml({
      precise: bmwPoints().slice(0, 1),
      excludedCount: 0,
    });
    expect(html).toContain("1 precīzs ieraksts");
    expect(html).toContain("pdf-dealer-cover-curve");
    expect(html).not.toContain("pdf-dealer-cover-curve-path");
    expect(html).not.toContain("NOBRAUKUMS PA GADIEM");
    expect(html).not.toContain("data-status=");
    expect(html).not.toMatch(/vidēji/i);
  });

  it("draws line and bars once there are two precise records", () => {
    const html = buildDealerCoverMileageChartHtml({
      precise: parseTsv(`01.06.2018	40000
01.08.2021	95000`),
      excludedCount: 0,
    });
    expect(html).toContain("pdf-dealer-cover-curve-path");
    expect(html).toContain("NOBRAUKUMS PA GADIEM");
    expect(html).toContain("2 precīzi ieraksti");
    expect(html).toContain("2 ieraksti");
    expect(html).not.toMatch(/vidēji/i);
  });
});

describe("buildDealerSectionCoverHtml mileage chart", () => {
  it("uses the cover chart instead of a KPI average", () => {
    const vehicle = emptyOutvinVehicleInfo();
    vehicle.model = "BMW X1 (E84) xDrive 20 d";
    vehicle.vinCode = "WBAVL12090VX12345";
    const html = buildDealerSectionCoverHtml({
      vehicle,
      serviceWorks: [
        {
          date: "12.03.2024",
          odometer: "142220",
          location: "d.velop AG, Osnabrück",
          works: "Eļļas maiņa",
        },
        {
          date: "03.04.2016",
          odometer: "31400",
          location: "BMW Mobiler Service, Minhene",
          works: "",
        },
      ],
    });
    expect(html).toContain("2 precīzi ieraksti");
    expect(html).toContain("2 ieraksti");
    expect(html).not.toContain("vizītes");
    expect(html).not.toMatch(/vidēji/i);
    expect(html).toContain("pdf-dealer-cover-curve-path");
  });
});
