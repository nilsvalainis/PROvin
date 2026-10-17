import { describe, expect, it } from "vitest";

import { createDefaultSourceBlocks, emptyAutoRecordsBlock } from "@/lib/admin-source-blocks";
import { analyzeVinAndKm } from "@/lib/admin-workspace-preview-format";
import {
  analyzeUnifiedMileageAnomalies,
  collectUnifiedMileageRows,
  DEALER_MILEAGE_TABLE_EMPTY_VISITS_WARNING,
  dealerMileageTableEmptyButVisitsHaveOdometer,
  mergeUnifiedMileageRowsByOdometer,
  prepareUnifiedMileageDisplayRows,
  selectNewestVerifiedMileageRow,
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

describe("prepareUnifiedMileageDisplayRows cross-source duplicates", () => {
  it("merges a month-only vendor reading into the exact-dated dealer record (X5 22 km offset)", () => {
    const rows = prepareUnifiedMileageDisplayRows([
      row({ date: "01.12.2009", odometer: "90577", sourceLabel: "CarVertical", sourceOrder: 0, sortableTime: Date.UTC(2009, 11, 1) }),
      row({ date: "22.12.2009", odometer: "90599", sourceLabel: "DEALER", sourceOrder: 1, sortableTime: Date.UTC(2009, 11, 22), documentValue: true }),
      row({ date: "01.12.2011", odometer: "63573", sourceLabel: "CarVertical", sourceOrder: 2, sortableTime: Date.UTC(2011, 11, 1) }),
      row({ date: "23.12.2011", odometer: "63595", sourceLabel: "DEALER", sourceOrder: 3, sortableTime: Date.UTC(2011, 11, 23), documentValue: true }),
    ]);

    expect(rows).toHaveLength(2);
    expect(rows[0]?.date).toBe("22.12.2009");
    expect(rows[0]?.odometer).toBe("90599");
    expect(rows[0]?.sourceLabels).toEqual(expect.arrayContaining(["DEALER", "CarVertical"]));
    expect(rows[1]?.date).toBe("23.12.2011");
    expect(rows[1]?.odometer).toBe("63595");

    // Apvienošana nedrīkst noņemt vienīgo īsto pretrunu.
    const { anomalyBySourceOrder } = analyzeUnifiedMileageAnomalies(rows);
    expect([...anomalyBySourceOrder.values()].filter(Boolean)).toHaveLength(1);
    expect(anomalyBySourceOrder.get(rows[1]!.sourceOrder)).toBe(true);
  });

  it("keeps separate same-source order lines from one workshop episode", () => {
    const rows = prepareUnifiedMileageDisplayRows([
      row({ date: "27.02.2018", odometer: "145369", sourceLabel: "DEALER", sourceOrder: 0, sortableTime: Date.UTC(2018, 1, 27), documentValue: true }),
      row({ date: "27.02.2018", odometer: "145378", sourceLabel: "DEALER", sourceOrder: 1, sortableTime: Date.UTC(2018, 1, 27), documentValue: true }),
      row({ date: "28.02.2018", odometer: "145430", sourceLabel: "DEALER", sourceOrder: 2, sortableTime: Date.UTC(2018, 1, 28), documentValue: true }),
    ]);
    expect(rows.map((r) => r.odometer)).toEqual(["145369", "145378", "145430"]);
  });

  it("does not merge readings that are far apart in km or in different months", () => {
    const rows = prepareUnifiedMileageDisplayRows([
      row({ date: "01.02.2018", odometer: "145010", sourceLabel: "CarVertical", sourceOrder: 0, sortableTime: Date.UTC(2018, 1, 1) }),
      row({ date: "21.02.2018", odometer: "145065", sourceLabel: "DEALER", sourceOrder: 1, sortableTime: Date.UTC(2018, 1, 21), documentValue: true }),
      row({ date: "27.02.2018", odometer: "145369", sourceLabel: "AutoDNA", sourceOrder: 2, sortableTime: Date.UTC(2018, 1, 27) }),
      row({ date: "02.03.2018", odometer: "145400", sourceLabel: "CarVertical", sourceOrder: 3, sortableTime: Date.UTC(2018, 2, 2) }),
    ]);
    expect(rows.map((r) => r.odometer)).toEqual(["145065", "145369", "145400"]);
  });
});

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

  it("treats A→low→A+ as a data-entry error, not a contradiction", () => {
    const rows = [
      row({ date: "01.01.2016", odometer: "50000", sourceLabel: "DEALER", sourceOrder: 0, sortableTime: Date.UTC(2016, 0, 1) }),
      row({ date: "01.06.2016", odometer: "12000", sourceLabel: "CarVertical", sourceOrder: 1, sortableTime: Date.UTC(2016, 5, 1) }),
      row({ date: "01.08.2016", odometer: "61000", sourceLabel: "CarVertical", sourceOrder: 2, sortableTime: Date.UTC(2016, 7, 1) }),
    ];
    const { anomalyBySourceOrder, dataEntryErrorSourceOrders } = analyzeUnifiedMileageAnomalies(rows);
    expect(dataEntryErrorSourceOrders.has(1)).toBe(true);
    expect(anomalyBySourceOrder.get(1)).toBe(false);
    expect(anomalyBySourceOrder.get(2)).toBe(false);
  });

  it("does not compare CarVertical month-only 12.2013 as 01.12 against a same-month dealer reading", () => {
    const rows = prepareUnifiedMileageDisplayRows([
      row({
        date: "12.2013",
        odometer: "42080",
        sourceLabel: "CarVertical",
        sourceOrder: 0,
        sortableTime: Date.UTC(2013, 11, 1),
        datePrecision: "month",
      }),
      row({
        date: "15.12.2013",
        odometer: "42150",
        sourceLabel: "DEALER",
        sourceOrder: 1,
        sortableTime: Date.UTC(2013, 11, 15),
        datePrecision: "day",
      }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.date).toBe("15.12.2013");
    expect(rows[0]?.sourceLabels).toEqual(expect.arrayContaining(["DEALER", "CarVertical"]));
    const { anomalyBySourceOrder } = analyzeUnifiedMileageAnomalies(rows);
    expect(anomalyBySourceOrder.get(rows[0]!.sourceOrder)).toBe(false);
  });

  it("does not flag a listing reading at or below the newest verified km", () => {
    const rows = [
      row({ date: "02.06.2018", odometer: "88310", sourceLabel: "OFICIĀLĀ DĪLERA DATI", sourceOrder: 0, sortableTime: Date.UTC(2018, 5, 2) }),
      row({
        date: "01.04.2024",
        odometer: "87000",
        sourceLabel: "Sludinājums",
        sourceOrder: 1,
        sortableTime: Date.UTC(2024, 3, 1),
        countryUnverified: true,
      }),
    ];
    const { anomalyBySourceOrder } = analyzeUnifiedMileageAnomalies(rows);
    expect(anomalyBySourceOrder.get(1)).toBe(false);
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

  it("does not paint the post-rollback climb as stale documents (X5 90599 → 63573)", () => {
    const rows = [
      row({ date: "22.12.2009", odometer: "90599", sourceLabel: "DEALER", sourceOrder: 0, sortableTime: Date.UTC(2009, 11, 22), documentValue: true }),
      row({ date: "01.12.2011", odometer: "63573", sourceLabel: "CarVertical", sourceOrder: 1, sortableTime: Date.UTC(2011, 11, 1) }),
      row({ date: "23.12.2011", odometer: "63595", sourceLabel: "DEALER", sourceOrder: 2, sortableTime: Date.UTC(2011, 11, 23), documentValue: true }),
      row({ date: "12.01.2012", odometer: "64316", sourceLabel: "DEALER", sourceOrder: 3, sortableTime: Date.UTC(2012, 0, 12), documentValue: true }),
      row({ date: "13.07.2012", odometer: "66935", sourceLabel: "DEALER", sourceOrder: 4, sortableTime: Date.UTC(2012, 6, 13), documentValue: true }),
      row({ date: "18.02.2015", odometer: "70315", sourceLabel: "AutoDNA", sourceOrder: 5, sortableTime: Date.UTC(2015, 1, 18) }),
      row({ date: "02.02.2016", odometer: "87378", sourceLabel: "DEALER", sourceOrder: 6, sortableTime: Date.UTC(2016, 1, 2), documentValue: true }),
      row({ date: "30.01.2017", odometer: "105491", sourceLabel: "DEALER", sourceOrder: 7, sortableTime: Date.UTC(2017, 0, 30), documentValue: true }),
    ];
    const { anomalyBySourceOrder, staleDocumentSourceOrders } = analyzeUnifiedMileageAnomalies(rows);
    expect(anomalyBySourceOrder.get(1)).toBe(true);
    expect(staleDocumentSourceOrders.size).toBe(0);
    expect(anomalyBySourceOrder.get(2)).toBe(false);
    expect(anomalyBySourceOrder.get(3)).toBe(false);
    expect(anomalyBySourceOrder.get(5)).toBe(false);
    expect(anomalyBySourceOrder.get(6)).toBe(false);
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

describe("selectNewestVerifiedMileageRow", () => {
  it("picks newer AutoDNA over older CSDD and ignores ss.lv", () => {
    const rows = [
      row({ date: "11.10.2025", odometer: "41568", sourceLabel: "CSDD", sourceOrder: 0, sortableTime: Date.UTC(2025, 9, 11) }),
      row({ date: "01.07.2026", odometer: "49136", sourceLabel: "AutoDNA", sourceOrder: 1, sortableTime: Date.UTC(2026, 6, 1) }),
      row({ date: "01.07.2026", odometer: "49096", sourceLabel: "CarVertical", sourceOrder: 2, sortableTime: Date.UTC(2026, 6, 1) }),
      row({
        date: "01.08.2026",
        odometer: "50936",
        sourceLabel: "ss.lv",
        sourceOrder: 3,
        sortableTime: Date.UTC(2026, 7, 1),
        countryUnverified: true,
      }),
    ];
    const newest = selectNewestVerifiedMileageRow(rows);
    expect(newest?.odometer.replace(/\D/g, "")).toBe("49136");
    expect(newest?.sourceLabel).toBe("AutoDNA");
    const { anomalyBySourceOrder } = analyzeUnifiedMileageAnomalies(rows);
    expect(anomalyBySourceOrder.get(3)).toBe(false);
  });

  it("keeps CSDD when it is the same date as AutoDNA", () => {
    const rows = [
      row({ date: "01.07.2026", odometer: "49050", sourceLabel: "CSDD", sourceOrder: 0, sortableTime: Date.UTC(2026, 6, 1) }),
      row({ date: "01.07.2026", odometer: "49136", sourceLabel: "AutoDNA", sourceOrder: 1, sortableTime: Date.UTC(2026, 6, 1) }),
    ];
    expect(selectNewestVerifiedMileageRow(rows)?.sourceLabel).toBe("CSDD");
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

  it("ņem OneAuto servisa km kā OFICIĀLĀ DĪLERA DATI dokumenta rādījumu", () => {
    const collected = collectUnifiedMileageRows({
      oneautoBlock: {
        ...createDefaultSourceBlocks().oneauto,
        display: {
          equipment: [],
          powertrain: [],
          serviceTimeline: [
            { date: "23.12.2020", odometer: "142220", place: "", works: "Eļļas maiņa" },
          ],
        },
      },
    });
    expect(collected).toHaveLength(1);
    expect(collected[0]).toMatchObject({
      date: "23.12.2020",
      sourceLabel: "OFICIĀLĀ DĪLERA DATI",
      documentValue: true,
    });
    expect(collected[0]?.odometer.replace(/\D/g, "")).toBe("142220");
  });

  it("adds dealer visit odometers when the mileage table is empty", () => {
    const collected = collectUnifiedMileageRows({
      autoRecordsBlock: {
        ...emptyAutoRecordsBlock(),
        serviceHistory: [{ date: "", odometer: "", country: "" }],
        serviceWorks: [
          { date: "15.05.2026", odometer: "45328", location: "Mārupe", works: "Apkope" },
          { date: "01.07.2026", odometer: "49100", location: "Mārupe", works: "Eļļas maiņa" },
        ],
      },
    });
    expect(collected.map((r) => r.odometer.replace(/\D/g, ""))).toEqual(["45328", "49100"]);
    expect(collected.every((r) => r.documentValue === true && r.visitOdometer === true && r.sourceLabel === "OFICIĀLĀ DĪLERA DATI")).toBe(true);
  });

  it("does not invent extra visit rows when the dealer mileage table already has data", () => {
    const collected = collectUnifiedMileageRows({
      autoRecordsBlock: {
        ...emptyAutoRecordsBlock(),
        serviceHistory: [{ date: "02.10.2014", odometer: "41874", country: "Vācija" }],
        serviceWorks: [
          { date: "02.10.2014", odometer: "41874", location: "Autohaus", works: "Apkope" },
          { date: "09.01.2015", odometer: "33472", location: "Autohaus", works: "Pasūtījums" },
        ],
      },
    });
    expect(collected).toHaveLength(1);
    expect(collected[0]?.odometer.replace(/\D/g, "")).toBe("41874");
  });
});

describe("dealerMileageTableEmptyButVisitsHaveOdometer", () => {
  it("warns only when the table is empty and visits have an odometer", () => {
    expect(
      dealerMileageTableEmptyButVisitsHaveOdometer({
        serviceHistory: [{ date: "", odometer: "", country: "" }],
        serviceWorks: [{ date: "15.05.2026", odometer: "45328", location: "Mārupe", works: "Apkope" }],
      }),
    ).toBe(true);
    expect(
      dealerMileageTableEmptyButVisitsHaveOdometer({
        serviceHistory: [{ date: "15.05.2026", odometer: "45328", country: "Latvija" }],
        serviceWorks: [{ date: "15.05.2026", odometer: "45328", location: "Mārupe", works: "Apkope" }],
      }),
    ).toBe(false);
    expect(
      dealerMileageTableEmptyButVisitsHaveOdometer({
        serviceHistory: [{ date: "", odometer: "", country: "" }],
        serviceWorks: [{ date: "15.05.2026", odometer: "", location: "Mārupe", works: "Apkope" }],
      }),
    ).toBe(false);

    const analysis = analyzeVinAndKm({
      orderVin: null,
      blocks: [],
      fileNames: [],
      autoRecordsBlock: {
        ...emptyAutoRecordsBlock(),
        serviceWorks: [{ date: "15.05.2026", odometer: "45328", location: "Mārupe", works: "Apkope" }],
      },
    });
    expect(analysis.kmIssues).toContain(DEALER_MILEAGE_TABLE_EMPTY_VISITS_WARNING);
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
