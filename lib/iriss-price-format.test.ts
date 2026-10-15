import { describe, expect, it } from "vitest";
import { irissPriceFormatWarning, irissPriceLooksNumeric, parsePriceLike } from "@/lib/iriss-price-format";

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

describe("parsePriceLike", () => {
  it("reads European thousands with a decimal comma", () => {
    expect(parsePriceLike("1.234,56")).toBe(1234.56);
    expect(parsePriceLike("15.000,50")).toBe(15000.5);
  });

  it("reads a leading euro sign and spaces", () => {
    expect(parsePriceLike("€ 12 500")).toBe(12500);
    expect(parsePriceLike("12 500 €")).toBe(12500);
    expect(parsePriceLike("EUR 990,00")).toBe(990);
  });

  it("treats grouped thousands without a decimal tail as thousands", () => {
    expect(parsePriceLike("1.234")).toBe(1234);
    expect(parsePriceLike("15.000")).toBe(15000);
    expect(parsePriceLike("1,234.56")).toBe(1234.56);
  });

  it("keeps a short decimal tail", () => {
    expect(parsePriceLike("12,5")).toBe(12.5);
    expect(parsePriceLike("12.50")).toBe(12.5);
    expect(parsePriceLike("15000")).toBe(15000);
  });

  it("returns 0 when there is no number", () => {
    expect(parsePriceLike("")).toBe(0);
    expect(parsePriceLike("€")).toBe(0);
    expect(parsePriceLike("nav")).toBe(0);
  });
});
