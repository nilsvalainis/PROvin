import { describe, expect, it } from "vitest";
import { isUpsellSettledByStripeSession } from "@/lib/order-upsell";

describe("isUpsellSettledByStripeSession", () => {
  it("first payment of an open offer", () => {
    expect(isUpsellSettledByStripeSession({ status: "open" }, "cs_1")).toBe(true);
  });

  it("webhook retry for the same Stripe session after a partial failure", () => {
    expect(isUpsellSettledByStripeSession({ status: "paid", stripeSessionId: "cs_1" }, "cs_1")).toBe(true);
  });

  it("extra payment on an offer settled by another session", () => {
    expect(isUpsellSettledByStripeSession({ status: "paid", stripeSessionId: "cs_1" }, "cs_2")).toBe(false);
  });

  it("offer marked manual without a Stripe session", () => {
    expect(isUpsellSettledByStripeSession({ status: "manual" }, "cs_2")).toBe(false);
  });
});
