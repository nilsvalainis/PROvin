import { describe, expect, it } from "vitest";
import { dealerDataOperatorMessageEmailHtml } from "@/lib/email/html-templates";
import {
  buildMiniToAuditsRecommendationDraft,
  latvianVocativeFirstName,
  MINI_TO_AUDITS_APPROVED_TEXT,
  MINI_TO_AUDITS_PAYMENT_LINK_PLACEHOLDER,
  MINI_TO_AUDITS_RECOMMENDATION_LABEL,
  miniToAuditsGreeting,
} from "@/lib/email/mini-to-audits-recommendation";
import { AUDIT_PRICE_CENTS, formatEurFromCents, MINI_CATALOG_CENTS } from "@/lib/order-upsell";

const DIFF = formatEurFromCents(AUDIT_PRICE_CENTS - MINI_CATALOG_CENTS);
const PAY_URL = "https://checkout.stripe.com/c/pay/cs_test_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

function draft(partial: Partial<Parameters<typeof buildMiniToAuditsRecommendationDraft>[0]> = {}) {
  return buildMiniToAuditsRecommendationDraft({
    differencePrice: DIFF,
    paymentUrl: PAY_URL,
    ...partial,
  });
}

describe("latvianVocativeFirstName", () => {
  it("turns masculine -s/-is names into vocative", () => {
    expect(latvianVocativeFirstName("Jānis Bērziņš")).toBe("Jāni");
    expect(latvianVocativeFirstName("Andris")).toBe("Andri");
    expect(latvianVocativeFirstName("Nils")).toBe("Nil");
    expect(latvianVocativeFirstName("Kristaps")).toBe("Kristap");
  });

  it("keeps feminine -a names", () => {
    expect(latvianVocativeFirstName("Anna Kalniņa")).toBe("Anna");
    expect(latvianVocativeFirstName("Māra")).toBe("Māra");
  });
});

describe("miniToAuditsGreeting", () => {
  it("uses the vocative", () => {
    expect(miniToAuditsGreeting("Jānis Bērziņš")).toBe("Labdien, Jāni!");
    expect(miniToAuditsGreeting("Anna Kalniņa")).toBe("Labdien, Anna!");
  });

  it("keeps the name placeholder without a name", () => {
    expect(miniToAuditsGreeting("  ")).toBe("Labdien, {vards}!");
    expect(miniToAuditsGreeting(null)).toBe("Labdien, {vards}!");
  });
});

describe("buildMiniToAuditsRecommendationDraft", () => {
  it("uses the approved wording with vocative, car and Stripe link", () => {
    const d = draft({
      customerName: "Jānis Bērziņš",
      vin: "WVWZZZ3CZE123456",
      car: "VW Passat",
    });
    expect(d.subject).toBe("Jūsu PROVIN MINI pasūtījums: VW Passat");
    expect(d.subject).not.toContain(MINI_TO_AUDITS_RECOMMENDATION_LABEL);
    expect(d.emailText).toBe(
      MINI_TO_AUDITS_APPROVED_TEXT.replaceAll("{vards}", "Jāni")
        .replaceAll("{auto}", "VW Passat")
        .replaceAll("{starpiba}", "60,00")
        .replaceAll("{maksajuma_saite}", PAY_URL),
    );
    expect(d.whatsappText).toBe(d.emailText);
    expect(d.emailText).toContain("Labdien, Jāni!");
    expect(d.emailText).toContain("Paldies par PROVIN MINI pasūtījumu VW Passat.");
    expect(d.emailText).not.toMatch(/\(VIN\s/i);
    expect(d.emailText).toContain(`Starpību (60,00 €) varat apmaksāt šeit:\n${PAY_URL}`);
    expect(d.emailText).toContain("T: 29502039");
  });

  it("computes the catalog difference from package prices", () => {
    expect(DIFF).toBe("60,00 €");
    const d = draft();
    expect(d.emailText).toContain("Starpību (60,00 €)");
    expect(d.emailText).not.toContain("39,99 €");
    expect(d.emailText).not.toContain("99,99 €");
  });

  it("keeps the approved MINI and AUDITS bullets", () => {
    const d = draft();
    expect(d.emailText).toContain("Izanalizējot datus, redzam, ka šim auto vairāk atbilst PROVIN AUDITS.");
    expect(d.emailText).not.toContain("Pārskatot auto");
    expect(d.emailText).toContain("✓ Konsultāciju un ieteikumus klātienes apskatei");
    expect(d.emailText).toContain("✓ OCTA negadījumus un tehnisko apskašu vēsturi");
    expect(d.emailText).toContain("✓ Sludinājuma, pārdevēja un tehnisko risku analīzi");
    expect(d.emailText).toContain("✓ CarVertical + AutoDNA + izcelsmes valsts reģistrus");
    expect(d.emailText).toContain("✓ Oficiālo dīleru un izsoļu portālu arhīva datus");
    expect(d.emailText).toContain("negadījumu vēsturi, nobraukuma vēsturi ārvalstīs");
    expect(d.emailText).toContain("kas ievestiem auto ir paši svarīgākie.");
    expect(d.emailText).toContain("Mēs iesakām pilno auditu");
    expect(d.emailText).toContain("turpināsim ar MINI");
    expect(d.emailText).not.toContain("atbilstu");
    expect(d.emailText).not.toContain("pie ievestiem");
    expect(d.emailText).not.toContain("oficiālā dīlera datiem un tālāk lemt");
  });

  it("keeps placeholders when name, car or payment URL are missing", () => {
    const d = draft({ paymentUrl: "", customerName: "", car: "", vin: "" });
    expect(d.emailText).toContain("Labdien, {vards}!");
    expect(d.emailText).toContain("pasūtījumu {auto}.");
    expect(d.emailText).toContain(MINI_TO_AUDITS_PAYMENT_LINK_PLACEHOLDER);
    expect(d.subject).toBe("Jūsu PROVIN MINI pasūtījums");
  });

  it("never uses eksperts or unicode dashes", () => {
    const d = draft({ customerName: "Māra", vin: "WBA123", car: "BMW 320d" });
    for (const text of [d.subject, d.emailText, d.whatsappText, MINI_TO_AUDITS_RECOMMENDATION_LABEL]) {
      expect(text.toLowerCase()).not.toContain("ekspert");
      expect(text).not.toMatch(/\u2014|\u2013/);
    }
  });

  it("turns the payment URL into an HTML CTA", () => {
    const d = draft({ customerName: "Anna" });
    const html = dealerDataOperatorMessageEmailHtml({ text: d.emailText });
    expect(html).toContain(`href="${PAY_URL}"`);
    expect(html).toContain("Apmaksāt");
    expect(html).toContain("Labdien, Anna!");
    expect(html).not.toMatch(/\u2014|\u2013/);
  });
});
