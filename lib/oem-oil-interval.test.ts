import { describe, expect, it } from "vitest";
import {
  oilRatioTone,
  parseOemOilIntervalFromText,
} from "@/lib/oem-oil-interval";

describe("parseOemOilIntervalFromText", () => {
  it("reads the canonical first line", () => {
    expect(
      parseOemOilIntervalFromText("Ražotāja intervāls: 30 000 km / 24 mēn. (N47D20, Longlife maksimums)"),
    ).toEqual({ km: 30_000, months: 24 });
    expect(parseOemOilIntervalFromText("Ražotāja intervāls: 15000 km / 12 mēn.")).toEqual({
      km: 15_000,
      months: 12,
    });
  });

  it("returns null when the interval is not safely known", () => {
    expect(parseOemOilIntervalFromText("Ražotāja intervāls: nav droši zināms")).toBeNull();
    expect(parseOemOilIntervalFromText("Eļļa mainīta ik 20 000 km.")).toBeNull();
  });
});

describe("oilRatioTone", () => {
  it("is green at or under OEM, orange to 1.30x, red above, and neutral without OEM", () => {
    expect(oilRatioTone(29_800, 30_000)).toBe("ok");
    expect(oilRatioTone(31_500, 30_000)).toBe("ok");
    expect(oilRatioTone(36_000, 30_000)).toBe("warn");
    expect(oilRatioTone(40_000, 30_000)).toBe("stretch");
    expect(oilRatioTone(22_000, 15_000)).toBe("stretch");
    expect(oilRatioTone(29_800, null)).toBe("neutral");
  });
});
