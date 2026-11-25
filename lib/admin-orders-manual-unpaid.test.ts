import { describe, expect, it } from "vitest";
import { isManualUnpaidAdminOrder } from "@/lib/admin-orders-manual-unpaid";

describe("isManualUnpaidAdminOrder", () => {
  it("manuāls bez apmaksas - jā", () => {
    expect(isManualUnpaidAdminOrder({ isManual: true, paymentStatus: "unpaid" })).toBe(true);
  });

  it("manuāls pēc Stripe apmaksas - nē (izskatās kā pārējie)", () => {
    expect(isManualUnpaidAdminOrder({ isManual: true, paymentStatus: "paid" })).toBe(false);
    expect(isManualUnpaidAdminOrder({ isManual: true, paymentStatus: "PAID" })).toBe(false);
  });

  it("Stripe pasūtījums - nekad", () => {
    expect(isManualUnpaidAdminOrder({ paymentStatus: "unpaid" })).toBe(false);
    expect(isManualUnpaidAdminOrder({ isManual: false, paymentStatus: "unpaid" })).toBe(false);
  });

  it("partnera maka/kredīta manuālais darbs - nekad neapmaksāts", () => {
    expect(isManualUnpaidAdminOrder({ isManual: true, paymentStatus: "unpaid", partnerId: "ptr_0123456789abcdef" })).toBe(false);
    expect(isManualUnpaidAdminOrder({ isManual: true, paymentStatus: "unpaid", partnerCompanyName: "Auto SIA" })).toBe(false);
    expect(
      isManualUnpaidAdminOrder({ isManual: true, paymentStatus: "unpaid", notes: "B2B dealer · partner_id=ptr_0123456789abcdef" }),
    ).toBe(false);
  });
});
