import { beforeEach, describe, expect, it, vi } from "vitest";

const claims = new Map<string, "claimed" | "done">();

vi.mock("@/lib/stripe-webhook-dedupe-store", () => ({
  tryBeginStripeEvent: async (key: string) => {
    if (claims.has(key)) return false;
    claims.set(key, "claimed");
    return true;
  },
  releaseStripeEvent: async (key: string) => {
    if (claims.get(key) !== "done") claims.delete(key);
  },
  completeStripeEvent: async (key: string) => {
    claims.set(key, "done");
  },
}));

import { runStripeFulfillmentStepOnce, stripeFulfillmentStepKey } from "@/lib/stripe-webhook-step";

describe("runStripeFulfillmentStepOnce", () => {
  beforeEach(() => claims.clear());

  it("runs a step once per session across webhook retries", async () => {
    const fn = vi.fn(async () => {});
    expect(await runStripeFulfillmentStepOnce("notify", "cs_test_1", fn)).toBe("ran");
    expect(await runStripeFulfillmentStepOnce("notify", "cs_test_1", fn)).toBe("skipped");
    expect(fn).toHaveBeenCalledTimes(1);
    expect(claims.get(stripeFulfillmentStepKey("notify", "cs_test_1"))).toBe("done");
  });

  it("releases a failed step so the next Stripe retry runs it again", async () => {
    const failing = vi.fn(async () => {
      throw new Error("smtp_down");
    });
    await expect(runStripeFulfillmentStepOnce("customer-email", "cs_test_2", failing)).rejects.toThrow(
      "smtp_down",
    );
    const ok = vi.fn(async () => {});
    expect(await runStripeFulfillmentStepOnce("customer-email", "cs_test_2", ok)).toBe("ran");
    expect(ok).toHaveBeenCalledTimes(1);
  });

  it("keeps steps independent per session and per step", async () => {
    const fn = vi.fn(async () => {});
    await runStripeFulfillmentStepOnce("notify", "cs_a", fn);
    await runStripeFulfillmentStepOnce("downstream", "cs_a", fn);
    await runStripeFulfillmentStepOnce("notify", "cs_b", fn);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("produces dedupe-safe keys", () => {
    expect(stripeFulfillmentStepKey("customer-email", "cs_test_a1B2")).toBe("fulfill-customer-email:cs_test_a1B2");
  });
});
