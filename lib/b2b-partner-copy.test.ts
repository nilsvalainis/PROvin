import { describe, expect, it } from "vitest";
import { B2B_PARTNER_PRICE, B2B_PARTNER_PRICE_CENTS } from "@/lib/b2b-partner-copy";

describe("b2b partner prices", () => {
  it("keeps locked commercial amounts", () => {
    expect(B2B_PARTNER_PRICE.business).toBe("69,99 €");
    expect(B2B_PARTNER_PRICE.dealer).toBe("19,99 €");
    expect(B2B_PARTNER_PRICE_CENTS.business).toBe(6999);
    expect(B2B_PARTNER_PRICE_CENTS.dealer).toBe(1999);
  });
});
