import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  mergePaidIndexAfterStripeRefresh,
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

  it("keeps a recent webhook upsert that Stripe scan missed", () => {
    const now = 1_800_000_000;
    const fromStripe = [
      {
        id: "cs_old",
        created: now - 86_400,
        amountTotal: 3999,
        currency: "EUR",
        paymentStatus: "paid" as const,
        customerEmail: null,
        vin: null,
      },
    ];
    const fromIndex = [
      {
        id: "cs_new",
        created: now - 30,
        amountTotal: 9999,
        currency: "EUR",
        paymentStatus: "paid" as const,
        customerEmail: "a@b.lv",
        vin: "W1K1186121N098109",
      },
    ];
    const merged = mergePaidIndexAfterStripeRefresh(fromStripe, fromIndex, now);
    expect(merged.map((r) => r.id)).toEqual(["cs_new", "cs_old"]);
  });

  it("does not keep an old index-only row forever", () => {
    const now = 1_800_000_000;
    const merged = mergePaidIndexAfterStripeRefresh(
      [],
      [
        {
          id: "cs_ancient",
          created: now - 3 * 24 * 60 * 60,
          amountTotal: 9999,
          currency: "EUR",
          paymentStatus: "paid",
          customerEmail: null,
          vin: null,
        },
      ],
      now,
    );
    expect(merged).toEqual([]);
  });
});
