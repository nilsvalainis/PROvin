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
