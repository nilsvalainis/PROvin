import { describe, expect, it } from "vitest";

import {
  newVendorPurchaseDone,
  newVendorPurchasePending,
  parseVendorPurchaseLockEntry,
  vendorPurchaseLockDecision,
  VENDOR_PURCHASE_STALE_MS,
} from "@/lib/vendor-purchase-lock";

describe("vendorPurchaseLockDecision", () => {
  const now = Date.parse("2026-10-20T12:00:00.000Z");

  it("begins when there is no entry", () => {
    expect(vendorPurchaseLockDecision(null, now)).toBe("begin");
  });

  it("replays a completed purchase instead of buying again", () => {
    const done = newVendorPurchaseDone({ now, ok: true, payload: { historyType: 1 } });
    expect(vendorPurchaseLockDecision(done, now + 1000)).toBe("replay");
  });

  it("blocks a second in-flight purchase", () => {
    const pending = newVendorPurchasePending(now);
    expect(vendorPurchaseLockDecision(pending, now + 1000)).toBe("in_progress");
  });

  it("reclaims a stale pending lock so a crashed buy can retry", () => {
    const pending = newVendorPurchasePending(now - VENDOR_PURCHASE_STALE_MS - 1);
    expect(vendorPurchaseLockDecision(pending, now)).toBe("reclaim");
  });

  it("parses a stored entry", () => {
    expect(
      parseVendorPurchaseLockEntry({
        status: "done",
        claimedAt: "2026-10-20T12:00:00.000Z",
        ok: true,
        payload: { id: "1" },
      }),
    ).toMatchObject({ status: "done", ok: true });
    expect(parseVendorPurchaseLockEntry({ status: "done" })).toBeNull();
  });
});

