import { describe, expect, it } from "vitest";
import {
  isSafeUnpaidPaymentToken,
  isUnpaidPaymentPath,
  stripeCheckoutExpiresAtUnix,
  unpaidPaymentAbsoluteUrl,
  unpaidPaymentPublicPath,
  unpaidReminderOrderUrl,
} from "@/lib/admin-unpaid-payment-link";

describe("unpaid payment short link", () => {
  it("matches /apmaksa and token paths", () => {
    expect(isUnpaidPaymentPath("/apmaksa")).toBe(true);
    expect(isUnpaidPaymentPath("/apmaksa/abc")).toBe(true);
    expect(isUnpaidPaymentPath("/apmaksas")).toBe(false);
    expect(isUnpaidPaymentPath("/lv/apmaksa/abc")).toBe(false);
  });

  it("builds origin url", () => {
    expect(unpaidPaymentPublicPath("tok")).toBe("/apmaksa/tok");
    expect(unpaidPaymentAbsoluteUrl("https://www.provin.lv/", "tok")).toBe("https://www.provin.lv/apmaksa/tok");
  });

  it("accepts url-safe tokens", () => {
    expect(isSafeUnpaidPaymentToken("abcdefghij0123456789")).toBe(true);
    expect(isSafeUnpaidPaymentToken("short")).toBe(false);
  });

  it("caps Stripe expiry under 24 h", () => {
    const now = Date.parse("2026-10-19T12:00:00.000Z");
    const exp = stripeCheckoutExpiresAtUnix(now);
    expect(exp - Math.floor(now / 1000)).toBeLessThanOrEqual(24 * 3600);
    expect(exp - Math.floor(now / 1000)).toBeGreaterThan(23 * 3600);
  });

  it("builds a new /lv/pasutit order url, not a Stripe checkout session", () => {
    expect(unpaidReminderOrderUrl("WVWZZZ1KZAW000123", "https://www.provin.lv")).toBe(
      "https://www.provin.lv/lv/pasutit?vin=WVWZZZ1KZAW000123",
    );
    expect(unpaidReminderOrderUrl("", "https://www.provin.lv")).toBe("https://www.provin.lv/lv/pasutit");
  });
});
