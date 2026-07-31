import { describe, expect, it } from "vitest";
import {
  getTp5MobileService,
  getTp5MobileServices,
  getTp5MobileTurnaround,
  TP5_MOBILE_CHECKOUT_PLAN,
  TP5_MOBILE_SERVICES,
  TP5_MOBILE_SERVICE_ORDER,
} from "@/lib/test-pricing-5-mobile";
import { getTestPricingPlan } from "@/lib/test-pricing-plans";

const FULL_FEATURE_STACK = [
  "Sludinājuma un tehnisko risku analīze",
  "EU reģistru pārbaude & TA vēsture",
  "Ieteikumi klātienes apskatei",
  "Individuāla konsultācija",
  "carVertical integrācija",
  "autoDNA integrācija",
  "Oficiālo dīleru un izsoļu portālu arhīvs*",
  "Starptautiska vēstures pārbaude",
];

describe("test-pricing-5 mobile three-tier model", () => {
  it("exposes mini, audits and dealer", () => {
    expect(TP5_MOBILE_SERVICE_ORDER).toEqual(["mini", "audits", "dealer"]);
    expect(TP5_MOBILE_SERVICES).toHaveLength(3);
    expect(TP5_MOBILE_CHECKOUT_PLAN.mini).toBe("plus");
    expect(TP5_MOBILE_CHECKOUT_PLAN.audits).toBe("premium");
    expect(TP5_MOBILE_CHECKOUT_PLAN.dealer).toBe("dealer");
  });

  it("maps MINI to four active and four inactive rows in the full stack", () => {
    const mini = getTp5MobileService("mini");
    expect(mini.title).toBe("PROVIN MINI");
    expect(mini.buttonText).toBe("PASŪTĪT MINI AUDITU — 39,99 €");
    expect(mini.description).toContain("Latvijā 🇱🇻 lietotiem auto");
    expect(mini.features).toHaveLength(8);
    expect(mini.features.map((feature) => feature.name)).toEqual(FULL_FEATURE_STACK);
    expect(mini.features.filter((feature) => feature.included)).toHaveLength(4);
    expect(mini.features.filter((feature) => !feature.included)).toHaveLength(4);
  });

  it("maps AUDITS to all eight active rows in the full stack", () => {
    const audits = getTp5MobileService("audits");
    expect(audits.title).toBe("PROVIN AUDITS");
    expect(audits.price).toBe("99,99 €");
    expect(audits.features).toHaveLength(8);
    expect(audits.features.every((feature) => feature.included)).toBe(true);
  });

  it("maps dealer to eight rows matching audit stack height, refund footnote", () => {
    const dealer = getTp5MobileService("dealer");
    expect(dealer.title).toBe("DĪLERA DATI");
    expect(dealer.price).toBe("24,99 €");
    expect(dealer.buttonText).toBe("PASŪTĪT DĪLERA DATUS — 24,99 €");
    expect(dealer.description).toContain("nav iekļauts PROVIN MINI un PROVIN AUDITS");
    expect(dealer.features).toHaveLength(8);
    expect(dealer.features.every((feature) => feature.included)).toBe(true);
    expect(dealer.turnaround).toBeUndefined();
    expect(dealer.footnote).toContain("100%");
    expect(getTp5MobileTurnaround()).toContain("24-72h");
  });

  it("keeps the English tier copy structurally identical to Latvian", () => {
    const lv = getTp5MobileServices();
    const en = getTp5MobileServices("en");
    expect(en.map((service) => service.id)).toEqual(lv.map((service) => service.id));
    en.forEach((service, index) => {
      expect(service.features).toHaveLength(lv[index]!.features.length);
      expect(service.features.map((feature) => feature.included)).toEqual(
        lv[index]!.features.map((feature) => feature.included),
      );
    });
    expect(getTp5MobileService("dealer", "en").title).toBe("DEALER DATA");
    expect(getTp5MobileTurnaround("en")).toContain("24-72h");
  });

  it("maps checkout tiers to Stripe plan amounts", () => {
    const miniPlan = getTestPricingPlan(TP5_MOBILE_CHECKOUT_PLAN.mini)!;
    const auditsPlan = getTestPricingPlan(TP5_MOBILE_CHECKOUT_PLAN.audits)!;
    const dealerPlan = getTestPricingPlan(TP5_MOBILE_CHECKOUT_PLAN.dealer)!;
    expect(miniPlan.amountCents).toBe(3999);
    expect(auditsPlan.amountCents).toBe(9999);
    expect(dealerPlan.amountCents).toBe(2499);
    expect(dealerPlan.productName).toContain("dīlera");
  });
});
