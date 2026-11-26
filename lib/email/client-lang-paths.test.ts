/**
 * Nils 26.11: neapmaksātā atgādinājums, upsell un B2B maka e-pasti klienta valodā visos ceļos -
 * arī saites mērķa lapa, Stripe lapa un HTML veidne (kājene, `lang`).
 */
import { describe, expect, it } from "vitest";
import { unpaidPaymentLinkMessages, unpaidReminderOrderUrl } from "@/lib/admin-unpaid-payment-link";
import { unpaidReminderEmailHtml } from "@/lib/admin-unpaid-reminder-copy";
import { b2bProvinEmailHtml, b2bWalletRefundEmailHtml } from "@/lib/email/html-templates";
import { buildOrderUpsellCheckoutSessionParams, upsellPublicPath, upsellStripeProductName } from "@/lib/order-upsell";
import { upsellPageCopy } from "@/lib/order-upsell-i18n";

const FOREIGN = ["en", "ru", "de"] as const;
const LV_LETTERS = /[āēīūčšžņļķģ]/i;

describe("neapmaksātā atgādinājums", () => {
  it("/apmaksa ved uz pasūtījuma lapu klienta valodā; LV kā līdz šim", () => {
    const vin = "WVWZZZ1KZAW000123";
    expect(unpaidReminderOrderUrl(vin, "https://www.provin.lv")).toBe(`https://www.provin.lv/lv/pasutit?vin=${vin}`);
    expect(unpaidReminderOrderUrl(vin, "https://www.provin.lv", null)).toContain("/lv/pasutit");
    expect(unpaidReminderOrderUrl(vin, "https://www.provin.lv", "xx")).toContain("/lv/pasutit");
    for (const l of FOREIGN) {
      expect(unpaidReminderOrderUrl(vin, "https://www.provin.lv", l)).toBe(`https://www.provin.lv/${l}/pasutit?vin=${vin}`);
      const m = unpaidPaymentLinkMessages(l);
      for (const t of Object.values(m)) expect(t).not.toMatch(LV_LETTERS);
    }
    expect(unpaidPaymentLinkMessages(null).paid).toBe("Šis pasūtījums jau ir apmaksāts.");
  });

  it("HTML `lang` klienta valodā", () => {
    expect(unpaidReminderEmailHtml("Labdien!")).toContain('<html lang="lv">');
    expect(unpaidReminderEmailHtml("Hello!", "de")).toContain('<html lang="de">');
  });
});

describe("upsell", () => {
  it("papildinājuma lapa un Stripe klienta valodā", () => {
    expect(upsellPublicPath("a".repeat(32))).toBe(`/lv/papildinajums/${"a".repeat(32)}`);
    const base = {
      kind: "mini_to_audit" as const,
      chargeCents: 6000,
      parentSessionId: "cs_test_order123",
      token: "a".repeat(32),
      targetLine: "audit" as const,
      vin: "WVWZZZ3CZE123456",
      email: "anna@example.com",
      origin: "https://www.provin.lv",
    };
    const lv = buildOrderUpsellCheckoutSessionParams(base);
    expect(lv.locale).toBe("lv");
    expect(lv.cancel_url).toBe(`https://www.provin.lv/lv/papildinajums/${"a".repeat(32)}`);
    expect(lv.line_items[0].price_data.product_data.description).toBe("Papildinājums jau apmaksātam pasūtījumam. VIN WVWZZZ3CZE123456.");
    expect(upsellStripeProductName("mini_to_dealer")).toBe("Oficiālā dīlera dati (papildinājums)");
    for (const l of FOREIGN) {
      const p = buildOrderUpsellCheckoutSessionParams({ ...base, lang: l });
      expect(p.locale).toBe(l);
      expect(p.cancel_url).toBe(`https://www.provin.lv/${l}/papildinajums/${"a".repeat(32)}`);
      expect(p.success_url).toBe(`https://www.provin.lv/${l}/papildinajums/${"a".repeat(32)}?paid=1`);
      expect(p.line_items[0].price_data.product_data.description).toContain("VIN WVWZZZ3CZE123456");
      expect(p.line_items[0].price_data.product_data.description).not.toMatch(LV_LETTERS);
      expect(upsellStripeProductName("mini_to_dealer", l)).not.toMatch(LV_LETTERS);
      expect(upsellPublicPath("b".repeat(32), l)).toBe(`/${l}/papildinajums/${"b".repeat(32)}`);
    }
  });

  it("lapas teksti tulkoti, bez «eksperts», īsā defise", () => {
    expect(upsellPageCopy("lv").pay("60,00 €")).toBe("Apmaksāt 60,00 €");
    expect(upsellPageCopy("xx").title2).toBe("Papildināt esošo pasūtījumu");
    for (const l of FOREIGN) {
      const c = upsellPageCopy(l);
      const all = Object.values(c)
        .map((v) => (typeof v === "function" ? (v as (x: string) => string)("x") : Array.isArray(v) ? v.join("") : v))
        .join("\n");
      expect(all).not.toMatch(LV_LETTERS);
      expect(all).not.toMatch(/ekspert|expert|[–—]/i);
      expect(c.pay("60,00 €")).toContain("60,00 €");
    }
  });
});

describe("B2B maks: HTML kājene partnera valodā", () => {
  it("atmaksa un papildināšanas rēķins", () => {
    expect(b2bProvinEmailHtml({ title: "PROVIN", paragraphs: ["x"] })).toContain("Šis e-pasts nosūtīts automātiski.");
    const en = b2bWalletRefundEmailHtml({ title: "PROVIN: refund", paragraphs: ["x"], lang: "en" });
    expect(en).toContain('<html lang="en">');
    expect(en).toContain("This email was sent automatically.");
    expect(en).not.toContain("Šis e-pasts");
    expect(b2bProvinEmailHtml({ title: "PROVIN", paragraphs: ["x"], lang: "de" })).toContain("Diese E-Mail wurde automatisch gesendet.");
    expect(b2bProvinEmailHtml({ title: "PROVIN", paragraphs: ["x"], lang: "ru" })).not.toContain("PROVIN.LV");
  });
});
