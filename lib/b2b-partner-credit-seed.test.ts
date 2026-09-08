import { describe, expect, it } from "vitest";
import {
  parseB2bPartnerSeedCredits,
  resolvePartnerCreditRemaining,
  seedLotsFromRemaining,
} from "@/lib/b2b-partner-credit-seed";

describe("b2b partner credit seed", () => {
  it("defaults to no seed when env is unset", () => {
    expect(parseB2bPartnerSeedCredits(undefined)).toBeNull();
    expect(parseB2bPartnerSeedCredits("")).toBeNull();
    expect(resolvePartnerCreditRemaining([])).toEqual({ dealer: 0, business: 0 });
  });

  it("disables seed when env is 0", () => {
    expect(parseB2bPartnerSeedCredits("0")).toBeNull();
  });

  it("parses explicit sku counts", () => {
    expect(parseB2bPartnerSeedCredits("dealer:3,business:1")).toEqual({ dealer: 3, business: 1 });
  });

  it("prefers live lots over seed", () => {
    const now = new Date("2026-09-07T12:00:00.000Z");
    const lots = seedLotsFromRemaining({ dealer: 2, business: 0 }, now);
    expect(resolvePartnerCreditRemaining(lots, now)).toEqual({ dealer: 2, business: 0 });
  });
});
