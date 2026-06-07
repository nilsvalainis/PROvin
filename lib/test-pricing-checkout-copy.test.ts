import { describe, expect, it } from "vitest";
import { getTestPricingCheckoutFormCopy } from "@/lib/test-pricing-checkout-copy";

describe("test-pricing checkout copy", () => {
  it("uses tier-specific titles and shared lead copy", () => {
    expect(getTestPricingCheckoutFormCopy("mini")).toEqual({
      title: "Pabeidz pasūtījumu — PROVIN MINI",
      lead: "Ievadi sludinājuma saiti un VIN kodu.",
    });
    expect(getTestPricingCheckoutFormCopy("plus").title).toBe("Pabeidz pasūtījumu — PROVIN PLUS");
    expect(getTestPricingCheckoutFormCopy("premium")).toEqual({
      title: "Pabeidz pasūtījumu — PROVIN AUDITS",
      lead: "Ievadi sludinājuma saiti un VIN kodu.",
    });
  });
});
