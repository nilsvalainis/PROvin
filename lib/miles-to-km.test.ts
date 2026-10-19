import { describe, expect, it } from "vitest";
import {
  MILES_TO_KM,
  formatKmGrouped,
  milesToKmGrouped,
  milesToKmRounded,
} from "@/lib/miles-to-km";
import { odometerToKmDisplay } from "@/lib/unified-mileage";

describe("milesToKmRounded", () => {
  it("uses 1.609344 and rounds to whole km", () => {
    expect(MILES_TO_KM).toBe(1.609344);
    expect(milesToKmRounded(1)).toBe(2);
    expect(milesToKmRounded(10000)).toBe(16093);
    expect(milesToKmRounded(40000)).toBe(64374);
    expect(milesToKmRounded(60000)).toBe(96561);
    expect(milesToKmRounded(80000)).toBe(128748);
    expect(milesToKmRounded(100000)).toBe(160934);
  });

  it("rejects non-positive input", () => {
    expect(milesToKmRounded(0)).toBe(0);
    expect(milesToKmRounded(-12)).toBe(0);
    expect(milesToKmRounded(Number.NaN)).toBe(0);
  });

  it("groups converted intervals the way facts.ts writes them", () => {
    expect(milesToKmGrouped(60000)).toBe("96 561");
    expect(milesToKmGrouped(80000)).toBe("128 748");
    expect(formatKmGrouped(96561)).toBe("96 561");
  });
});

describe("odometerToKmDisplay uses the shared helper", () => {
  it("converts mi / miles / mile labels and leaves km unchanged", () => {
    expect(odometerToKmDisplay("80,000", "mi")).toBe("128748");
    expect(odometerToKmDisplay("60000 miles", "miles")).toBe("96561");
    expect(odometerToKmDisplay("41874", "km")).toBe("41874");
    expect(odometerToKmDisplay("41874")).toBe("41874");
  });
});
