import { describe, expect, it } from "vitest";
import { parseCsddMileagePairsDense } from "@/lib/csdd-mileage-dense-parse";

describe("parseCsddMileagePairsDense", () => {
  it("extracts multiple pairs from one dense line", () => {
    const raw = `Nobraukuma vēsture
274516 - 16.12.2025 269950 - 04.12.2024 269934 - 04.12.2024 269457 - 12.11.2024
Tehnisko apskašu vēsture`;
    const rows = parseCsddMileagePairsDense(raw);
    expect(rows.length).toBeGreaterThanOrEqual(4);
    expect(rows[0]?.odometer).toBe("274516");
    expect(rows[0]?.date).toBe("16.12.2025");
  });
});
