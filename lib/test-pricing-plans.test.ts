import { describe, expect, it } from "vitest";
import {
  getTestPricingPlan,
  isTestPricingPlanId,
  TEST_PRICING_PLANS,
} from "@/lib/test-pricing-plans";

describe("test-pricing plans", () => {
  it("exposes mini, plus, and premium in order", () => {
    expect(TEST_PRICING_PLANS.map((p) => p.id)).toEqual(["mini", "plus", "premium"]);
  });

  it("recognizes valid plan ids", () => {
    expect(isTestPricingPlanId("mini")).toBe(true);
    expect(isTestPricingPlanId("plus")).toBe(true);
    expect(isTestPricingPlanId("premium")).toBe(true);
    expect(isTestPricingPlanId("other")).toBe(false);
  });

  it("mini uses 1999 cents and 24h turnaround", () => {
    const mini = getTestPricingPlan("mini")!;
    expect(mini.amountCents).toBe(1999);
    expect(mini.turnaround).toContain("24h");
    expect(mini.features.filter((f) => f.kind === "bullet")).toHaveLength(3);
    expect(mini.features.some((f) => f.kind === "exclusion")).toBe(true);
  });

  it("plus uses 3999 cents and includes mini tier", () => {
    const plus = getTestPricingPlan("plus")!;
    expect(plus.amountCents).toBe(3999);
    expect(plus.features.some((f) => f.kind === "includes" && f.tierName === "MINI")).toBe(true);
    expect(plus.features.some((f) => f.kind === "exclusion")).toBe(true);
  });

  it("premium is highlighted with 9999 cents and 48h turnaround", () => {
    const premium = getTestPricingPlan("premium")!;
    expect(premium.amountCents).toBe(9999);
    expect(premium.highlighted).toBe(true);
    expect(premium.turnaround).toContain("48h");
    expect(premium.vinRequired).toBe(true);
    expect(premium.heroCtaLabel).toContain("99,99");
  });
});
