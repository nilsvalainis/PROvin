import { describe, expect, it } from "vitest";
import {
  b2bCreditExpiresAt,
  hasAnyB2bCredit,
  isLiveB2bCreditLot,
  remainingB2bCredits,
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
  it("counts only unexpired remaining lots per sku", () => {
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
    expect(remaining).toEqual({ business: 2, dealer: 3 });
    expect(hasAnyB2bCredit(remaining)).toBe(true);
  });

  it("treats a lot as dead on the expiry instant", () => {
    const expiresAt = "2026-09-07T10:00:00.000Z";
    const live = lot({ sku: "business", remaining: 1, expiresAt });
    expect(isLiveB2bCreditLot(live, new Date("2026-09-07T09:59:59.000Z"))).toBe(true);
    expect(isLiveB2bCreditLot(live, new Date(expiresAt))).toBe(false);
  });

  it("adds 90 UTC days from purchase", () => {
    const bought = new Date("2026-09-07T12:00:00.000Z");
    expect(b2bCreditExpiresAt(bought).toISOString()).toBe("2026-12-06T12:00:00.000Z");
  });
});
