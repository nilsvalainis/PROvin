import { describe, expect, it } from "vitest";
import { getTestPricingPlan, validateTestPricingCheckout } from "@/lib/test-pricing-plans";

describe("validateTestPricingCheckout", () => {
  const listingPlan = getTestPricingPlan("listing_filter")!;
  const miniPlan = getTestPricingPlan("mini")!;

  it("requires listing URL for all plans", () => {
    const r = validateTestPricingCheckout(listingPlan, "", "", true);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.listingUrl).toBeTruthy();
  });

  it("allows optional VIN on listing filter", () => {
    const r = validateTestPricingCheckout(
      listingPlan,
      "https://www.ss.lv/transport/cars/bmw/5-series/sell/",
      "",
      true,
    );
    expect(r.ok).toBe(true);
  });

  it("requires VIN on mini", () => {
    const r = validateTestPricingCheckout(
      miniPlan,
      "https://www.ss.lv/transport/cars/bmw/5-series/sell/",
      "",
      true,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.vin).toBeTruthy();
  });
});
