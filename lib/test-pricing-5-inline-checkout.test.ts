import { describe, expect, it } from "vitest";
import {
  getTp5StripeCheckoutProduct,
  isTp5CheckoutSource,
  TP5_STRIPE_CHECKOUT_PRODUCT,
  validateTp5InlineFields,
} from "@/lib/test-pricing-5-inline-checkout";

describe("test-pricing-5 inline checkout", () => {
  it("requires valid vin and listing url", () => {
    expect(validateTp5InlineFields("", "").ok).toBe(false);
    expect(
      validateTp5InlineFields(
        "https://www.ss.lv/msg/lv/transport/cars/example.html",
        "",
      ).ok,
    ).toBe(false);
    expect(
      validateTp5InlineFields(
        "https://www.ss.lv/msg/lv/transport/cars/example.html",
        "1HGCM82633A004352",
      ).ok,
    ).toBe(true);
  });

  it("recognizes tp5 checkout sources", () => {
    expect(isTp5CheckoutSource("test-pricing-5")).toBe(true);
    expect(isTp5CheckoutSource("test-checkout")).toBe(true);
    expect(isTp5CheckoutSource("home-pricing")).toBe(true);
    expect(isTp5CheckoutSource("test-pricing-2")).toBe(false);
  });

  it("locks tp5 price_data to MINI 3999 and AUDITS 9999 cents with brand names", () => {
    expect(TP5_STRIPE_CHECKOUT_PRODUCT.plus.amountCents).toBe(3999);
    expect(TP5_STRIPE_CHECKOUT_PRODUCT.plus.productName).toBe("PROVIN MINI");
    expect(TP5_STRIPE_CHECKOUT_PRODUCT.premium.amountCents).toBe(9999);
    expect(TP5_STRIPE_CHECKOUT_PRODUCT.premium.productName).toBe("PROVIN AUDITS");
    expect(getTp5StripeCheckoutProduct("premium")?.productName).toBe("PROVIN AUDITS");
    expect(getTp5StripeCheckoutProduct("mini")).toBeNull();
  });
});
