import { describe, expect, it } from "vitest";
import { getTestPricingPlan, validateTestPricingCheckout } from "@/lib/test-pricing-plans";

const validListing = "https://www.ss.lv/transport/cars/bmw/5-series/sell/";

describe("validateTestPricingCheckout", () => {
  const miniPlan = getTestPricingPlan("mini")!;
  const premiumPlan = getTestPricingPlan("premium")!;

  it("mini uses 2999 cents", () => {
    expect(miniPlan.amountCents).toBe(2999);
    expect(miniPlan.vinRequired).toBe(false);
  });

  it("requires listing URL", () => {
    const r = validateTestPricingCheckout(miniPlan, "", "", true);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.listingUrl).toBeTruthy();
  });

  it("allows optional VIN on mini", () => {
    const r = validateTestPricingCheckout(miniPlan, validListing, "", true);
    expect(r.ok).toBe(true);
  });

  it("requires VIN on premium", () => {
    const r = validateTestPricingCheckout(premiumPlan, validListing, "", true);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.vin).toBeTruthy();
  });
});
