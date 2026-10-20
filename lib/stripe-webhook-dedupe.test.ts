import { describe, expect, it } from "vitest";

import {
  newStripeDedupeClaim,
  parseStripeDedupeRecord,
  stripeDedupeBlobKey,
  stripeDedupeDecision,
  stripeShouldSendMetaPurchase,
  STRIPE_DEDUPE_DONE_MAX_AGE_MS,
  STRIPE_DEDUPE_STALE_CLAIM_MS,
} from "@/lib/stripe-webhook-dedupe";

describe("stripe webhook dedupe decision", () => {
  const now = 1_700_000_000_000;

  it("starts when nothing is stored", () => {
    expect(stripeDedupeDecision(null, now)).toBe("begin");
  });

  it("treats a fresh claim and a done record as duplicates", () => {
    const claimed = newStripeDedupeClaim("evt_1", now - 1_000, "claimed");
    const done = newStripeDedupeClaim("evt_1", now - 60_000, "done");
    expect(stripeDedupeDecision(claimed, now)).toBe("duplicate");
    expect(stripeDedupeDecision(done, now)).toBe("duplicate");
  });

  it("reclaims a stuck pending claim after the stale window", () => {
    const stuck = newStripeDedupeClaim("evt_1", now - STRIPE_DEDUPE_STALE_CLAIM_MS - 1, "claimed");
    expect(stripeDedupeDecision(stuck, now)).toBe("reclaim");
  });

  it("allows a new begin after the done TTL", () => {
    const old = newStripeDedupeClaim("evt_1", now - STRIPE_DEDUPE_DONE_MAX_AGE_MS - 1, "done");
    expect(stripeDedupeDecision(old, now)).toBe("begin");
  });

  it("sanitizes event ids for Blob keys", () => {
    expect(stripeDedupeBlobKey("fulfill:cs_test_abc")).toBe("fulfill_cs_test_abc");
    expect(stripeDedupeBlobKey("evt_1ABC")).toBe("evt_1ABC");
  });

  it("parses stored records", () => {
    expect(parseStripeDedupeRecord({ status: "done", claimedAt: now, eventId: "evt_1" })).toEqual({
      status: "done",
      claimedAt: now,
      eventId: "evt_1",
    });
    expect(parseStripeDedupeRecord({ status: "claimed", claimedAt: "not-a-date", eventId: "evt_1" })).toBeNull();
  });
});

describe("stripeShouldSendMetaPurchase", () => {
  it("sends Purchase only after the session dedupe is acquired", () => {
    expect(stripeShouldSendMetaPurchase({ paymentStatus: "paid", sessionDedupeAcquired: true })).toBe(true);
    expect(stripeShouldSendMetaPurchase({ paymentStatus: "paid", sessionDedupeAcquired: false })).toBe(false);
    expect(stripeShouldSendMetaPurchase({ paymentStatus: "unpaid", sessionDedupeAcquired: true })).toBe(false);
  });
});
