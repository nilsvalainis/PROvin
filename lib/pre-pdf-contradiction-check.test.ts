import { describe, expect, it } from "vitest";
import { emptyCsddFields, emptyTirgusFields, SOURCE_BLOCK_LABELS } from "@/lib/admin-source-blocks";
import { classifyOdometerAnomalies } from "@/lib/odometer-anomaly-classify";
import { checkPrePdfContradictions, csddMileageOnSameDate } from "@/lib/pre-pdf-contradiction-check";
import { buildPdfReportSummaryTiles } from "@/lib/pdf-report-summary";
import {
  collectUnifiedMileageRows,
  prepareUnifiedMileageDisplayRows,
} from "@/lib/unified-mileage";
import type { CsddTechnicalInspectionRow } from "@/lib/csdd-extended-parse";

function ta(date: string): CsddTechnicalInspectionRow {
  return {
    date,
    inspectionType: "TA",
    ratingLabel: "1",
    ratingLevel: 1,
    maxDefectLevel: null,
    smokeCoefficient: "",
    notes: "",
    defects: [],
  };
}

function csddMileage(rows: Array<{ date: string; odometer: string }>) {
  const csdd = emptyCsddFields();
  csdd.mileageHistory = rows.map((r) => ({ date: r.date, odometer: r.odometer, country: "Latvija" }));
  return csdd;
}

