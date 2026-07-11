import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

import {
  getCachedPaidCheckoutSessions,
  getStripeCheckoutSessionMeta,
  invalidateStripePaidListCache,
  invalidateStripeSessionCache,
} from "@/lib/admin-stripe-cache";

describe("admin-stripe-cache", () => {
  beforeEach(() => {
    invalidateStripePaidListCache();
    invalidateStripeSessionCache("cs_test_1");
  });

  it("deduplicates paid list fetches within TTL", async () => {
    const fetcher = vi.fn(async () => [{ id: "cs_test_1", created: 1, paymentStatus: "paid" as const, amountTotal: 100, currency: "EUR", customerEmail: null, vin: null }]);
    const a = await getCachedPaidCheckoutSessions(fetcher);
    const b = await getCachedPaidCheckoutSessions(fetcher);
    expect(a).toEqual(b);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("returns session meta from paid list cache without detail fetcher", async () => {
    await getCachedPaidCheckoutSessions(async () => [
      {
        id: "cs_test_1",
        created: 1,
        paymentStatus: "paid",
        amountTotal: 100,
        currency: "EUR",
        customerEmail: null,
        vin: null,
        checkoutLine: "audit",
        isDemo: false,
      },
    ]);
    const detailFetcher = vi.fn(async () => null);
    const meta = await getStripeCheckoutSessionMeta("cs_test_1", detailFetcher);
    expect(meta?.checkoutLine).toBe("audit");
    expect(detailFetcher).not.toHaveBeenCalled();
  });
});
