import { describe, expect, it } from "vitest";
import { accumulateB2bWalletStats, formatB2bAdminNoDataRate } from "@/lib/b2b-admin-stats";
import { applyB2bWalletPurchase, applyB2bWalletRefund, applyB2bWalletTopup, emptyB2bWallet } from "@/lib/b2b-wallet";

describe("B2B admin stats", () => {
  it("counts revenue, orders and no-data rate per partner, product and month", () => {
    const wallet = applyB2bWalletTopup(emptyB2bWallet(), {
      amountCents: 20_000,
      sessionId: "cs_s",
      now: new Date("2026-10-02T10:00:00.000Z"),
    }).wallet;
    const a = applyB2bWalletPurchase(wallet, {
      product: "dealer_raw",
      priceCents: 1500,
      idempotencyKey: "k1",
      vin: "WVWZZZ3HZHE703058",
      now: new Date("2026-10-03T10:00:00.000Z"),
    });
    if (!a.ok) throw new Error("buy");
    const b = applyB2bWalletPurchase(a.wallet, {
      product: "dealer_raw",
      priceCents: 1500,
      idempotencyKey: "k2",
      vin: "WBA8E9C50GK123456",
      now: new Date("2026-10-04T10:00:00.000Z"),
    });
    if (!b.ok) throw new Error("buy");
    const refunded = applyB2bWalletRefund(b.wallet, { purchaseTxnId: a.txn.id, now: new Date("2026-10-05T10:00:00.000Z") });
    const rows = accumulateB2bWalletStats([{ id: "ptr_1", companyName: "Salons", wallet: refunded.wallet }]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      month: "2026-10",
      partnerId: "ptr_1",
      product: "dealer_raw",
      orderCount: 2,
      refundCount: 1,
      revenueCents: 1500,
    });
    expect(rows[0]?.noDataRate).toBe(0.5);
    expect(formatB2bAdminNoDataRate(0.5)).toBe("50%");
  });
});
