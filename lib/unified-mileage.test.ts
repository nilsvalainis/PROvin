import { describe, expect, it } from "vitest";

import { createDefaultSourceBlocks } from "@/lib/admin-source-blocks";
import {
  analyzeUnifiedMileageAnomalies,
  collectUnifiedMileageRows,
  mergeUnifiedMileageRowsByOdometer,
  prepareUnifiedMileageDisplayRows,
  type UnifiedMileageRow,
} from "@/lib/unified-mileage";

function row(partial: Partial<UnifiedMileageRow> & Pick<UnifiedMileageRow, "date" | "odometer" | "sourceLabel">): UnifiedMileageRow {
  const sortableTime = partial.sortableTime ?? Date.parse(partial.date);
  return {
    country: "LV",
    sourceOrder: 0,
    ...partial,
    sortableTime,
  };
}

describe("mergeUnifiedMileageRowsByOdometer", () => {
  it("merges identical km from different sources within 2 months", () => {
    const merged = mergeUnifiedMileageRowsByOdometer([
      row({ date: "2020-06-01", odometer: "120000", sourceLabel: "CSDD", sourceOrder: 0 }),
      row({ date: "2020-07-15", odometer: "120000", sourceLabel: "AutoDNA", sourceOrder: 1 }),
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.sourceLabels).toEqual(expect.arrayContaining(["CSDD", "AutoDNA"]));
    expect(merged[0]?.date).toBe("2020-07-15");
  });

  it("keeps separate rows when same km but dates exceed 2 months", () => {
    const merged = mergeUnifiedMileageRowsByOdometer([
      row({ date: "2020-01-01", odometer: "120000", sourceLabel: "CSDD", sourceOrder: 0 }),
      row({ date: "2020-06-01", odometer: "120000", sourceLabel: "AutoDNA", sourceOrder: 1 }),
    ]);
    expect(merged).toHaveLength(2);
  });

  it("does not merge different km readings", () => {
    const merged = mergeUnifiedMileageRowsByOdometer([
      row({ date: "2020-06-01", odometer: "120000", sourceLabel: "CSDD", sourceOrder: 0 }),
      row({ date: "2020-06-02", odometer: "121000", sourceLabel: "CarVertical", sourceOrder: 1 }),
    ]);
    expect(merged).toHaveLength(2);
  });

  it("prepareUnifiedMileageDisplayRows returns chronologically sorted merged rows", () => {
    const out = prepareUnifiedMileageDisplayRows([
      row({ date: "2021-01-01", odometer: "150000", sourceLabel: "LTAB", sourceOrder: 2 }),
      row({ date: "2020-06-01", odometer: "120000", sourceLabel: "CSDD", sourceOrder: 0 }),
      row({ date: "2020-07-01", odometer: "120000", sourceLabel: "AutoDNA", sourceOrder: 1 }),
    ]);
    expect(out).toHaveLength(2);
    expect(out[0]?.odometer).toBe("120000");
    expect(out[0]?.sourceLabels).toHaveLength(2);
    expect(out[1]?.odometer).toBe("150000");
  });
});

describe("analyzeUnifiedMileageAnomalies", () => {
  it("flags extra-digit spike (255811) and excludes it from chart; does not flag recovery", () => {
    const rows = [
      row({
        date: "01.03.2010",
        odometer: "25381",
        sourceLabel: "CV",
        sourceOrder: 0,
        country: "DE",
        sortableTime: Date.UTC(2010, 2, 1),
      }),
      row({
        date: "01.03.2010",
        odometer: "25581",
        sourceLabel: "DNA",
        sourceOrder: 1,
        country: "DE",
        sortableTime: Date.UTC(2010, 2, 1),
      }),
      row({
        date: "29.03.2010",
        odometer: "255811",
        sourceLabel: "DEALER",
        sourceOrder: 2,
        country: "DE",
        sortableTime: Date.UTC(2010, 2, 29),
      }),
      row({
        date: "01.01.2011",
        odometer: "49481",
        sourceLabel: "CV",
        sourceOrder: 3,
        country: "DE",
        sortableTime: Date.UTC(2011, 0, 1),
      }),
      row({
        date: "11.01.2011",
        odometer: "49681",
        sourceLabel: "DEALER",
        sourceOrder: 4,
        country: "DE",
        sortableTime: Date.UTC(2011, 0, 11),
      }),
    ];
    const { anomalyBySourceOrder, chartExcludeSourceOrders } = analyzeUnifiedMileageAnomalies(rows);
    expect(chartExcludeSourceOrders.has(2)).toBe(true);
    expect(anomalyBySourceOrder.get(2)).toBe(true);
    expect(anomalyBySourceOrder.get(3)).toBe(false);
    expect(anomalyBySourceOrder.get(4)).toBe(false);
  });

  it("still flags genuine odometer rollback", () => {
    const rows = [
      row({
        date: "01.01.2020",
        odometer: "150000",
        sourceLabel: "AutoDNA",
        sourceOrder: 0,
        country: "NL",
        sortableTime: Date.UTC(2020, 0, 1),
      }),
      row({
        date: "01.01.2022",
        odometer: "80000",
        sourceLabel: "CSDD",
        sourceOrder: 1,
        country: "LV",
        sortableTime: Date.UTC(2022, 0, 1),
      }),
    ];
    const { anomalyBySourceOrder, chartExcludeSourceOrders } = analyzeUnifiedMileageAnomalies(rows);
    expect(chartExcludeSourceOrders.size).toBe(0);
    expect(anomalyBySourceOrder.get(1)).toBe(true);
  });

  it("treats a stale dealer-order odometer as „dokumenta datums ≠ nolasījuma datums”, not a contradiction", () => {
    // BMW WBA3D91080J411190: 02.10.2014 atslēgas nolasījums 41874, pasūtījumi 28.10.2014 / 09.01.2015 ar 33472.
    const rows = [
      row({ date: "03.05.2014", odometer: "33472", sourceLabel: "DEALER", sourceOrder: 0, sortableTime: Date.UTC(2014, 4, 3) }),
      row({ date: "02.10.2014", odometer: "41874", sourceLabel: "DEALER", sourceOrder: 1, sortableTime: Date.UTC(2014, 9, 2) }),
      row({
        date: "28.10.2014",
        odometer: "33472",
        sourceLabel: "DEALER",
        sourceOrder: 2,
        sortableTime: Date.UTC(2014, 9, 28),
        documentValue: true,
      }),
      row({ date: "01.01.2015", odometer: "33272", sourceLabel: "CarVertical", sourceOrder: 3, sortableTime: Date.UTC(2015, 0, 1) }),
      row({
        date: "09.01.2015",
        odometer: "33472",
        sourceLabel: "DEALER",
        sourceOrder: 4,
        sortableTime: Date.UTC(2015, 0, 9),
        documentValue: true,
      }),
      row({ date: "01.01.2016", odometer: "62175", sourceLabel: "CarVertical", sourceOrder: 5, sortableTime: Date.UTC(2016, 0, 1) }),
    ];
    const { anomalyBySourceOrder, chartExcludeSourceOrders, staleDocumentSourceOrders } =
      analyzeUnifiedMileageAnomalies(rows);

    expect(staleDocumentSourceOrders.has(2)).toBe(true);
    expect(staleDocumentSourceOrders.has(4)).toBe(true);
    // Cita avota atkārtots tas pats novecojušais rādījums arī nav pretruna.
    expect(staleDocumentSourceOrders.has(3)).toBe(true);
    expect(anomalyBySourceOrder.get(2)).toBe(false);
    expect(anomalyBySourceOrder.get(3)).toBe(false);
    expect(anomalyBySourceOrder.get(4)).toBe(false);
    expect(anomalyBySourceOrder.get(5)).toBe(false);
    // Novecojušie dokumenti neizkropļo līkni un vidējo nobraukumu.
    expect(chartExcludeSourceOrders.has(2)).toBe(true);
    expect(chartExcludeSourceOrders.has(4)).toBe(true);
  });

  it("keeps flagging a rollback when later readings never return to the earlier level", () => {
    const rows = [
      row({ date: "01.01.2020", odometer: "150000", sourceLabel: "AutoDNA", sourceOrder: 0, sortableTime: Date.UTC(2020, 0, 1) }),
      row({
        date: "01.01.2021",
        odometer: "80000",
        sourceLabel: "DEALER",
        sourceOrder: 1,
        sortableTime: Date.UTC(2021, 0, 1),
        documentValue: true,
      }),
      row({ date: "01.06.2021", odometer: "85000", sourceLabel: "CSDD", sourceOrder: 2, sortableTime: Date.UTC(2021, 5, 1) }),
      row({ date: "01.01.2022", odometer: "90000", sourceLabel: "CSDD", sourceOrder: 3, sortableTime: Date.UTC(2022, 0, 1) }),
    ];
    const { anomalyBySourceOrder, staleDocumentSourceOrders } = analyzeUnifiedMileageAnomalies(rows);
    expect(staleDocumentSourceOrders.size).toBe(0);
    expect(anomalyBySourceOrder.get(1)).toBe(true);
  });

  it("does not touch a dealer-order odometer that fits the reading chain", () => {
    const rows = [
      row({ date: "01.01.2020", odometer: "100000", sourceLabel: "DEALER", sourceOrder: 0, sortableTime: Date.UTC(2020, 0, 1) }),
      row({
        date: "01.06.2020",
        odometer: "108000",
        sourceLabel: "DEALER",
        sourceOrder: 1,
        sortableTime: Date.UTC(2020, 5, 1),
        documentValue: true,
      }),
      row({ date: "01.01.2021", odometer: "115000", sourceLabel: "CSDD", sourceOrder: 2, sortableTime: Date.UTC(2021, 0, 1) }),
    ];
    const { anomalyBySourceOrder, staleDocumentSourceOrders, chartExcludeSourceOrders } =
      analyzeUnifiedMileageAnomalies(rows);
    expect(staleDocumentSourceOrders.size).toBe(0);
    expect(chartExcludeSourceOrders.size).toBe(0);
    expect([...anomalyBySourceOrder.values()].every((v) => v === false)).toBe(true);
  });
});

describe("collectUnifiedMileageRows — dokumenta rādījumi", () => {
  it("marks dealer mileage rows that come from a service/repair order", () => {
    const collected = collectUnifiedMileageRows({
      autoRecordsBlock: {
        ...createDefaultSourceBlocks().auto_records,
        serviceHistory: [
          { date: "02.10.2014", odometer: "41874", country: "Vācija" },
          { date: "28.10.2014", odometer: "33472", country: "Vācija" },
        ],
        serviceWorks: [
          { date: "28.10.2014", odometer: "33472", location: "Autohaus Karl + Co., Rüsselsheim", works: "Eļļas maiņa" },
        ],
      },
    });
    const byOdometer = new Map(collected.map((r) => [r.odometer.replace(/\D/g, ""), r]));
    expect(byOdometer.get("41874")?.documentValue).toBeUndefined();
    expect(byOdometer.get("33472")?.documentValue).toBe(true);
  });
});

describe("collectUnifiedMileageRows — sludinājuma odometrs", () => {
  it("adds SS.LV listing km on first publication date with Latvia", () => {
    const collected = collectUnifiedMileageRows({
      listingUrl: "https://www.ss.lv/msg/lv/transport/cars/audi/q7/bcdpnx.html",
      tirgusForm: {
        ...createDefaultSourceBlocks().tirgus,
        listingCreated: "16.07.2026",
        listingMileageDate: "01.08.2026",
        listingMileageOdometer: "233 000",
        listingMileageCountry: "Vācija",
      },
    });
    expect(collected).toHaveLength(1);
    expect(collected[0]).toMatchObject({
      date: "16.07.2026",
      odometer: "233 000",
      country: "Latvija",
      sourceLabel: "ss.lv",
    });
  });

  it("omits listing mileage when asked", () => {
    const collected = collectUnifiedMileageRows(
      {
        listingUrl: "https://www.ss.lv/msg/lv/transport/cars/audi/q7/bcdpnx.html",
        tirgusForm: {
          ...createDefaultSourceBlocks().tirgus,
          listingCreated: "16.07.2026",
          listingMileageOdometer: "233000",
        },
      },
      { omitListingMileage: true },
    );
    expect(collected).toHaveLength(0);
  });
});
