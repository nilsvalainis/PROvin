import { describe, expect, it } from "vitest";
import {
  looksLikeMileageHistoryOdometerPaste,
  parseMileageHistoryOdometerPaste,
} from "@/lib/mileage-history-odometer-paste-parse";

const SAMPLE_RAW = `Mileage history
Reported odometer readings
Inspection
478,760 km
2023-06-26
Inspection
445,370 km
2022-06-20
Subsequent inspection
383,450 km
2021-08-24
Subsequent inspection
379,520 km
2021-08-04
Inspection
369,580 km
2021-06-24
Inspection
317,900 km
2020-06-15
Subsequent inspection
230,600 km
2019-06-14
Inspection
36,630 km
2019-06-05
Inspection
114,960 km
2018-05-28
Registry
0 km
2016-12-29`;

describe("parseMileageHistoryOdometerPaste", () => {
  it("detects Mileage history paste format", () => {
    expect(looksLikeMileageHistoryOdometerPaste(SAMPLE_RAW)).toBe(true);
  });

  it("parses all 10 odometer rows with ISO dates converted to DD.MM.YYYY", () => {
    const rows = parseMileageHistoryOdometerPaste(SAMPLE_RAW);
    expect(rows).toHaveLength(10);
    expect(rows.find((r) => r.date === "26.06.2023")?.odometer).toBe("478760");
    expect(rows.find((r) => r.date === "20.06.2022")?.odometer).toBe("445370");
    expect(rows.find((r) => r.date === "24.08.2021")?.odometer).toBe("383450");
    expect(rows.find((r) => r.date === "29.12.2016")?.odometer).toBe("0");
  });

  it("sorts newest date first", () => {
    const rows = parseMileageHistoryOdometerPaste(SAMPLE_RAW);
    expect(rows[0]?.date).toBe("26.06.2023");
    expect(rows[rows.length - 1]?.date).toBe("29.12.2016");
  });
});