describe("checkPrePdfContradictions", () => {
  it("does not flag matching header count, last km and clean note", () => {
    const summaryInput = {
      csddForm: csddMileage([
        { date: "01.01.2020", odometer: "100000" },
        { date: "12.05.2024", odometer: "148200" },
      ]),
    };
    const flags = checkPrePdfContradictions({ summaryInput });
    expect(flags.filter((f) => f.id.startsWith("c1") || f.id.startsWith("c2") || f.id.startsWith("c3"))).toEqual([]);
    const tiles = buildPdfReportSummaryTiles(summaryInput);
    const mileage = tiles.find((t) => t.id === "mileage");
    expect(mileage?.note).toMatch(/2 ieraksti bez pretrunām/);
    expect(mileage?.value).toMatch(/148 200/);
  });

  it("flags header count vs chart (C1), rollback vs bez pretrunām (C2) and header km (C3)", () => {
    const summaryInput = {
      csddForm: csddMileage([
        { date: "01.01.2020", odometer: "180000" },
        { date: "01.06.2024", odometer: "120000" },
      ]),
    };
    const flags = checkPrePdfContradictions({
      summaryInput,
      tiles: [
        {
          id: "mileage",
          label: "Nobraukums",
          value: "180 000 km",
          note: "2 ieraksti bez pretrunām",
          tone: "ok",
        },
      ],
    });
    expect(flags.map((f) => f.id)).toEqual(
      expect.arrayContaining(["c2_rollback_clean_header", "c3_header_km", "odo_rollback_1"]),
    );
    expect(flags.every((f) => !/[\u2013\u2014]/.test(f.message))).toBe(true);
  });

  it("flags C1 when injected header count differs from chart points", () => {
    const summaryInput = {
      csddForm: csddMileage([
        { date: "01.01.2020", odometer: "100000" },
        { date: "01.01.2022", odometer: "130000" },
      ]),
    };
    const flags = checkPrePdfContradictions({
      summaryInput,
      tiles: [
        {
          id: "mileage",
          label: "Nobraukums",
          value: "130 000 km",
          note: "5 ieraksti bez pretrunām",
          tone: "ok",
        },
      ],
    });
    expect(flags.some((f) => f.id === "c1_header_count")).toBe(true);
  });

  it("flags C4 when timeline TA km differs from same-day CSDD history", () => {
    const csdd = csddMileage([{ date: "12.05.2024", odometer: "148200" }]);
    csdd.technicalInspectionHistory = [ta("12.05.2024")];
    expect(csddMileageOnSameDate(csdd, "12.05.2024")).toBe("148200");
    const flags = checkPrePdfContradictions({
      summaryInput: { csddForm: csdd },
      lifecycleEvents: [
        {
          kind: "inspection",
          date: "12.05.2024",
          time: Date.UTC(2024, 4, 12),
          year: "2024",
          title: "Tehniskā apskate",
          detail: "1",
          country: "Latvija",
          odometer: "99000",
          sources: ["CSDD"],
          tone: "info",
        },
      ],
    });
    expect(flags.some((f) => f.id === "c4_timeline_ta_km")).toBe(true);
  });

  it("flags C8 when total loss is in sources but not on the incidents tile", () => {
    const flags = checkPrePdfContradictions({
      summaryInput: {
        manualVendorBlocks: [
          {
            title: SOURCE_BLOCK_LABELS.carvertical,
            mileageRows: [],
            incidentRows: [],
            comments: "Record of totaled vehicle in 2019",
          },
        ],
      },
      tiles: [
        {
          id: "incidents",
          label: "Negadījumi un bojājumi",
          value: "1 negadījums",
          note: "Jaunākais: 01.06.2019",
          tone: "warn",
        },
      ],
    });
    expect(flags.some((f) => f.id === "c8_total_loss")).toBe(true);
  });

  it("flags C9 when owners tile still says Nav ierakstu despite changes", () => {
    const flags = checkPrePdfContradictions({
      summaryInput: {
        manualVendorBlocks: [
          {
            title: SOURCE_BLOCK_LABELS.carvertical,
            mileageRows: [],
            incidentRows: [],
            comments: "",
            vehicleHistoryTimeline: [
              { date: "01.06.2014", country: "DE", description: "Ownership change" },
            ],
          },
        ],
      },
      tiles: [
        {
          id: "owners",
          label: "Īpašnieku skaits",
          value: "Nav ierakstu",
          note: "",
          tone: "neutral",
        },
      ],
    });
    expect(flags.some((f) => f.id === "c9_owners_empty")).toBe(true);
  });

  it("dismissed rollback is not an E flag", () => {
    const summaryInput = {
      csddForm: csddMileage([
        { date: "01.01.2020", odometer: "180000" },
        { date: "01.06.2024", odometer: "120000" },
      ]),
    };
    const rows = prepareUnifiedMileageDisplayRows(collectUnifiedMileageRows({ csddForm: summaryInput.csddForm }));
    const [flag] = classifyOdometerAnomalies(rows);
    const flags = checkPrePdfContradictions({
      summaryInput,
      overrides: flag ? [{ key: flag.key, action: "dismiss" }] : [],
    });
    expect(flags.some((f) => f.id.startsWith("odo_rollback"))).toBe(false);
    const tiles = buildPdfReportSummaryTiles({
      ...summaryInput,
      odometerAnomalyOverrides: flag ? [{ key: flag.key, action: "dismiss" }] : [],
    });
    expect(tiles.find((t) => t.id === "mileage")?.note).toMatch(/bez pretrunām/);
  });
});

describe("listing km as note segment", () => {
  it("adds sludinājuma km when it differs from the last chart point", () => {
    const tirgus = emptyTirgusFields();
    tirgus.listingMileageOdometer = "181200";
    tirgus.listingMileageDate = "01.06.2024";
    tirgus.listingMileageCountry = "Latvija";
    const tiles = buildPdfReportSummaryTiles({
      csddForm: csddMileage([
        { date: "01.01.2020", odometer: "100000" },
        { date: "12.05.2024", odometer: "180000" },
      ]),
      tirgusForm: tirgus,
      listingUrl: "https://www.ss.com/msg/lv/transport/cars/bmw/x5/x.html",
    });
    const mileage = tiles.find((t) => t.id === "mileage");
    expect(mileage?.noteSegments?.some((s) => /sludinājumā/.test(s) && /181/.test(s))).toBe(true);
  });
});
