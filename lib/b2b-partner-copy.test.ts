import { describe, expect, it } from "vitest";
import {
  B2B_BUSINESS_PACKS,
  B2B_PARTNER_PRICE,
  B2B_PARTNER_PRICE_CENTS,
  b2bPackDiscountPct,
  formatB2bEuroFromCents,
} from "@/lib/b2b-partner-copy";

describe("b2b partner prices", () => {
  it("keeps locked commercial amounts", () => {
    expect(B2B_PARTNER_PRICE.business).toBe("79,99 €");
    expect(B2B_PARTNER_PRICE.dealer).toBe("19,99 €");
    expect(B2B_PARTNER_PRICE_CENTS.business).toBe(7999);
    expect(B2B_PARTNER_PRICE_CENTS.dealer).toBe(1999);
  });

  it("locks BUSINESS pack units at 79.99 / 74.99 / 69.99", () => {
    expect(B2B_BUSINESS_PACKS.map((p) => p.unitCents)).toEqual([7999, 7499, 6999]);
    expect(formatB2bEuroFromCents(3 * 7499)).toBe("224,97 €");
    expect(formatB2bEuroFromCents(10 * 6999)).toBe("699,90 €");
    expect(b2bPackDiscountPct(7499, 7999)).toBe(6);
    expect(b2bPackDiscountPct(6999, 7999)).toBe(13);
  });
});
