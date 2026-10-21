import { describe, expect, it } from "vitest";
import { emptyAutoRecordsBlock } from "@/lib/admin-source-blocks";
import { emptyAutoRecordsServiceWorkRow } from "@/lib/auto-records-service-works";
import {
  buildOilIntervalSeriesForBlock,
  oilRowsFromServiceWorks,
  resolveOilIntervalChartRows,
} from "@/lib/oil-change-interval-chart";
import { buildOilChangeIntervalPdfHtml } from "@/lib/oil-change-intervals";

describe("oil-change-interval-chart", () => {
  it("imports oil rows from service works when chart is not saved", () => {
    const block = emptyAutoRecordsBlock();
    block.serviceWorks = [
      {
        date: "12.03.2018",
        odometer: "61200",
        location: "Rīga",
        works: "Eļļas un eļļas filtra maiņa",
      },
      emptyAutoRecordsServiceWorkRow(),
    ];
    const rows = resolveOilIntervalChartRows(block);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.odometer).toBe("61200");
  });

  it("uses saved chart rows when useSavedRows is set", () => {
    const block = emptyAutoRecordsBlock();
    block.oilIntervalChart = {
      useSavedRows: true,
      highlightOverOem: true,
      oemKm: 30_000,
      oemMonths: 24,
      rows: [
        {
          id: "a",
          date: "01.01.2020",
          odometer: "10000",
          works: "Eļļas maiņa",
        },
      ],
    };
    expect(resolveOilIntervalChartRows(block)).toHaveLength(1);
    expect(oilRowsFromServiceWorks(block).length).toBe(0);
  });

  it("WAUZZZF47MA055473 admin+PDF: over-OEM steps are virs intervāla, not datu iztrūkums", () => {
    const block = emptyAutoRecordsBlock();
    block.oilIntervalChart = {
      useSavedRows: true,
      highlightOverOem: true,
      oemKm: 30_000,
      oemMonths: 24,
      rows: [
        { id: "a", date: "13.12.2021", odometer: "28449", works: "Eļļas maiņa" },
        { id: "b", date: "29.09.2022", odometer: "63235", works: "Eļļas maiņa" },
        { id: "c", date: "22.01.2024", odometer: "96968", works: "Eļļas maiņa" },
      ],
    };
    const series = buildOilIntervalSeriesForBlock(block);
    expect(series.points[1]).toMatchObject({
      intervalKm: 34_786,
      intervalMonths: 10,
      kind: "observed",
      tone: "stretch",
    });
    expect(series.points[2]).toMatchObject({
      intervalKm: 33_733,
      intervalMonths: 16,
      kind: "observed",
      tone: "stretch",
    });
    expect(series.gapStepCount).toBe(0);
    expect(series.ringIntervalKm).toBe(34_260);
    expect(series.ringIntervalMonths).toBe(13);
    expect(series.coverGapKm).toBe(0);

    const html = buildOilChangeIntervalPdfHtml(series);
    expect(html).not.toContain("Datu iztrūkums");
    expect(html).toContain("34 260 km");
    expect(html).toContain("13 mēn.");
    expect(html).toContain("dīlera datos virs intervāla");
    expect(html).toContain("Dīlera dati apliecina 100%");
    expect(html).toContain("pdf-oil-int__seg--over");
    expect(html).not.toContain("pdf-oil-int__seg--hatch");
  });

  it("PDF html has no auto footnote paragraph after caution", () => {
    const block = emptyAutoRecordsBlock();
    block.serviceWorks = [
      {
        date: "03.04.2016",
        odometer: "31400",
        location: "",
        works: "Eļļas maiņa",
      },
      {
        date: "12.03.2018",
        odometer: "61200",
        location: "",
        works: "Eļļas maiņa",
      },
    ];
    block.oilIntervalChart = {
      useSavedRows: false,
      highlightOverOem: true,
      oemKm: 30_000,
      oemMonths: 24,
      rows: [],
    };
    const html = buildOilChangeIntervalPdfHtml(buildOilIntervalSeriesForBlock(block));
    expect(html).not.toContain("pdf-oil-int__note");
    expect(html).not.toMatch(/Vidējie rādītāji rēķināti/i);
  });
});
