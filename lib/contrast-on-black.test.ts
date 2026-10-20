import { describe, expect, it } from "vitest";
import {
  ACCENT_ON_BLACK_HEX,
  BRAND_ACCENT_HEX,
  contrastRatio,
  meetsWcagAaText,
} from "./contrast-on-black";

describe("accent contrast on black", () => {
  it("brand #0066FF on black misses 4.5:1", () => {
    expect(contrastRatio(BRAND_ACCENT_HEX, "#000000")).toBeLessThan(4.5);
    expect(meetsWcagAaText(BRAND_ACCENT_HEX, "#000000")).toBe(false);
  });

  it("proposal #3D8BFF on black meets 4.5:1", () => {
    expect(contrastRatio(ACCENT_ON_BLACK_HEX, "#000000")).toBeGreaterThanOrEqual(4.5);
    expect(meetsWcagAaText(ACCENT_ON_BLACK_HEX, "#000000")).toBe(true);
  });

  it("filled brand button (white on #0066FF) still meets 4.5:1", () => {
    expect(meetsWcagAaText("#FFFFFF", BRAND_ACCENT_HEX)).toBe(true);
  });
});
