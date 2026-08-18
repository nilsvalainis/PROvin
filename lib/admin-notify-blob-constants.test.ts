import { describe, expect, it } from "vitest";
import {
  isSafeStripeCheckoutSessionId,
  notifyPortfolioPathPrefix,
} from "@/lib/admin-notify-blob-constants";

describe("notify portfolio Blob session ids", () => {
  it("accepts Stripe checkout ids", () => {
    expect(isSafeStripeCheckoutSessionId("cs_test_a1b2c3d4e5")).toBe(true);
  });

  it("accepts manual orders so client notify can upload portfolio", () => {
    expect(isSafeStripeCheckoutSessionId("manual_order_123_abc")).toBe(true);
    expect(notifyPortfolioPathPrefix("manual_order_123_abc")).toBe(
      "admin-notify-portfolio/manual_order_123_abc",
    );
  });

  it("rejects path traversal", () => {
    expect(isSafeStripeCheckoutSessionId("../../etc/passwd")).toBe(false);
  });
});
