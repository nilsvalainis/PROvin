import { describe, expect, it } from "vitest";
import {
  autoRecordsMileageRowHasData,
  type AutoRecordsServiceRow,
} from "@/lib/auto-records-paste-parse";

describe("autoRecordsMileageRowHasData", () => {
  it("rejects date-only rows without odometer", () => {
    const row: AutoRecordsServiceRow = { date: "15.03.2019", odometer: "", country: "Vācija" };
    expect(autoRecordsMileageRowHasData(row)).toBe(false);
  });

  it("accepts rows with km digits", () => {
    const row: AutoRecordsServiceRow = { date: "15.03.2019", odometer: "125430", country: "Vācija" };
    expect(autoRecordsMileageRowHasData(row)).toBe(true);
  });
});
