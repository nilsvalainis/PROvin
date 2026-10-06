import { describe, expect, it } from "vitest";
import {
  buildOilChangeIntervalPdfHtml,
  buildOilChangeIntervalSeries,
  classifyOilIntervalKind,
  isEngineOilChangeWork,
} from "@/lib/oil-change-intervals";
import type { AutoRecordsServiceWorkRow } from "@/lib/auto-records-service-works";

function row(
  date: string,
  odometer: string,
  works: string,
): AutoRecordsServiceWorkRow {
  return { date, odometer, location: "BMW Bonn", works };
}

describe("isEngineOilChangeWork", () => {
  it("counts engine oil and skips gearbox or axle oil", () => {
    expect(isEngineOilChangeWork("Regulārā apkope: eļļas maiņa, filtri")).toBe(true);
    expect(isEngineOilChangeWork("Engine oil change")).toBe(true);
    expect(isEngineOilChangeWork("Kārbas eļļas maiņa")).toBe(false);
    expect(isEngineOilChangeWork("Haldex eļļas maiņa")).toBe(false);
    expect(isEngineOilChangeWork("Eļļas maiņa un kārbas eļļas maiņa")).toBe(true);
  });
});

describe("classifyOilIntervalKind", () => {
  it("treats a jump past 30 000 km or 24 months as a data gap", () => {
    expect(classifyOilIntervalKind(39_100, 34, [15_000, 16_000])).toBe("gap");
    expect(classifyOilIntervalKind(8_000, 30, [15_000])).toBe("gap");
  });

  it("keeps two similar long-life dealer steps in the observed pool", () => {
    expect(classifyOilIntervalKind(29_800, 23, [29_800, 28_200])).toBe("observed");
    expect(classifyOilIntervalKind(28_200, 22, [29_800, 28_200])).toBe("observed");
  });

  it("drops a relative outlier against a tight dealer median", () => {
    expect(classifyOilIntervalKind(29_500, 18, [15_000, 16_000, 29_500])).toBe("gap");
  });
});

describe("buildOilChangeIntervalSeries", () => {
  const rows = [
    row("03.04.2016", "31400", "Eļļas maiņa"),
    row("12.03.2018", "61200", "Regulārā apkope: eļļas maiņa"),
    row("22.01.2020", "89400", "Motoreļļas maiņa"),
    row("04.06.2020", "91000", "Kārbas eļļas maiņa"),
    row("18.11.2022", "128500", "Engine oil change"),
    row("12.03.2024", "142220", "Eļļas maiņa"),
  ];

  it("builds chronological engine-oil gaps and ignores gearbox-only visits", () => {
    const series = buildOilChangeIntervalSeries(rows);
    expect(series.changeCount).toBe(5);
    expect(series.points[0]).toMatchObject({
      date: "03.04.2016",
      kind: "start",
      tone: "start",
      intervalKm: null,
    });
    expect(series.points[1]).toMatchObject({
      intervalKm: 29800,
      kind: "observed",
      tone: "neutral",
    });
    expect(series.points[3]).toMatchObject({
      intervalKm: 39100,
      kind: "gap",
      tone: "gap",
    });
    expect(series.points[4]).toMatchObject({
      intervalKm: 13720,
      kind: "observed",
      tone: "neutral",
    });
    expect(series.ringStepCount).toBe(3);
    expect(series.gapStepCount).toBe(1);
    expect(series.ringIntervalKm).toBe(Math.round((29800 + 28200 + 13720) / 3));
    expect(series.ringNote).toContain("datu iztrūkums");
    expect(series.ringNote).not.toContain("\u2014");
  });

  it("colours observed steps against this engine OEM, and keeps gaps grey", () => {
    const bmw = { km: 30_000, kmMin: null, months: 24 };
    const toyota = { km: 15_000, kmMin: null, months: 12 };
    const longLife = buildOilChangeIntervalSeries(
      [
        row("03.04.2016", "31400", "Eļļas maiņa"),
        row("12.03.2018", "61200", "Eļļas maiņa"),
        row("18.11.2022", "128500", "Eļļas maiņa"),
      ],
      bmw,
    );
    expect(longLife.points[1]).toMatchObject({ kind: "observed", tone: "ok", periodTone: "ok" });
    expect(longLife.points[2]).toMatchObject({ kind: "gap", tone: "gap", periodTone: "gap" });
    expect(longLife.ringTone).toBe("ok");

    const shortBook = buildOilChangeIntervalSeries(
      [
        row("01.01.2018", "40000", "Eļļas maiņa"),
        row("01.01.2019", "62000", "Eļļas maiņa"),
      ],
      toyota,
    );
    expect(shortBook.points[1]).toMatchObject({ kind: "observed", tone: "stretch" });
    expect(shortBook.ringTone).toBe("stretch");
  });

  it("does not let a 30 month stall with few km inflate the ring", () => {
    const series = buildOilChangeIntervalSeries([
      row("01.01.2018", "50000", "Eļļas maiņa"),
      row("01.07.2020", "58000", "Eļļas maiņa"),
      row("01.07.2021", "73000", "Eļļas maiņa"),
    ]);
    expect(series.points[1]?.kind).toBe("gap");
    expect(series.points[2]?.kind).toBe("observed");
    expect(series.ringIntervalKm).toBe(15000);
    expect(series.ringIntervalMonths).toBe(12);
  });

  it("omits the ring when every step is a data gap", () => {
    const series = buildOilChangeIntervalSeries([
      row("01.01.2016", "10000", "Eļļas maiņa"),
      row("01.01.2020", "80000", "Eļļas maiņa"),
    ]);
    expect(series.ringIntervalKm).toBeNull();
    expect(series.ringStepCount).toBe(0);
    expect(series.ringNote).toContain("Vidējo intervālu nevar rēķināt");
  });
});

