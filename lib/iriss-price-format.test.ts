import { describe, expect, it } from "vitest";
import { irissPriceFormatWarning, irissPriceLooksNumeric } from "@/lib/iriss-price-format";

describe("irissPriceFormatWarning", () => {
  it("accepts empty and plain numbers", () => {
    expect(irissPriceFormatWarning("")).toBeNull();
    expect(irissPriceLooksNumeric("15000")).toBe(true);
    expect(irissPriceLooksNumeric("15000,50")).toBe(true);
    expect(irissPriceLooksNumeric("15 000")).toBe(true);
    expect(irissPriceLooksNumeric("15.000,50")).toBe(true);
    expect(irissPriceFormatWarning("12 500")).toBeNull();
  });

  it("warns on free-text prices that can leak into PDF", () => {
    expect(irissPriceFormatWarning("12k")).toContain("brīva teksta");
    expect(irissPriceFormatWarning("~15000")).toContain("brīva teksta");
    expect(irissPriceFormatWarning("ap 15 tūkst.")).toContain("brīva teksta");
  });
});
