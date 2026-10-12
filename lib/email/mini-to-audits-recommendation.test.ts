import { describe, expect, it } from "vitest";
import { dealerDataOperatorMessageEmailHtml } from "@/lib/email/html-templates";
import {
  buildMiniToAuditsRecommendationDraft,
  MINI_TO_AUDITS_PAYMENT_LINK_PLACEHOLDER,
  MINI_TO_AUDITS_RECOMMENDATION_LABEL,
  miniToAuditsGreeting,
  miniToAuditsVehiclePhrase,
} from "@/lib/email/mini-to-audits-recommendation";
import {
  AUDIT_PRICE_CENTS,
  formatEurFromCents,
  MINI_CATALOG_CENTS,
  MINI_DEALER_ADDON_CENTS,
} from "@/lib/order-upsell";

const MINI = formatEurFromCents(MINI_CATALOG_CENTS);
const AUDITS = formatEurFromCents(AUDIT_PRICE_CENTS);
const DIFF = formatEurFromCents(AUDIT_PRICE_CENTS - MINI_CATALOG_CENTS);
const DEALER = formatEurFromCents(MINI_DEALER_ADDON_CENTS);
const PAY_URL = "https://provin.lv/lv/papildinajums/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

function draft(partial: Partial<Parameters<typeof buildMiniToAuditsRecommendationDraft>[0]> = {}) {
  return buildMiniToAuditsRecommendationDraft({
    miniPrice: MINI,
    auditsPrice: AUDITS,
    differencePrice: DIFF,
    dealerAddonPrice: DEALER,
    paymentUrl: PAY_URL,
    ...partial,
  });
}

describe("miniToAuditsGreeting", () => {
  it("uses the customer name when present", () => {
    expect(miniToAuditsGreeting("Jānis Bērziņš")).toBe("Labdien, Jānis Bērziņš!");
  });

  it("falls back without a name", () => {
    expect(miniToAuditsGreeting("  ")).toBe("Labdien!");
    expect(miniToAuditsGreeting(null)).toBe("Labdien!");
  });
});

describe("miniToAuditsVehiclePhrase", () => {
  it("joins car and VIN", () => {
    expect(miniToAuditsVehiclePhrase({ car: "Volkswagen Passat", vin: "wvwzzz3cze123456" })).toBe(
      "Volkswagen Passat (VIN WVWZZZ3CZE123456)",
    );
  });

  it("uses VIN alone", () => {
    expect(miniToAuditsVehiclePhrase({ vin: "WVWZZZ3CZE123456" })).toBe("VIN WVWZZZ3CZE123456");
  });
});

describe("buildMiniToAuditsRecommendationDraft", () => {
  it("fills name, vehicle and the Stripe difference link", () => {
    const d = draft({
      customerName: "Anna",
      vin: "WVWZZZ3CZE123456",
      car: "VW Passat",
    });
    expect(d.subject).toContain(MINI_TO_AUDITS_RECOMMENDATION_LABEL);
    expect(d.subject).toContain("VW Passat");
    expect(d.subject).toContain("WVWZZZ3CZE123456");
    expect(d.emailText).toContain("Labdien, Anna!");
    expect(d.emailText).toContain("VW Passat (VIN WVWZZZ3CZE123456)");
    expect(d.emailText).toContain(`Apmaksāt: ${PAY_URL}`);
    expect(d.whatsappText).toContain(`Apmaksāt: ${PAY_URL}`);
  });

  it("computes the catalog difference from package prices", () => {
    expect(MINI).toBe("39,99 €");
    expect(AUDITS).toBe("99,99 €");
    expect(DIFF).toBe("60,00 €");
    const d = draft();
    expect(d.emailText).toContain("39,99 €");
    expect(d.emailText).toContain("60,00 €");
    expect(d.emailText).toContain("99,99 €");
    expect(d.emailText).toContain("19,99 €");
  });

  it("explains MINI coverage and AUDITS-only checks", () => {
    const d = draft();
    expect(d.emailText).toContain("individuālu konsultāciju un ieteikumus klātienes apskatei");
    expect(d.emailText).toContain("apdrošinātāju datus un tehniskās apskates vēsturi");
    expect(d.emailText).toContain("sludinājuma, pārdevēja un tehnisko risku analīzi");
    expect(d.emailText).toContain("CarVertical un AutoDNA");
    expect(d.emailText).toContain("izcelsmes valsts reģistrus");
    expect(d.emailText).toContain("oficiālā dīlera servisa vēsturi un izsoļu portālu arhīvu");
    expect(d.emailText).toContain("negadījumu vēsturi");
    expect(d.emailText).toContain("ārvalstu nobraukuma hronoloģiju");
    expect(d.emailText).toContain("oficiālā dīlera datus");
    expect(d.emailText).toContain("Iesakām šim auto pāriet uz pilno PROVIN AUDITS");
    expect(d.emailText).toContain("turpināsim ar PROVIN MINI kā pasūtīts");
    expect(d.emailText).toContain("vispirms pievienot tikai oficiālā dīlera datus");
    expect(d.emailText).toContain("nebūs pārbaužu maksas ārvalstu datubāzēs");
    expect(d.emailText).toContain("starptautiskie valsts reģistri");
  });

  it("keeps a manual payment-link placeholder when the URL is missing", () => {
    const d = draft({ paymentUrl: "" });
    expect(d.emailText).toContain(`Apmaksāt: ${MINI_TO_AUDITS_PAYMENT_LINK_PLACEHOLDER}`);
  });

  it("never uses eksperts or unicode dashes", () => {
    const d = draft({ customerName: "Māra", vin: "WBA123", car: "BMW 320d" });
    for (const text of [d.subject, d.emailText, d.whatsappText, MINI_TO_AUDITS_RECOMMENDATION_LABEL]) {
      expect(text.toLowerCase()).not.toContain("ekspert");
      expect(text).not.toMatch(/\u2014|\u2013/);
    }
  });

  it("turns the pay line into an HTML CTA", () => {
    const d = draft();
    const html = dealerDataOperatorMessageEmailHtml({ text: d.emailText });
    expect(html).toContain(`href="${PAY_URL}"`);
    expect(html).toContain("Apmaksāt");
    expect(html).toContain("Labdien!");
    expect(html).not.toMatch(/\u2014|\u2013/);
  });
});
