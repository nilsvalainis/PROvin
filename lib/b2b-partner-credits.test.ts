import { describe, expect, it } from "vitest";
import {
  b2bCreditExpiresAt,
  debitB2bCredit,
  emptyB2bCreditWallet,
  grantB2bCredits,
  hasAnyB2bCredit,
  isLiveB2bCreditLot,
  parseB2bCreditLot,
  remainingB2bCredits,
  restoreB2bCredit,
  type B2bCreditLot,
} from "@/lib/b2b-partner-credits";

function lot(partial: Partial<B2bCreditLot> & Pick<B2bCreditLot, "sku" | "remaining" | "expiresAt">): B2bCreditLot {
  return {
    id: partial.id ?? "lot-1",
    purchasedAt: partial.purchasedAt ?? "2026-09-01T00:00:00.000Z",
    ...partial,
  };
}

describe("b2b partner credits", () => {
  it("counts remaining lots per sku and ignores expiry for now", () => {
    const now = new Date("2026-09-07T10:00:00.000Z");
    const remaining = remainingB2bCredits(
      [
        lot({ sku: "business", remaining: 2, expiresAt: "2026-12-01T00:00:00.000Z" }),
        lot({ sku: "business", remaining: 1, expiresAt: "2026-08-01T00:00:00.000Z" }),
        lot({ sku: "dealer", remaining: 3, expiresAt: "2026-10-01T00:00:00.000Z" }),
        lot({ sku: "dealer", remaining: 0, expiresAt: "2026-12-01T00:00:00.000Z" }),
      ],
      now,
    );
    expect(remaining).toEqual({ business: 3, dealer: 3 });
    expect(hasAnyB2bCredit(remaining)).toBe(true);
  });

  it("treats a lot as live while remaining is at least 1, even after expiresAt", () => {
    const expiresAt = "2026-09-07T10:00:00.000Z";
    const live = lot({ sku: "business", remaining: 1, expiresAt });
    expect(isLiveB2bCreditLot(live, new Date("2026-09-07T09:59:59.000Z"))).toBe(true);
    expect(isLiveB2bCreditLot(live, new Date(expiresAt))).toBe(true);
    expect(isLiveB2bCreditLot(lot({ sku: "business", remaining: 0, expiresAt }), new Date())).toBe(false);
  });

  it("adds 90 UTC days from purchase", () => {
    const bought = new Date("2026-09-07T12:00:00.000Z");
    expect(b2bCreditExpiresAt(bought).toISOString()).toBe("2026-12-06T12:00:00.000Z");
  });

  it("debits FIFO and restores onto the same lot", () => {
    const now = new Date("2026-09-14T10:00:00.000Z");
    let wallet = emptyB2bCreditWallet();
    wallet = grantB2bCredits(wallet, "dealer", 2, now);
    const firstId = wallet.lots[0]!.id;
    const debit = debitB2bCredit(wallet, "dealer", now);
    expect(debit.ok).toBe(true);
    if (!debit.ok) return;
    expect(debit.lotId).toBe(firstId);
    expect(remainingB2bCredits(debit.wallet.lots, now).dealer).toBe(1);
    const restored = restoreB2bCredit(debit.wallet, "dealer", debit.lotId, now);
    expect(remainingB2bCredits(restored.lots, now).dealer).toBe(2);
  });

  it("refuses debit when the sku is empty", () => {
    const now = new Date("2026-09-14T10:00:00.000Z");
    const wallet = grantB2bCredits(emptyB2bCreditWallet(), "business", 1, now);
    expect(debitB2bCredit(wallet, "dealer", now)).toEqual({ ok: false, reason: "no_credits" });
  });

  it("stamps Stripe session id and refuses a second grant", () => {
    const now = new Date("2026-09-14T10:00:00.000Z");
    const sessionId = "cs_test_b2bpackgrant1";
    const first = grantB2bCredits(emptyB2bCreditWallet(), "business", 10, now, sessionId);
    expect(first.lots[0]?.sourceSessionId).toBe(sessionId);
    expect(remainingB2bCredits(first.lots, now).business).toBe(10);
    const second = grantB2bCredits(first, "business", 10, now, sessionId);
    expect(second.lots).toHaveLength(1);
    expect(remainingB2bCredits(second.lots, now).business).toBe(10);
  });

  it("keeps sourceSessionId when parsing a wallet lot", () => {
    const parsed = parseB2bCreditLot({
      id: "lot_business_1",
      sku: "business",
      remaining: 10,
      purchasedAt: "2026-09-14T10:00:00.000Z",
      expiresAt: "2026-12-13T10:00:00.000Z",
      sourceSessionId: "cs_live_abc123",
    });
    expect(parsed?.sourceSessionId).toBe("cs_live_abc123");
  });
});
