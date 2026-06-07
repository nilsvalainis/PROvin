import { describe, expect, it } from "vitest";
import {
  getTp5CheckoutHref,
  resolveTp5PlanFromCheckoutQuery,
} from "@/lib/test-pricing-5-checkout-routing";

describe("test-pricing-5 checkout routing", () => {
  it("builds hard-coded checkout URLs per tier", () => {
    expect(getTp5CheckoutHref("mini")).toBe("/test-checkout?plan=19.99");
    expect(getTp5CheckoutHref("plus")).toBe("/test-checkout?plan=39.99");
    expect(getTp5CheckoutHref("premium")).toBe("/test-checkout?plan=PROVIN");
  });

  it("resolves plan query params case-insensitively for PRO", () => {
    expect(resolveTp5PlanFromCheckoutQuery("19.99")).toBe("mini");
    expect(resolveTp5PlanFromCheckoutQuery("39.99")).toBe("plus");
    expect(resolveTp5PlanFromCheckoutQuery("PROVIN")).toBe("premium");
    expect(resolveTp5PlanFromCheckoutQuery("provin")).toBe("premium");
    expect(resolveTp5PlanFromCheckoutQuery("PRO")).toBe("premium");
    expect(resolveTp5PlanFromCheckoutQuery("invalid")).toBeNull();
  });
});
