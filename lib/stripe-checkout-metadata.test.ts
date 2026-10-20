import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  mergeStripeCheckoutMetadata,
  omitStripeServerMetadataKeys,
  stripeCheckoutLineFromPlanId,
  stripeCheckoutProductMetadata,
  stripeProductTierFromPlanId,
} from "@/lib/stripe-checkout-metadata";
import { B2B_WALLET_TOPUP_FULFILLMENT } from "@/lib/b2b-partner-orders";
import { TP5_MOBILE_CHECKOUT_PLAN } from "@/lib/test-pricing-5-mobile";

const ROOT = process.cwd();

function src(rel: string): string {
  return readFileSync(path.join(ROOT, rel), "utf8");
}

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

describe("stripe checkout / webhook call sites", () => {
  it("merges untrusted metadata under server keys on every checkout path", () => {
    const files = [
      "app/api/checkout/route.ts",
      "app/api/checkout/test-pricing/route.ts",
      "app/api/client-link/checkout/route.ts",
      "lib/order-upsell-checkout.ts",
      "app/api/checkout/partner/topup/route.ts",
    ];
    for (const rel of files) {
      expect(src(rel), rel).toContain("mergeStripeCheckoutMetadata");
    }
  });

  it("does not spread attribution or CAPI after the server checkout_line", () => {
    const audit = src("app/api/checkout/route.ts");
    expect(audit).not.toMatch(
      /checkout_line:\s*"audit"[\s\S]*\.\.\.stripeAttributionMetadataFromRequest/,
    );
    const tp = src("app/api/checkout/test-pricing/route.ts");
    expect(tp).not.toMatch(
      /stripeCheckoutProductMetadata\([\s\S]*\.\.\.stripeMetaCapiMetadataFromRequest/,
    );
  });

  it("keeps B2B top-up fulfillment server-set and pack checkout closed", () => {
    const topup = src("app/api/checkout/partner/topup/route.ts");
    expect(topup).toContain("B2B_WALLET_TOPUP_FULFILLMENT");
    expect(topup).toContain("mergeStripeCheckoutMetadata(null,");
    expect(B2B_WALLET_TOPUP_FULFILLMENT).not.toBe("b2b_pack");
    const packs = src("app/api/checkout/partner/route.ts");
    expect(packs).toContain("legacy_packs_closed");
    expect(packs).toContain("410");
  });

  it("sends Meta Purchase only after the session dedupe claim", () => {
    const webhook = src("app/api/webhooks/stripe/route.ts");
    const claim = webhook.indexOf("tryBeginStripeEvent(fulfillDedupeKey");
    const meta = webhook.indexOf("void notifyMetaPurchaseFromStripeSession(session)");
    expect(claim).toBeGreaterThan(-1);
    expect(meta).toBeGreaterThan(claim);
    expect(webhook).toContain("stripeShouldSendMetaPurchase");
  });
});
