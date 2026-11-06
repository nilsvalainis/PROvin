import { describe, expect, it } from "vitest";
import {
  normalizeLossAmountEurDisplay,
  parseLossAmountEurBounds,
  parseQualifiedLossAmount,
  roundLossAmountEurDisplayToTens,
} from "@/lib/loss-amount-format";

describe("normalizeLossAmountEurDisplay", () => {
  it("normalizes EUR suffix variants", () => {
    expect(normalizeLossAmountEurDisplay("2930.00 EUR")).toBe("2 930,00 €");
    expect(normalizeLossAmountEurDisplay("5001€")).toBe("5 001 €");
  });

  it("normalizes spaced thousands", () => {
    expect(normalizeLossAmountEurDisplay("12 500,00 €")).toBe("12 500,00 €");
  });

  it("preserves free-text when not a parseable amount", () => {
    expect(normalizeLossAmountEurDisplay("nav datu")).toBe("nav datu");
    expect(normalizeLossAmountEurDisplay("  apstrīdēts  ")).toBe("apstrīdēts");
  });

  it("preserves incident data-unavailable sentinel", () => {
    expect(normalizeLossAmountEurDisplay("Dati nav pieejami")).toBe("Dati nav pieejami");
  });

  it("formats EUR ranges", () => {
    expect(normalizeLossAmountEurDisplay("300 - 400 EUR")).toBe("300 - 400 €");
    expect(normalizeLossAmountEurDisplay("40 000 - 41 000 EUR")).toBe("40 000 - 41 000 €");
    expect(normalizeLossAmountEurDisplay("1001\u00a0€ – 1500\u00a0€")).toBe("1 001 - 1 500 €");
  });

  it("does not concatenate range digits when a text note is appended", () => {
    expect(normalizeLossAmountEurDisplay("1 001 - 1 500 €; Zādzība")).toBe("1 001 - 1 500 €; Zādzība");
    expect(parseLossAmountEurBounds("1 001 - 1 500 €; Zādzība")).toEqual({ lo: 1001, hi: 1500 });
  });
});

describe("parseLossAmountEurBounds", () => {
  it("rejects digit soup that would become a fake mega-amount", () => {
    expect(parseLossAmountEurBounds("1001 1500")).toBeNull();
  });
});

describe("roundLossAmountEurDisplayToTens", () => {
  it("rounds a plain grouped amount to the nearest 10 EUR", () => {
    expect(roundLossAmountEurDisplayToTens("2 847 €")).toBe("2 850 €");
    expect(roundLossAmountEurDisplayToTens("5001 €")).toBe("5 000 €");
  });

  it("rounds amounts with cents to the nearest 10 EUR", () => {
    expect(roundLossAmountEurDisplayToTens("2 778,22 €")).toBe("2 780 €");
  });

  it("leaves already-round amounts unchanged", () => {
    expect(roundLossAmountEurDisplayToTens("2 800 €")).toBe("2 800 €");
  });

  it("rounds both bounds of a range", () => {
    expect(roundLossAmountEurDisplayToTens("1 001 - 1 500 €")).toBe("1 000 - 1 500 €");
  });

  it("preserves a trailing free-text note after a range", () => {
    expect(roundLossAmountEurDisplayToTens("1 001 - 1 500 €; Zādzība")).toBe(
      "1 000 - 1 500 €; Zādzība",
    );
  });

  it("leaves free text and unavailable-data sentinels unchanged", () => {
    expect(roundLossAmountEurDisplayToTens("apstrīdēts")).toBe("apstrīdēts");
    expect(roundLossAmountEurDisplayToTens("Dati nav pieejami")).toBe("Dati nav pieejami");
    expect(roundLossAmountEurDisplayToTens("")).toBe("");
  });

  it("rounds near-zero amounts to 0 €", () => {
    expect(roundLossAmountEurDisplayToTens("4 €")).toBe("0 €");
  });
});

describe("aptuvenas summas ar >, <, ~ prefiksu", () => {
  it("„>4000,00 €” (reāls avota teksts) kļūst par „virs 4 000 €”, nevis paliek neapstrādāts", () => {
    expect(normalizeLossAmountEurDisplay(">4000,00 €")).toBe("virs 4 000 €");
    expect(normalizeLossAmountEurDisplay("> 4 000,50 EUR")).toBe("virs 4 000 €");
    expect(roundLossAmountEurDisplayToTens(">4000,00 €")).toBe("virs 4 000 €");
  });

  it("„<” un „<=” -> „līdz”, „~” -> „ap”, „>=” -> „no”", () => {
    expect(normalizeLossAmountEurDisplay("<500 EUR")).toBe("līdz 500 €");
    expect(normalizeLossAmountEurDisplay("<= 1500 €")).toBe("līdz 1 500 €");
    expect(normalizeLossAmountEurDisplay("~1200 €")).toBe("ap 1 200 €");
    expect(normalizeLossAmountEurDisplay(">= 4000 €")).toBe("no 4 000 €");
    expect(roundLossAmountEurDisplayToTens("~1234 €")).toBe("ap 1 230 €");
  });

  it("diapazons ar prefiksu saglabā to pašu „1 000 - 2 000 €” formu", () => {
    expect(normalizeLossAmountEurDisplay("~1000-2000 €")).toBe("ap 1 000 - 2 000 €");
  });

  it("ir idempotents (admin lauks formatē jau formatētu vērtību) un strādā ar teksta piezīmi", () => {
    expect(normalizeLossAmountEurDisplay("virs 4 000 €")).toBe("virs 4 000 €");
    expect(normalizeLossAmountEurDisplay("līdz 500 €")).toBe("līdz 500 €");
    expect(normalizeLossAmountEurDisplay(">4000,00 €; Zādzība")).toBe("virs 4 000 €; Zādzība");
  });

  it("robežas salīdzināšanai ņem bez prefiksa", () => {
    expect(parseLossAmountEurBounds(">4000,00 €")).toEqual({ lo: 4000, hi: 4000 });
    expect(parseQualifiedLossAmount("virs 4 000 €")).toEqual({ word: "virs", bounds: { lo: 4000, hi: 4000 } });
    expect(parseQualifiedLossAmount("4 000 €")).toBeNull();
    expect(roundLossAmountEurDisplayToTens("virs 4 005 €")).toBe("virs 4 010 €");
  });

  it("brīvu tekstu, kas sākas ar līdzīgu vārdu, neaiztiek", () => {
    expect(normalizeLossAmountEurDisplay("apstrīdēts")).toBe("apstrīdēts");
    expect(normalizeLossAmountEurDisplay("ap")).toBe("ap");
  });
});
