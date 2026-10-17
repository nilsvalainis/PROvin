import { describe, expect, it, vi } from "vitest";
import { resolveThanksPageConversion } from "./google-ads-thanks-conversion";

describe("resolveThanksPageConversion", () => {
  it("renders conversion only for a paid session with its real value", async () => {
    const getPaidValueEur = vi.fn().mockResolvedValue(24.99);
    await expect(
      resolveThanksPageConversion({ sessionId: "cs_live_abc", label: "LBL1", getPaidValueEur }),
    ).resolves.toEqual({ transactionId: "cs_live_abc", value: 24.99, label: "LBL1" });
    expect(getPaidValueEur).toHaveBeenCalledWith("cs_live_abc");
  });

  it("returns null for unpaid / invalid / fake sessions (no value-0 conversion)", async () => {
    const getPaidValueEur = vi.fn().mockResolvedValue(null);
    await expect(
      resolveThanksPageConversion({ sessionId: "cs_test_FAKE123", label: "LBL1", getPaidValueEur }),
    ).resolves.toBeNull();
    await expect(
      resolveThanksPageConversion({ sessionId: "garbage", label: "LBL1", getPaidValueEur }),
    ).resolves.toBeNull();
  });

  it("returns null for zero/negative values", async () => {
    for (const v of [0, -1, Number.NaN]) {
      await expect(
        resolveThanksPageConversion({ sessionId: "cs_x", label: "LBL1", getPaidValueEur: async () => v }),
      ).resolves.toBeNull();
    }
  });

  it("does not call Stripe without session id or label", async () => {
    const getPaidValueEur = vi.fn().mockResolvedValue(10);
    expect(await resolveThanksPageConversion({ sessionId: undefined, label: "LBL1", getPaidValueEur })).toBeNull();
    expect(await resolveThanksPageConversion({ sessionId: "cs_x", label: null, getPaidValueEur })).toBeNull();
    expect(getPaidValueEur).not.toHaveBeenCalled();
  });
});
