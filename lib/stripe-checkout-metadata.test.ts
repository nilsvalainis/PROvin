import { describe, expect, it } from "vitest";

import {
  mergeStripeCheckoutMetadata,
  omitStripeServerMetadataKeys,
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

describe("mergeStripeCheckoutMetadata", () => {
  it("drops client fulfillment, partner_id and pack_qty even if they are last in the untrusted object", () => {
    const untrusted = {
      attr: "{\"v\":1}",
      fulfillment: "b2b_pack",
      partner_id: "ptr_aaaaaaaaaaaaaaaa",
      pack_qty: "50",
      checkout_line: "business",
      vin: "WVWZZZ1KZAW000001",
    };
    expect(omitStripeServerMetadataKeys(untrusted)).toEqual({
      attr: "{\"v\":1}",
      vin: "WVWZZZ1KZAW000001",
    });
    expect(
      mergeStripeCheckoutMetadata(untrusted, {
        checkout_line: "audit",
        vin: "WVWZZZ1KZAW000001",
      }),
    ).toEqual({
      attr: "{\"v\":1}",
      vin: "WVWZZZ1KZAW000001",
      checkout_line: "audit",
    });
  });

  it("server keys win when the same reserved key appears in both sides", () => {
    const merged = mergeStripeCheckoutMetadata(
      { fulfillment: "b2b_pack", partner_id: "ptr_bbbbbbbbbbbbbbbb", meta: "capi" },
      { fulfillment: "b2b_wallet_topup", partner_id: "ptr_cccccccccccccccc" },
    );
    expect(merged.fulfillment).toBe("b2b_wallet_topup");
    expect(merged.partner_id).toBe("ptr_cccccccccccccccc");
    expect(merged.meta).toBe("capi");
  });
});
