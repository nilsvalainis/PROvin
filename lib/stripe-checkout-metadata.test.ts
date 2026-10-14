import { describe, expect, it } from "vitest";

import {
  stripeCheckoutLineFromPlanId,
  stripeCheckoutProductMetadata,
  stripeProductTierFromPlanId,
} from "@/lib/stripe-checkout-metadata";
import { TP5_MOBILE_CHECKOUT_PLAN } from "@/lib/test-pricing-5-mobile";

describe("stripeCheckoutProductMetadata", () => {
  it("homepage MINI (internal plan plus) writes mini, not plus", () => {
    expect(TP5_MOBILE_CHECKOUT_PLAN.mini).toBe("plus");
    expect(stripeProductTierFromPlanId("plus")).toBe("mini");
    expect(stripeCheckoutLineFromPlanId("plus")).toBe("mini");
    expect(stripeCheckoutProductMetadata("plus")).toEqual({
      checkout_line: "mini",
      product_tier: "mini",
    });
  });

  it("maps each active public product to the canonical tier", () => {
    expect(stripeCheckoutProductMetadata("plus")).toEqual({ checkout_line: "mini", product_tier: "mini" });
    expect(stripeCheckoutProductMetadata("mini")).toEqual({ checkout_line: "mini", product_tier: "mini" });
    expect(stripeCheckoutProductMetadata("premium")).toEqual({
      checkout_line: "premium",
      product_tier: "audits",
    });
    expect(stripeCheckoutProductMetadata("dealer")).toEqual({
      checkout_line: "dealer",
      product_tier: "dealer",
    });
  });

  it("keeps koreaUsa as its own catalog id", () => {
    expect(stripeCheckoutProductMetadata("koreaUsa")).toEqual({
      checkout_line: "koreaUsa",
      product_tier: "koreaUsa",
    });
  });
});