describe("buildOilChangeIntervalPdfHtml", () => {
  it("renders coverage, a separate period column, and a claim caution", () => {
    const html = buildOilChangeIntervalPdfHtml(
      buildOilChangeIntervalSeries([
        row("03.04.2016", "31400", "Eļļas maiņa"),
        row("12.03.2018", "61200", "Eļļas maiņa"),
        row("18.11.2022", "128500", "Eļļas maiņa"),
      ]),
    );
    expect(html).toContain("Eļļas maiņas intervāli");
    expect(html).toContain("fiksētas maiņas");
    expect(html).toContain("vidējais intervāls");
    expect(html).toContain("vidējais laiks");
    expect(html).toContain("pdf-oil-int__kpis");
    expect(html).toContain("pdf-oil-int__cov");
    expect(html).toContain("pdf-oil-int__caution");
    expect(html).toContain("Svarīga piezīme par apkopes datu interpretāciju");
    expect(html).toContain("PROVIN datubāzēs");
    expect(html).toContain("Neatkarīgie autoservisi neiesūta");
    expect(html).toContain("nepierāda, ka apkope nav veikta");
    expect(html).not.toContain("CarVertical");
    expect(html).not.toContain("AutoDNA");
    expect(html).not.toContain("apdrošinātājiem");
    expect(html).toContain("oficiālu datu neesamību");
    expect(html).toContain("Fiziskās servisa grāmatiņas");
    expect(html).toContain("Pirmsipirkuma diagnostiku");
    expect(html).toContain("<th>Intervāls</th><th>Periods</th>");
    expect(html).toContain("31 400 km");
    expect(html).toContain("29 800 km");
    expect(html).toContain("23 mēn.");
    expect(html).toContain("Datu iztrūkums");
    expect(html).toContain("Sākums");
    expect(html).not.toContain("pdf-oil-int__ring");
    expect(html).not.toContain("29 800 km, 23");
    expect(html).not.toContain("\u2014");
    expect(html).not.toContain("\u2013");
  });

  it("prints the OEM caption used for colours and does not call a longer dealer step a proven miss", () => {
    const html = buildOilChangeIntervalPdfHtml(
      buildOilChangeIntervalSeries(
        [
          row("03.04.2016", "31400", "Eļļas maiņa"),
          row("12.03.2018", "61200", "Eļļas maiņa"),
        ],
        { km: 30_000, kmMin: null, months: 24 },
      ),
    );
    expect(html).toContain("Ražotāja intervāls: 30 000 km / 24 mēn.");
    expect(html).toContain("pdf-oil-int__seg--ok");
    expect(html).toContain("dīlera datos atbilst intervālam");
    expect(html).toContain("dīlera datos virs intervāla");
    expect(html).not.toMatch(/intervāls tiešām ir pārsniegts/i);
    expect(html).toContain("vidējais laiks");
    expect(html).toContain("fiksētas maiņas");
  });

  it("is empty when no oil changes exist", () => {
    expect(
      buildOilChangeIntervalPdfHtml(
        buildOilChangeIntervalSeries([row("01.01.2020", "10000", "Bremžu kluči")]),
      ),
    ).toBe("");
  });
});
