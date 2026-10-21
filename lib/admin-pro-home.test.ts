import { describe, expect, it } from "vitest";
import { summarizeProHome } from "@/lib/admin-pro-home";

describe("PRO sākuma paziņojumi", () => {
  it("splits dealers from MINI/audits, counts overdue and keeps the nearest not-yet-overdue deadline", () => {
    const now = Date.parse("2026-10-21T12:00:00Z");
    const h = 3600;
    const nowS = now / 1000;
    const s = summarizeProHome(
      [
        { created: nowS - 60 * h, checkoutLine: "audit", amountTotalCents: 9999 },
        { created: nowS - 30 * h, checkoutLine: "mini", amountTotalCents: 3999 },
        { created: nowS - 10 * h, checkoutLine: "audit", amountTotalCents: 9999 },
        { created: nowS - 5 * h, checkoutLine: "dealer", amountTotalCents: 1500 },
        { created: nowS - 1 * h, checkoutLine: "audit", amountTotalCents: 9999, auditComplete: true },
        { created: nowS - 1 * h, checkoutLine: "business", isB2bPack: true },
      ],
      now,
    );
    expect(s.orders).toEqual({ count: 3, overdue: 1, nextDeadlineFromUnix: nowS - 30 * h });
    expect(s.dealers).toEqual({ count: 1, overdue: 0, nextDeadlineFromUnix: nowS - 5 * h });
  });
});
