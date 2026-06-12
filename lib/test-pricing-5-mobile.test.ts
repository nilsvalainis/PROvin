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
  "Oficiālo dīleru dati*",
  "Starptautiska vēstures pārbaude",
];

describe("test-pricing-5 mobile two-tier model", () => {
  it("exposes mini and audits only", () => {
    expect(TP5_MOBILE_SERVICE_ORDER).toEqual(["mini", "audits"]);
    expect(TP5_MOBILE_SERVICES).toHaveLength(2);
    expect(TP5_MOBILE_CHECKOUT_PLAN.mini).toBe("plus");
    expect(TP5_MOBILE_CHECKOUT_PLAN.audits).toBe("premium");
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
    expect(mini.features[0]?.name).toBe("Sludinājuma un tehnisko risku analīze");
    expect(mini.features[0]?.included).toBe(true);
    expect(mini.features[3]?.name).toBe("Individuāla konsultācija");
    expect(mini.features[3]?.included).toBe(true);
    expect(mini.features[4]?.included).toBe(false);
    expect(mini.features[4]?.name).toBe("carVertical integrācija");
    expect(mini.features[7]?.included).toBe(false);
    expect(mini.features[7]?.name).toBe("Starptautiska vēstures pārbaude");
  });

  it("maps AUDITS to all eight active rows in the full stack", () => {
    const audits = getTp5MobileService("audits");
    expect(audits.title).toBe("PROVIN AUDITS");
    expect(audits.description).toContain("oficiālā dīlera datus");
    expect(audits.price).toBe("99,99 €");
    expect(audits.buttonText).toBe("PASŪTĪT PROVIN AUDITU — 99,99 €");
    expect(audits.features).toHaveLength(8);
    expect(audits.features.map((feature) => feature.name)).toEqual(FULL_FEATURE_STACK);
    expect(audits.features.every((feature) => feature.included)).toBe(true);
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
    expect(getTp5MobileService("mini", "en").buttonText).toBe("ORDER MINI AUDIT — €39.99");
    expect(getTp5MobileService("audits", "en").title).toBe("PROVIN AUDIT");
    expect(getTp5MobileTurnaround("en")).toContain("48h");
    /** Nezināms vai tukšs locale — latviešu noklusējums. */
    expect(getTp5MobileService("mini").buttonText).toBe("PASŪTĪT MINI AUDITU — 39,99 €");
    expect(getTp5MobileServices("de")).toEqual(lv);
  });

  it("maps checkout tiers to Stripe plan amounts (MINI 39.99, AUDITS 99.99)", () => {
    const miniPlan = getTestPricingPlan(TP5_MOBILE_CHECKOUT_PLAN.mini)!;
    const auditsPlan = getTestPricingPlan(TP5_MOBILE_CHECKOUT_PLAN.audits)!;
    expect(miniPlan.amountCents).toBe(3999);
    expect(miniPlan.stripePriceEnvKey).toBe("STRIPE_PRICE_PLUS");
    expect(auditsPlan.amountCents).toBe(9999);
    expect(auditsPlan.stripePriceEnvKey).toBe("STRIPE_PRICE_PREMIUM");
  });
});
