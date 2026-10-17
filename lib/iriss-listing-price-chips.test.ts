import { describe, expect, it } from "vitest";
import {
  hitMatchesIrissPriceFilter,
  irissPriceChipFilterLabel,
  irissPriceHistoryRows,
  latestIrissPriceChip,
} from "@/lib/iriss-listing-price-chips";

describe("iriss-listing-price-chips", () => {
  it("builds down/up chips from real history and ignores fake cent pairs", () => {
    const down = latestIrissPriceChip([
      { at: "2026-10-15T10:00:00.000Z", field: "current", from: 12000, to: 11400 },
    ]);
    expect(down?.direction).toBe("down");
    expect(down?.label).toContain("↓");
    expect(down?.label).toContain("600 €");
    expect(down?.label).toContain("kopš 15.10");
    expect(down?.label).not.toMatch(/[\u2013\u2014]/);

    const up = latestIrissPriceChip([
      { at: "2026-10-16T10:00:00.000Z", field: "current", from: 10500, to: 10750 },
    ]);
    expect(up?.direction).toBe("up");
    expect(up?.label).toContain("↑");
    expect(hitMatchesIrissPriceFilter([{ at: "2026-10-16T10:00:00.000Z", field: "current", from: 10500, to: 10750 }], "up")).toBe(true);
    expect(hitMatchesIrissPriceFilter([{ at: "2026-10-16T10:00:00.000Z", field: "current", from: 10500, to: 10750 }], "down")).toBe(false);
    expect(irissPriceChipFilterLabel("down")).toBe("Cena kritusies");
    expect(irissPriceHistoryRows([{ at: "2026-10-16T10:00:00.000Z", field: "current", from: 10500, to: 10750 }])).toHaveLength(1);
  });

  it("returns null when there is no real change", () => {
    expect(latestIrissPriceChip([])).toBeNull();
    expect(latestIrissPriceChip([{ at: "2026-10-16T10:00:00.000Z", field: "current", from: 10000, to: 10000 }])).toBeNull();
  });
});
