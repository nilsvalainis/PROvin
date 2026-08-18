import { describe, expect, it } from "vitest";

import {
  isSafeNotifyOrderId,
  isSafeStripeCheckoutSessionId,
  notifyPortfolioPathPrefix,
} from "@/lib/admin-notify-blob-constants";

describe("notify portfolio Blob order ids", () => {
  it("accepts Stripe, demo and manual order ids", () => {
    expect(isSafeNotifyOrderId("cs_test_a1b2c3d4e5")).toBe(true);
    expect(isSafeNotifyOrderId("demo_order_exp_1")).toBe(true);
    expect(isSafeNotifyOrderId("manual_order_123_abc")).toBe(true);
    expect(isSafeNotifyOrderId("../../etc/passwd")).toBe(false);
    expect(isSafeNotifyOrderId("cs_a")).toBe(false);
  });

  it("keeps the Stripe helper aligned with notify ids", () => {
    expect(isSafeStripeCheckoutSessionId("manual_order_123_abc")).toBe(true);
  });

  it("builds a pathname prefix from the order id", () => {
    expect(notifyPortfolioPathPrefix(" manual_order_1 ")).toBe("admin-notify-portfolio/manual_order_1");
  });
});
