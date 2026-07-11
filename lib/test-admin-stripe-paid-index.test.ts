import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  shouldRefreshStripePaidIndexInBackground,
  shouldRefreshStripePaidIndexSync,
  stripePaidIndexAgeMs,
} from "@/lib/admin-stripe-paid-index";

describe("admin-stripe-paid-index refresh policy", () => {
  it("treats missing index as sync refresh required", () => {
    expect(shouldRefreshStripePaidIndexSync(null)).toBe(true);
    expect(shouldRefreshStripePaidIndexInBackground(null)).toBe(false);
  });

  it("uses soft TTL for background refresh only", () => {
    const doc = {
      version: 1 as const,
      updatedAt: new Date(Date.now() - 400_000).toISOString(),
      rows: [{ id: "cs_1", created: 1, amountTotal: 100, currency: "EUR", paymentStatus: "paid" as const, customerEmail: null, vin: null }],
    };
    expect(stripePaidIndexAgeMs(doc)).toBeGreaterThan(300_000);
    expect(shouldRefreshStripePaidIndexSync(doc)).toBe(false);
    expect(shouldRefreshStripePaidIndexInBackground(doc)).toBe(true);
  });
});
