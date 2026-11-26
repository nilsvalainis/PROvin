import { describe, expect, it } from "vitest";
import {
  availableUpsellQuotes,
  BF_DEALER_TO_AUDIT_CHARGE_CENTS,
  buildOrderUpsellCheckoutSessionParams,
  buildUpsellDraft,
  dealerToAuditPricing,
  isBlackFridayDealerOrder,
  quoteOrderUpsell,
  upsellKindButtonLabel,
  upsellListOverlay,
} from "@/lib/order-upsell";
import { BLACK_FRIDAY_END_EXCLUSIVE_MS, BLACK_FRIDAY_START_MS } from "@/lib/promo/black-friday";

const IN_PROMO_UNIX = Math.floor((BLACK_FRIDAY_START_MS + 60 * 60 * 1000) / 1000);
const BEFORE_PROMO_UNIX = Math.floor((BLACK_FRIDAY_START_MS - 24 * 60 * 60 * 1000) / 1000);
const AFTER_PROMO_UNIX = Math.floor((BLACK_FRIDAY_END_EXCLUSIVE_MS + 24 * 60 * 60 * 1000) / 1000);

const BF_ORDER = { checkoutLine: "dealer", amountTotalCents: 1749, promo: "bf2026", createdUnix: IN_PROMO_UNIX };

describe("Black Friday dīlera dati -> AUDITS piemaksa 79,99 €", () => {
  it("BF pasūtījums (promo=bf2026) -> piemaksa 79,99 €, kopā 97,48 €", () => {
    const q = quoteOrderUpsell("dealer_to_audit", BF_ORDER);
    expect(BF_DEALER_TO_AUDIT_CHARGE_CENTS).toBe(7999);
    expect(q).toMatchObject({ chargeCents: 7999, priorCents: 1749, targetCents: 9748, targetLine: "audit" });
    expect(upsellKindButtonLabel(q!)).toBe("Nosūtīt 79,99 € piepirkumu");
  });

  it("BF bez metadata: 17,49 € akcijas periodā -> 79,99 €", () => {
    const q = quoteOrderUpsell("dealer_to_audit", { checkoutLine: "dealer", amountTotalCents: 1749, createdUnix: IN_PROMO_UNIX });
    expect(q?.chargeCents).toBe(7999);
  });

  it("17,49 € ārpus akcijas perioda bez promo -> parastā formula", () => {
    expect(isBlackFridayDealerOrder({ amountTotalCents: 1749, createdUnix: BEFORE_PROMO_UNIX })).toBe(false);
    expect(isBlackFridayDealerOrder({ amountTotalCents: 1749, createdUnix: AFTER_PROMO_UNIX })).toBe(false);
    expect(isBlackFridayDealerOrder({ amountTotalCents: 1749 })).toBe(false);
    const q = quoteOrderUpsell("dealer_to_audit", { checkoutLine: "dealer", amountTotalCents: 1749, createdUnix: BEFORE_PROMO_UNIX });
    expect(q?.chargeCents).toBe(8250);
  });

  it("piedāvājums pēc 01.12 BF pasūtījumam joprojām 79,99 € (cena pēc pasūtījuma, ne pēc šodienas)", () => {
    // quote nav atkarīgs no pašreizējā laika - tikai no pasūtījuma promo/datuma.
    expect(dealerToAuditPricing({ priorCents: 1749, promo: "bf2026", createdUnix: IN_PROMO_UNIX })?.chargeCents).toBe(7999);
    expect(dealerToAuditPricing({ priorCents: 1749, promo: "bf2026" })?.chargeCents).toBe(7999);
  });

  it("parasts dīlera pasūtījums (24,99 €) -> piemaksa 75,00 €", () => {
    const q = quoteOrderUpsell("dealer_to_audit", { checkoutLine: "dealer", amountTotalCents: 2499, createdUnix: IN_PROMO_UNIX });
    expect(q).toMatchObject({ chargeCents: 7500, priorCents: 2499, targetCents: 9999 });
  });

  it("B2B nemainās (arī ar BF summu/metadata): kopā 69,99 €", () => {
    expect(quoteOrderUpsell("dealer_to_audit", { checkoutLine: "dealer", amountTotalCents: 2499, b2b: true })).toMatchObject({
      chargeCents: 4500,
      targetCents: 6999,
    });
    expect(quoteOrderUpsell("dealer_to_audit", { ...BF_ORDER, b2b: true })).toMatchObject({
      chargeCents: 5250,
      targetCents: 6999,
    });
  });

  it("MINI piepirkumi nemainās", () => {
    const kinds = availableUpsellQuotes({ checkoutLine: "mini", amountTotalCents: 3999, createdUnix: IN_PROMO_UNIX }).map((q) => [
      q.kind,
      q.chargeCents,
    ]);
    expect(kinds).toEqual([
      ["mini_to_dealer", 1999],
      ["mini_to_audit", 6000],
    ]);
  });

  it("Stripe sesija: unit_amount 7999", () => {
    const p = buildOrderUpsellCheckoutSessionParams({
      kind: "dealer_to_audit",
      chargeCents: 7999,
      parentSessionId: "cs_test_parent",
      token: "b".repeat(32),
      targetLine: "audit",
      email: "klients@example.com",
      origin: "https://www.provin.lv",
    });
    expect(p.line_items[0].price_data.unit_amount).toBe(7999);
  });

  it.each(["lv", "en", "de", "ru"] as const)("e-pasta un WhatsApp teksts ar «79,99 €» (%s)", (lang) => {
    const q = quoteOrderUpsell("dealer_to_audit", BF_ORDER)!;
    const d = buildUpsellDraft({
      kind: "dealer_to_audit",
      vin: "WBA5R1C0XLFH42873",
      url: "https://www.provin.lv/lv/papildinajums/x",
      priorCents: q.priorCents,
      chargeCents: q.chargeCents,
      targetCents: q.targetCents,
      lang,
    });
    expect(d.emailText).toContain("79,99 €");
    expect(d.emailText).toContain("17,49 €");
    expect(d.emailText).toContain("97,48 €");
    expect(d.emailText).not.toContain("82,50");
    expect(d.whatsappText).toContain("79,99 €");
  });

  it("admin sarakstā pēc apmaksas: 17,49 € + 79,99 €, summa 97,48 €", () => {
    const o = upsellListOverlay([
      {
        kind: "dealer_to_audit",
        status: "paid",
        chargeCents: 7999,
        priorCents: 1749,
        targetCents: 9748,
        targetLine: "audit",
        paidAt: "2026-11-27T10:00:00.000Z",
        expiresAt: "2099-01-01T00:00:00.000Z",
        token: "c".repeat(32),
      },
    ]);
    expect(o).toMatchObject({ targetCents: 9748, badge: "Piepirkums 17,49 € + 79,99 €" });
  });
});
