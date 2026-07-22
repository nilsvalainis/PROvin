import { describe, expect, it } from "vitest";
import {
  canNotifyClientOrder,
  isManualNotifyClientOrder,
  notifyClientBlockedMessage,
} from "@/lib/admin-notify-client-eligibility";

describe("admin-notify-client-eligibility", () => {
  it("allows paid orders with valid email", () => {
    expect(
      canNotifyClientOrder(
        { id: "cs_test_1", paymentStatus: "paid", customerEmail: "a@example.com" },
      ),
    ).toBe(true);
  });

  it("allows manual unpaid orders with valid email", () => {
    expect(
      canNotifyClientOrder(
        {
          id: "manual_order_123_abc",
          paymentStatus: "unpaid",
          isManual: true,
          customerEmail: "a@example.com",
        },
      ),
    ).toBe(true);
  });

  it("blocks unpaid stripe orders", () => {
    expect(
      canNotifyClientOrder(
        { id: "cs_test_1", paymentStatus: "unpaid", customerEmail: "a@example.com" },
      ),
    ).toBe(false);
  });

  it("blocks manual orders without email", () => {
    expect(
      canNotifyClientOrder({
        id: "manual_order_123_abc",
        paymentStatus: "unpaid",
        isManual: true,
        customerEmail: null,
      }),
    ).toBe(false);
  });

  it("detects manual ids without isManual flag", () => {
    expect(isManualNotifyClientOrder({ id: "manual_order_123_abc" })).toBe(true);
  });

  it("returns manual-specific blocked message when email missing", () => {
    expect(
      notifyClientBlockedMessage({
        id: "manual_order_123_abc",
        paymentStatus: "unpaid",
        isManual: true,
        customerEmail: "",
      }),
    ).toContain("e-pasts");
  });
});
