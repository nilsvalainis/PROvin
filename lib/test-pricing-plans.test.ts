import { describe, expect, it } from "vitest";
import {
  getTestPricingPlan,
  isTestPricingPlanId,
  TEST_PRICING_PLANS,
  validateTestPricingStep2,
} from "@/lib/test-pricing-plans";

describe("test-pricing plans", () => {
  it("exposes mini, plus, premium, dealer and koreaUsa in order", () => {
    expect(TEST_PRICING_PLANS.map((p) => p.id)).toEqual([
      "mini",
      "plus",
      "premium",
      "dealer",
      "koreaUsa",
    ]);
  });

  it("recognizes valid plan ids", () => {
    expect(isTestPricingPlanId("mini")).toBe(true);
    expect(isTestPricingPlanId("plus")).toBe(true);
    expect(isTestPricingPlanId("premium")).toBe(true);
    expect(isTestPricingPlanId("dealer")).toBe(true);
    expect(isTestPricingPlanId("other")).toBe(false);
  });

  it("mini uses 1999 cents and 24h turnaround", () => {
    const mini = getTestPricingPlan("mini")!;
    expect(mini.amountCents).toBe(1999);
    expect(mini.turnaround).toContain("24h");
    expect(mini.vinRequired).toBe(true);
    expect(mini.features.filter((f) => f.kind === "bullet")).toHaveLength(3);
    expect(mini.features.some((f) => f.kind === "exclusion")).toBe(true);
  });

  it("plus uses 3999 cents and includes mini tier", () => {
    const plus = getTestPricingPlan("plus")!;
    expect(plus.amountCents).toBe(3999);
    expect(plus.features.some((f) => f.kind === "includes" && f.tierName === "MINI")).toBe(true);
    expect(plus.features.some((f) => f.kind === "exclusion")).toBe(true);
  });

  it("premium is highlighted with 9999 cents and 24-72h turnaround", () => {
    const premium = getTestPricingPlan("premium")!;
    expect(premium.amountCents).toBe(9999);
    expect(premium.highlighted).toBe(true);
    expect(premium.turnaround).toContain("24-72h");
    expect(premium.vinRequired).toBe(true);
    expect(premium.heroCtaLabel).toContain("99,99");
  });

  it("dealer is 2499 cents with refund-oriented product copy", () => {
    const dealer = getTestPricingPlan("dealer")!;
    expect(dealer.amountCents).toBe(2499);
    expect(dealer.productName).toBe("Oficiālā dīlera servisa vēstures dati");
    expect(dealer.productDesc).toContain("100%");
    expect(dealer.turnaround).toContain("24-72h");
  });

  it("requires vin or plate and consent; listing url is optional", () => {
    const mini = getTestPricingPlan("mini")!;
    const plus = getTestPricingPlan("plus")!;

    expect(validateTestPricingStep2(mini, "", "", false).ok).toBe(false);
    expect(
      validateTestPricingStep2(
        plus,
        "https://www.ss.lv/msg/lv/transport/cars/example.html",
        "",
        true,
      ).ok,
    ).toBe(false);
    expect(
      validateTestPricingStep2(
        plus,
        "https://www.ss.lv/msg/lv/transport/cars/example.html",
        "1HGCM82633A004352",
        true,
      ).ok,
    ).toBe(true);
    /** Sludinājuma saite nav obligāta — VIN vai numurzīme + piekrišana pietiek. */
    expect(validateTestPricingStep2(plus, "", "1HGCM82633A004352", true).ok).toBe(true);
    expect(validateTestPricingStep2(plus, "", "KG982", true).ok).toBe(true);
    expect(validateTestPricingStep2(plus, "", "KG982", false).ok).toBe(false);
    expect(validateTestPricingStep2(plus, "", "AB", true).ok).toBe(false);
  });
});
