import { describe, expect, it } from "vitest";
import {
  B2B_BUSINESS_PACKS,
  B2B_DEALER_PACKS,
  B2B_PARTNER_PRICE,
  B2B_PARTNER_PRICE_CENTS,
  b2bPackDiscountPct,
  formatB2bEuroFromCents,
  getB2bCatalog,
  getB2bBusinessHeroFeatures,
  getB2bHeroSourceItems,
  splitB2bGoalAroundLink,
} from "@/lib/b2b-partner-copy";

describe("b2b partner prices", () => {
  it("keeps locked commercial amounts", () => {
    expect(B2B_PARTNER_PRICE.business).toBe("79,99 €");
    expect(B2B_PARTNER_PRICE.dealer).toBe("19,99 €");
    expect(B2B_PARTNER_PRICE_CENTS.business).toBe(7999);
    expect(B2B_PARTNER_PRICE_CENTS.dealer).toBe(1999);
  });

  it("locks BUSINESS pack units at 79.99 / 69.99", () => {
    expect(B2B_BUSINESS_PACKS.map((p) => p.unitCents)).toEqual([7999, 6999]);
    expect(formatB2bEuroFromCents(10 * 6999)).toBe("699,90 €");
    expect(b2bPackDiscountPct(6999, 7999)).toBe(13);
  });

  it("locks dealer pack units at 19.99 / 17.99", () => {
    expect(B2B_DEALER_PACKS.map((p) => p.unitCents)).toEqual([1999, 1799]);
    expect(formatB2bEuroFromCents(10 * 1799)).toBe("179,90 €");
    expect(formatB2bEuroFromCents(10 * 1999)).toBe("199,90 €");
    expect(b2bPackDiscountPct(1799, 1999)).toBe(10);
  });

  it("exposes English catalog copy for /en partner pages", () => {
    const en = getB2bCatalog("en");
    expect(en.dealer.title).toBe("DEALER DATA");
    expect(en.business.goal).toContain("PROVIN BUSINESS");
    expect(en.business.goal).not.toMatch(/apvieno datus/);
    expect(getB2bBusinessHeroFeatures("en")[0]).toBe("Official dealer data*");
    expect(getB2bCatalog("de").dealer.title).toBe("HÄNDLERDATEN");
    expect(getB2bCatalog("ru").business.goal).toContain("PROVIN BUSINESS");
    expect(getB2bBusinessHeroFeatures("de")[0]).toBe("Offizielle Händlerdaten*");
    expect(getB2bCatalog("lv").dealer.title).toBe("DĪLERA DATI");
  });

  it("adds mileage history so the login hero source list is 8 items", () => {
    const lv = getB2bHeroSourceItems("lv");
    expect(lv).toHaveLength(8);
    expect(lv[5]).toEqual({ icon: "gauge", title: "Nobraukuma vēsture" });
    expect(getB2bHeroSourceItems("en")[5]?.title).toBe("Mileage history");
    expect(getB2bCatalog("lv").business.items).toHaveLength(7);
  });

  it("keeps the dealer phrase inside every BUSINESS goal so the landing can open the full list", () => {
    for (const locale of ["lv", "en", "de", "ru"] as const) {
      const business = getB2bCatalog(locale).business;
      const parts = splitB2bGoalAroundLink(business.goal, business.goalDealerLink);
      expect(parts, locale).not.toBeNull();
      expect(business.items[0]?.opensDealer).toBe(true);
    }
  });
});
