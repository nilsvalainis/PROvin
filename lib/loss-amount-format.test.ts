import { describe, expect, it } from "vitest";
import { normalizeLossAmountEurDisplay } from "@/lib/loss-amount-format";

describe("normalizeLossAmountEurDisplay", () => {
  it("normalizes EUR suffix variants", () => {
    expect(normalizeLossAmountEurDisplay("2930.00 EUR")).toBe("2 930 €");
    expect(normalizeLossAmountEurDisplay("5001€")).toBe("5 001 €");
  });

  it("normalizes spaced thousands", () => {
    expect(normalizeLossAmountEurDisplay("12 500,00 €")).toBe("12 500 €");
  });

  it("returns empty for non-numeric", () => {
    expect(normalizeLossAmountEurDisplay("nav datu")).toBe("");
  });

  it("formats EUR ranges", () => {
    expect(normalizeLossAmountEurDisplay("300 - 400 EUR")).toBe("300 - 400 €");
    expect(normalizeLossAmountEurDisplay("40 000 - 41 000 EUR")).toBe("40 000 - 41 000 €");
  });
});
