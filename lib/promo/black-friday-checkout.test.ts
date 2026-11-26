import { describe, expect, it } from "vitest";
import { applyBlackFridayToCheckout, blackFridayEnabledFromEnv } from "@/lib/promo/black-friday-checkout";
import { BLACK_FRIDAY_PRICES } from "@/lib/promo/black-friday";

const IN = Date.parse("2026-11-28T10:00:00Z");
const AFTER = Date.parse("2026-12-02T10:00:00Z");
const base = {
  baseLineItem: {
    price_data: { currency: "eur", product_data: { name: "Dīlera dati" }, unit_amount: 2499 },
    quantity: 1,
  },
  baseAmountCents: 2499,
  productName: "Dīlera dati",
};

describe("Black Friday Stripe summa", () => {
  it("akcijas laikā dīlera datiem price_data ar akcijas summu un metadata promo=bf2026", () => {
    const r = applyBlackFridayToCheckout({ ...base, planId: "dealer", nowMs: IN, enabled: true });
    const promo = BLACK_FRIDAY_PRICES.dealer!.promoCents;
    expect(r.lineItem).toMatchObject({ price_data: { currency: "eur", unit_amount: promo }, quantity: 1 });
    expect(r.metadata).toEqual({ promo: "bf2026", promo_regular_cents: "2499" });
    expect(r.amountCents).toBe(promo);
  });

  it("akcijas laikā Stripe Catalog cena (price_...) tiek aizstāta ar price_data", () => {
    const r = applyBlackFridayToCheckout({
      ...base,
      baseLineItem: { price: "price_abc", quantity: 1 },
      planId: "dealer",
      nowMs: IN,
      enabled: true,
    });
    expect("price" in r.lineItem).toBe(false);
  });

  it("AUDITS akcijas laikā nemainās", () => {
    const audit = { ...base, baseAmountCents: 9999, baseLineItem: { ...base.baseLineItem, price_data: { ...base.baseLineItem.price_data, unit_amount: 9999 } } };
    const r = applyBlackFridayToCheckout({ ...audit, planId: "premium", nowMs: IN, enabled: true });
    expect(r.metadata).toEqual({});
    expect(r.amountCents).toBe(9999);
  });

  it("slēdzis izslēgts vai pēc beigām - parastā summa, bez promo metadata", () => {
    for (const args of [{ nowMs: IN, enabled: false }, { nowMs: AFTER, enabled: true }]) {
      const r = applyBlackFridayToCheckout({ ...base, planId: "dealer", ...args });
      expect(r.lineItem).toBe(base.baseLineItem);
      expect(r.metadata).toEqual({});
      expect(r.amountCents).toBe(2499);
    }
  });

  it("env PROMO_BF_ENABLED noklusēti izslēgts", () => {
    expect(blackFridayEnabledFromEnv({})).toBe(false);
    expect(blackFridayEnabledFromEnv({ PROMO_BF_ENABLED: "1" })).toBe(true);
  });
});
