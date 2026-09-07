import { describe, expect, it } from "vitest";
import {
  getTp5CheckoutSubmitMessage,
  getTp5MiniCheckoutNote,
  getTp5StripeCheckoutProduct,
  isTp5CheckoutSource,
  TP5_STRIPE_CHECKOUT_PRODUCT,
  validateTp5InlineFields,
} from "@/lib/test-pricing-5-inline-checkout";

describe("test-pricing-5 inline checkout", () => {
  it("requires vin or plate; listing url is optional", () => {
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
    /** Bez sludinājuma saites — derīgs VIN vai numurzīme pietiek. */
    expect(validateTp5InlineFields("", "1HGCM82633A004352").ok).toBe(true);
    expect(validateTp5InlineFields("", "KG982").ok).toBe(true);
    expect(validateTp5InlineFields("", "AB-1234").ok).toBe(true);
    /** Numurzīme ārpus 3–6 zīmēm vai nepilns VIN — kļūda. */
    expect(validateTp5InlineFields("", "AB").ok).toBe(false);
    expect(validateTp5InlineFields("", "ABCD123").ok).toBe(false);
    /** Ja saite ievadīta — tai jābūt pilnai (ne tikai sakne). */
    expect(validateTp5InlineFields("https://www.ss.lv", "KG982").ok).toBe(false);
  });

  it("localizes validation messages (lv default, en on request)", () => {
    const lv = validateTp5InlineFields("", "");
    expect(lv.ok).toBe(false);
    if (!lv.ok) {
      expect(lv.errors.vin).toContain("Ievadi derīgu VIN kodu");
    }
    const en = validateTp5InlineFields("https://www.ss.lv", "", "en");
    expect(en.ok).toBe(false);
    if (!en.ok) {
      expect(en.errors.vin).toContain("Enter a valid VIN");
      expect(en.errors.listingUrl).toContain("full link");
    }
  });

  it("recognizes tp5 checkout sources", () => {
    expect(isTp5CheckoutSource("test-pricing-5")).toBe(true);
    expect(isTp5CheckoutSource("test-checkout")).toBe(true);
    expect(isTp5CheckoutSource("home-pricing")).toBe(true);
    expect(isTp5CheckoutSource("test-pricing-2")).toBe(false);
  });

  it("locks tp5 price_data to MINI 3999, AUDITS 9999 and dealer 2499 cents", () => {
    expect(TP5_STRIPE_CHECKOUT_PRODUCT.plus.amountCents).toBe(3999);
    expect(TP5_STRIPE_CHECKOUT_PRODUCT.plus.productName).toBe("PROVIN MINI");
    expect(TP5_STRIPE_CHECKOUT_PRODUCT.plus.productDesc).toContain("Latvijā");
    expect(TP5_STRIPE_CHECKOUT_PRODUCT.plus.productDesc).not.toMatch(/[\u2013\u2014]/);
    expect(TP5_STRIPE_CHECKOUT_PRODUCT.premium.amountCents).toBe(9999);
    expect(TP5_STRIPE_CHECKOUT_PRODUCT.premium.productName).toBe("PROVIN AUDITS");
    expect(TP5_STRIPE_CHECKOUT_PRODUCT.premium.productDesc).toContain("eksperta slēdziens");
    expect(TP5_STRIPE_CHECKOUT_PRODUCT.dealer.amountCents).toBe(2499);
    expect(TP5_STRIPE_CHECKOUT_PRODUCT.dealer.productDesc).toContain("naudas atmaksa");
    expect(TP5_STRIPE_CHECKOUT_PRODUCT.koreaUsa.productDesc).toContain("Korejas");
    expect(getTp5StripeCheckoutProduct("dealer")?.productName).toContain("dīlera");
    expect(getTp5StripeCheckoutProduct("premium")?.productName).toBe("PROVIN AUDITS");
    expect(getTp5StripeCheckoutProduct("mini")).toBeNull();
  });

  it("uses Latvian product copy on Stripe Checkout", () => {
    expect(getTp5MiniCheckoutNote()).toContain("Latvijā ekspluatētiem");
    expect(getTp5MiniCheckoutNote()).toContain("PROVIN AUDITS");
    expect(getTp5MiniCheckoutNote()).not.toMatch(/[\u2013\u2014]/);
    expect(getTp5MiniCheckoutNote("en")).toContain("used in Latvia");
    expect(getTp5CheckoutSubmitMessage("plus")).toBe(getTp5MiniCheckoutNote());
    expect(getTp5CheckoutSubmitMessage("premium")).toBeNull();
    expect(getTp5CheckoutSubmitMessage("dealer")).toContain("naudas atmaksa");
    expect(getTp5CheckoutSubmitMessage("koreaUsa")).toContain("Korejas");
    expect(getTp5CheckoutSubmitMessage("dealer")).not.toMatch(/[\u2013\u2014]/);
  });
});
