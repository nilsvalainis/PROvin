import { describe, expect, it } from "vitest";
import {
  BLACK_FRIDAY_END_EXCLUSIVE_MS,
  BLACK_FRIDAY_PRICES,
  BLACK_FRIDAY_START_MS,
  blackFridayBannerText,
  blackFridaySavingsLine,
  formatPromoEur,
  getBlackFridayPlanPrice,
  isBlackFridayActive,
  isBlackFridaySwitchOn,
  omnibusLowestPriceLine,
  rigaLocalToUtcMs,
  swapPriceInText,
} from "@/lib/promo/black-friday";

const at = (iso: string) => Date.parse(iso);

describe("Black Friday laiks (Europe/Riga)", () => {
  it("Rīgas laiks pārrēķināts uz UTC (ziemā UTC+2)", () => {
    expect(new Date(rigaLocalToUtcMs("2026-12-01T23:59:59")).toISOString()).toBe("2026-12-01T21:59:59.000Z");
    expect(new Date(rigaLocalToUtcMs("2026-07-01T12:00:00")).toISOString()).toBe("2026-07-01T09:00:00.000Z");
  });

  it("sākums jau pagājis: ieslēdz tikai slēdzis; beigas 01.12.2026 23:59 Rīga", () => {
    expect(BLACK_FRIDAY_START_MS).toBeLessThanOrEqual(at("2026-11-26T18:00:00Z"));
    expect(new Date(BLACK_FRIDAY_END_EXCLUSIVE_MS).toISOString()).toBe("2026-12-01T22:00:00.000Z");
  });

  it("pirms sākuma - nav aktīva", () => {
    expect(isBlackFridayActive({ nowMs: BLACK_FRIDAY_START_MS - 1, enabled: true })).toBe(false);
    expect(isBlackFridayActive({ nowMs: at("2026-11-20T12:00:00Z"), enabled: true })).toBe(false);
  });

  it("intervālā ar ieslēgtu slēdzi - aktīva (arī šovakar 26.11 un 01.12 23:59 Rīga)", () => {
    expect(isBlackFridayActive({ nowMs: at("2026-11-26T19:00:00Z"), enabled: true })).toBe(true);
    expect(isBlackFridayActive({ nowMs: at("2026-11-28T10:00:00Z"), enabled: true })).toBe(true);
    expect(isBlackFridayActive({ nowMs: at("2026-12-01T21:59:30Z"), enabled: true })).toBe(true);
  });

  it("pēc beigām (02.12 00:00 Rīga) - nav aktīva", () => {
    expect(isBlackFridayActive({ nowMs: at("2026-12-01T22:00:00Z"), enabled: true })).toBe(false);
    expect(isBlackFridayActive({ nowMs: at("2026-12-05T10:00:00Z"), enabled: true })).toBe(false);
  });

  it("slēdzis izslēgts - nav aktīva arī intervālā", () => {
    expect(isBlackFridayActive({ nowMs: at("2026-11-28T10:00:00Z"), enabled: false })).toBe(false);
  });

  it("env slēdzis: noklusēti izslēgts", () => {
    expect(isBlackFridaySwitchOn(undefined)).toBe(false);
    expect(isBlackFridaySwitchOn("")).toBe(false);
    expect(isBlackFridaySwitchOn("0")).toBe(false);
    expect(isBlackFridaySwitchOn("false")).toBe(false);
    expect(isBlackFridaySwitchOn("1")).toBe(true);
    expect(isBlackFridaySwitchOn(" TRUE ")).toBe(true);
  });
});

describe("Black Friday cenas", () => {
  const on = { nowMs: at("2026-11-28T10:00:00Z"), enabled: true };

  it("tikai dīlera dati: 24,99 -> akcijas cena; AUDITS, MINI, Business nemainās", () => {
    const p = getBlackFridayPlanPrice("dealer", on);
    expect(p).toMatchObject({ regularCents: 2499, promoCents: BLACK_FRIDAY_PRICES.dealer!.promoCents, promoId: "bf2026" });
    expect(p!.promoCents).toBe(1749);
    expect(p!.discountLabel).toBe("-30 %");
    for (const id of ["premium", "plus", "mini", "business", "koreaUsa"]) {
      expect(getBlackFridayPlanPrice(id, on), id).toBeNull();
    }
  });

  it("ārpus akcijas dīlera datiem nav akcijas cenas", () => {
    expect(getBlackFridayPlanPrice("dealer", { ...on, enabled: false })).toBeNull();
  });
});

describe("Black Friday teksti 4 valodās", () => {
  it("ietaupījums «Ietaupi 7,50 €»", () => {
    const cfg = BLACK_FRIDAY_PRICES.dealer!;
    const n = (x: string) => x.replace(/\u00a0/g, " ");
    expect(n(blackFridaySavingsLine(cfg, "lv"))).toBe("Ietaupi 7,50 €");
    expect(n(blackFridaySavingsLine(cfg, "en"))).toBe("Save €7.50");
    expect(n(blackFridaySavingsLine(cfg, "de"))).toBe("Sie sparen 7,50 €");
    expect(n(blackFridaySavingsLine(cfg, "ru"))).toBe("Экономия 7,50 €");
  });

  it("Omnibus rinda", () => {
    expect(omnibusLowestPriceLine(2499, "lv").replace(/\u00a0/g, " ")).toBe("Iepriekšējā cena: 24,99 €");
    expect(omnibusLowestPriceLine(2499, "en").replace(/\u00a0/g, " ")).toBe("Previous price: €24.99");
    expect(omnibusLowestPriceLine(2499, "de").replace(/\u00a0/g, " ")).toBe("Vorheriger Preis: 24,99 €");
    expect(omnibusLowestPriceLine(2499, "ru").replace(/\u00a0/g, " ")).toBe("Предыдущая цена: 24,99 €");
  });

  it("cenas formāts un aizstāšana pogās", () => {
    expect(formatPromoEur(1749, "lv")).toBe("17,49 €");
    expect(formatPromoEur(1749, "en")).toBe("€17.49");
    expect(swapPriceInText("PASŪTĪT DĪLERA DATUS 24,99 €", 2499, 1749)).toBe("PASŪTĪT DĪLERA DATUS 17,49 €");
    expect(swapPriceInText("ORDER DEALER DATA €24.99", 2499, 1749)).toBe("ORDER DEALER DATA €17.49");
    expect(swapPriceInText("HÄNDLERDATEN BESTELLEN 24,99 €", 2499, 1749)).toBe("HÄNDLERDATEN BESTELLEN 17,49 €");
    expect(swapPriceInText("ЗАКАЗАТЬ 24,99 €", 2499, 1749)).toBe("ЗАКАЗАТЬ 17,49 €");
    expect(swapPriceInText("Pasūtīt dīlera datus · 24,99 €", 2499, 1749)).toBe("Pasūtīt dīlera datus · 17,49 €");
    expect(swapPriceInText("PASŪTĪT PROVIN AUDITU 99,99 €", 2499, 1749)).toBe("PASŪTĪT PROVIN AUDITU 99,99 €");
  });

  it("pagaidu josla bez garās domuzīmes", () => {
    const cfg = BLACK_FRIDAY_PRICES.dealer!;
    for (const loc of ["lv", "en", "de", "ru"]) {
      const t = blackFridayBannerText(cfg, loc);
      expect(t, loc).toContain(formatPromoEur(1749, loc));
      expect(t, loc).toContain(formatPromoEur(2499, loc));
      expect(t, loc).toContain("-30 %");
      expect(t).not.toMatch(/[\u2013\u2014]/);
    }
  });
});
