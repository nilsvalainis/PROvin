import { describe, expect, it } from "vitest";
import { DEFAULT_LISTING_COSTS, listingExtrasI, listingFinalPrice } from "@/lib/iriss-listings-cost";
import {
  DEFAULT_OVER_BUDGET_THRESHOLD_EUR,
  listingCardTotal,
  listingExceedsBudgetBy,
  listingIsOverBudgetHidden,
  parseOverBudgetThreshold,
} from "@/lib/iriss-listings-over-budget";

const extras = DEFAULT_LISTING_COSTS;
const I = listingExtrasI(extras);

describe("over-budget filter", () => {
  it("defaults the threshold to 2000 € and clamps junk", () => {
    expect(DEFAULT_OVER_BUDGET_THRESHOLD_EUR).toBe(2000);
    expect(parseOverBudgetThreshold(undefined)).toBe(2000);
    expect(parseOverBudgetThreshold(-1)).toBe(2000);
    expect(parseOverBudgetThreshold("3500")).toBe(3500);
    expect(parseOverBudgetThreshold(0)).toBe(0);
  });

  it("uses the card total (price + I + PVN) against the client budget", () => {
    const v = {
      platform: "ecarstrade",
      priceCurrent: null,
      priceStart: null,
      priceBuyNow: 16200,
      taxDeduction: true,
      vatNote: "VAT deductible",
    };
    const total = listingCardTotal(v, extras);
    expect(total).toBe(listingFinalPrice({ kind: "net", rate: null }, 16200, I));
    expect(listingExceedsBudgetBy(total, 7500, 2000)).toBe(true);
    expect(listingExceedsBudgetBy(total, 28000, 2000)).toBe(false);
    expect(listingExceedsBudgetBy(total, null, 2000)).toBe(false);
    expect(listingExceedsBudgetBy(null, 7500, 2000)).toBe(false);
  });

  it("hides only when the filter is on and the overshoot is above the threshold", () => {
    const v = {
      platform: "auto1",
      priceCurrent: 10000,
      priceStart: 10000,
      priceBuyNow: null,
    };
    const budget = listingFinalPrice({ kind: "margin", rate: null }, 10000, I);
    expect(listingIsOverBudgetHidden(v, extras, { kind: "margin" }, budget, true, 2000)).toBe(false);
    expect(listingIsOverBudgetHidden(v, extras, { kind: "margin" }, budget - 2500, true, 2000)).toBe(true);
    expect(listingIsOverBudgetHidden(v, extras, { kind: "margin" }, budget - 2500, false, 2000)).toBe(false);
    expect(listingIsOverBudgetHidden(v, extras, { kind: "margin" }, budget - 1500, true, 2000)).toBe(false);
  });

  it("does not treat an 850 € floor as cheap enough to stay in budget", () => {
    const v = {
      platform: "ecarstrade",
      priceCurrent: 850,
      priceStart: 850,
      priceBuyNow: 16200,
      taxDeduction: true,
      vatNote: "VAT deductible",
    };
    const total = listingCardTotal(v, extras);
    expect(total).toBe(listingFinalPrice({ kind: "net", rate: null }, 16200, I));
    expect(listingIsOverBudgetHidden(v, extras, undefined, 8000, true, 2000)).toBe(true);
  });
});
