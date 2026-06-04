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

  const validEmail = "klients@example.com";
  const validPhone = "+37120000000";

  it("requires email and phone before checkout", () => {
    const r = validateTestPricingCheckout(miniPlan, "", "", validListing, "", true);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.email).toBeTruthy();
      expect(r.errors.phone).toBeTruthy();
    }
  });

  it("requires listing URL", () => {
    const r = validateTestPricingCheckout(
      miniPlan,
      validEmail,
      validPhone,
      "",
      "",
      true,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.listingUrl).toBeTruthy();
  });

  it("allows optional VIN on mini", () => {
    const r = validateTestPricingCheckout(
      miniPlan,
      validEmail,
      validPhone,
      validListing,
      "",
      true,
    );
    expect(r.ok).toBe(true);
  });

  it("requires VIN on premium", () => {
    const r = validateTestPricingCheckout(
      premiumPlan,
      validEmail,
      validPhone,
      validListing,
      "",
      true,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.vin).toBeTruthy();
  });
});
