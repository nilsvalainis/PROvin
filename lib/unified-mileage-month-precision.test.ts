import { describe, expect, it } from "vitest";
import {
  analyzeUnifiedMileageAnomalies,
  collectUnifiedMileageRows,
  isMonthOnlyVendorReading,
  sortMileageChronological,
  type UnifiedMileageRow,
} from "@/lib/unified-mileage";

const r = (sourceOrder: number, date: string, odometer: string, sourceLabel: string, month = false): UnifiedMileageRow => {
  const [d, m, y] = date.split(".").map(Number);
  return {
    date,
    odometer,
    country: "Vācija",
    sortableTime: Date.UTC(y!, m! - 1, d!),
    sourceOrder,
    sourceLabel,
    datePrecision: month ? "month" : "day",
  };
};

describe("17.11 klase A: carVertical mēneša rādījumi", () => {
  it("carVertical 01.MM.GGGG ir mēneša precizitāte; dīleris 01.MM - nē", () => {
    expect(isMonthOnlyVendorReading("CarVertical", "01.12.2013")).toBe(true);
    expect(isMonthOnlyVendorReading("CarVertical", "14.12.2013")).toBe(false);
    expect(isMonthOnlyVendorReading("OFICIĀLĀ DĪLERA DATI", "01.12.2013")).toBe(false);
  });

  it("BMW 650i: CV 12.2013 35 820 starp dīleri 02.12 (33 694) un 14.12 (35 842) - pareizais dīleris vairs nav kļūda", () => {
    const rows = [
      r(0, "28.10.2013", "28355", "OFICIĀLĀ DĪLERA DATI"),
      r(1, "01.12.2013", "35820", "CarVertical", true),
      r(2, "02.12.2013", "33694", "OFICIĀLĀ DĪLERA DATI"),
      r(3, "14.12.2013", "35842", "OFICIĀLĀ DĪLERA DATI"),
    ];
    expect(sortMileageChronological(rows).map((x) => x.odometer)).toEqual(["28355", "33694", "35820", "35842"]);
    const a = analyzeUnifiedMileageAnomalies(rows);
    expect(a.dataEntryErrorSourceOrders.size).toBe(0);
    expect([...a.anomalyBySourceOrder.values()].some(Boolean)).toBe(false);
  });

  it("īsts kritums citā mēnesī paliek (Škoda Superb tipa): mēneša kārtošana skar tikai to pašu mēnesi", () => {
    const rows = [
      r(0, "11.05.2020", "253760", "AutoDNA"),
      r(1, "01.09.2020", "181000", "CarVertical", true),
      r(2, "28.09.2020", "181345", "CSDD"),
      r(3, "26.10.2021", "195748", "CSDD"),
    ];
    const a = analyzeUnifiedMileageAnomalies(rows);
    expect([...a.anomalyBySourceOrder.values()].some(Boolean)).toBe(true);
  });

  it("ielasē carVertical rindas iegūst mēneša precizitāti", () => {
    const rows = collectUnifiedMileageRows({
      manualVendorBlocks: [{ title: "CarVertical", mileageRows: [{ date: "01.12.2013", odometer: "35820", country: "Vācija" }] }],
    } as never);
    expect(rows[0]?.datePrecision).toBe("month");
  });
});
