import { describe, expect, it } from "vitest";
import { formatPdfOdometerDisplay, isPdfEmptyPlaceholder } from "@/lib/pdf-odometer-display";

describe("formatPdfOdometerDisplay", () => {
  it("groups thousands with a regular space", () => {
    expect(formatPdfOdometerDisplay("305048", true)).toBe("305 048 km");
    expect(formatPdfOdometerDisplay("160718")).toBe("160 718");
    expect(formatPdfOdometerDisplay("120000 km", true)).toBe("120 000 km");
  });
});

describe("isPdfEmptyPlaceholder", () => {
  it("treats Nav ierakstu and km nav as empty", () => {
    expect(isPdfEmptyPlaceholder("Nav ierakstu")).toBe(true);
    expect(isPdfEmptyPlaceholder("km nav")).toBe(true);
    expect(isPdfEmptyPlaceholder("4")).toBe(false);
  });
});
