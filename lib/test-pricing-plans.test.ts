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

  it("mini uses 2999 cents and 24h turnaround", () => {
    const mini = getTestPricingPlan("mini")!;
    expect(mini.amountCents).toBe(2999);
    expect(mini.turnaround).toContain("24h");
    expect(mini.features).toHaveLength(3);
  });

  it("plus uses 4999 cents and includes mini tier", () => {
    const plus = getTestPricingPlan("plus")!;
    expect(plus.amountCents).toBe(4999);
    expect(plus.features.some((f) => f.kind === "includes" && f.packageName === "PROVIN MINI")).toBe(
      true,
    );
  });

  it("premium is highlighted with 9900 cents and 48h turnaround", () => {
    const premium = getTestPricingPlan("premium")!;
    expect(premium.amountCents).toBe(9900);
    expect(premium.highlighted).toBe(true);
    expect(premium.turnaround).toContain("48h");
    expect(premium.vinRequired).toBe(true);
  });
});
