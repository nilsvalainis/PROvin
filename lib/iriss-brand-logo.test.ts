import { describe, expect, it } from "vitest";
import {
  irissBrandFallbackLabel,
  irissBrandLogoSrc,
  irissBrandMarksForTitle,
} from "@/lib/iriss-brand-logo";

describe("irissBrandMarksForTitle", () => {
  it("returns one slug from a normal title", () => {
    expect(irissBrandMarksForTitle("Mercedes-Benz Sprinter H2L4")).toEqual(["mercedes"]);
    expect(irissBrandLogoSrc("Mercedes-Benz Sprinter H2L4")).toBe("/brand-logos/mercedes.svg");
  });

  it("returns two slugs for Lexus / Toyota titles", () => {
    expect(irissBrandMarksForTitle("LEXUS/TOYOTA extra long")).toEqual(["lexus", "toyota"]);
    expect(irissBrandMarksForTitle("Lexus / Toyota")).toEqual(["lexus", "toyota"]);
  });

  it("falls back to a two-letter monogram when the mark is unknown", () => {
    expect(irissBrandMarksForTitle("Nussbaum 412")).toEqual([]);
    expect(irissBrandFallbackLabel("Nussbaum 412")).toBe("NU");
  });
});
