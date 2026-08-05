import { describe, expect, it } from "vitest";
import {
  getTp5MobileService,
  getTp5MobileServices,
  getTp5MobileTurnaround,
  TP5_DEALER_BRANDS,
  TP5_MOBILE_CHECKOUT_PLAN,
  TP5_MOBILE_FEATURE_ROW_COUNT,
  TP5_MOBILE_SERVICES,
  TP5_MOBILE_SERVICE_ORDER,
} from "@/lib/test-pricing-5-mobile";
import { getTestPricingPlan } from "@/lib/test-pricing-plans";

const FULL_FEATURE_STACK = [
  "Tehnisko apskašu vēsture (LV)",
  "Sludinājuma un pārdevēja analīze",
  "Ieteikumi klātienes apskatei",
  "Tehnisko risku analīze",
  "Individuāla konsultācija",
  "autoDNA atskaite",
  "carVertical atskaite",
  "Izsoļu portālu arhīva dati*",
  "Oficiālo dīleru sistēmu dati*",
  "Starptautisku reģistru pārbaude",
  "Apdrošinātāju dati (avārijas, zādzības)",
];

describe("test-pricing-5 mobile three-tier model", () => {
  it("exposes mini, audits and dealer", () => {
    expect(TP5_MOBILE_SERVICE_ORDER).toEqual(["mini", "audits", "dealer"]);
    expect(TP5_MOBILE_SERVICES).toHaveLength(3);
    expect(TP5_MOBILE_CHECKOUT_PLAN.mini).toBe("plus");
    expect(TP5_MOBILE_CHECKOUT_PLAN.audits).toBe("premium");
    expect(TP5_MOBILE_CHECKOUT_PLAN.dealer).toBe("dealer");
  });

  it("keeps a fixed 11-row checklist for MINI and AUDITS with no empty slots", () => {
    expect(TP5_MOBILE_FEATURE_ROW_COUNT).toBe(11);
    const mini = getTp5MobileService("mini");
    const audits = getTp5MobileService("audits");
    expect(mini.features).toHaveLength(11);
    expect(audits.features).toHaveLength(11);
    expect(mini.features.map((f) => f.name)).toEqual(FULL_FEATURE_STACK);
    expect(audits.features.map((f) => f.name)).toEqual(FULL_FEATURE_STACK);
    expect(mini.features.filter((f) => f.included)).toHaveLength(5);
    expect(mini.features.filter((f) => !f.included)).toHaveLength(6);
    expect(audits.features.every((f) => f.included)).toBe(true);
  });

  it("maps dealer to four rows plus refund explanation note", () => {
    const dealer = getTp5MobileService("dealer");
    expect(dealer.title).toBe("DĪLERA DATI");
    expect(dealer.description).toContain("izsoļu portālu arhīvā");
    expect(dealer.features).toHaveLength(4);
    expect(dealer.features.every((f) => f.included)).toBe(true);
    expect(dealer.features.map((f) => f.name)).toEqual([
      "Odometra rādījumi",
      "Servisa vēsture",
      "Apkopju intervāli",
      "Kopsavilkums",
    ]);
    expect(dealer.extraNote).toBe("Ja dati nav pieejami — 100% naudas atmaksa.");
    expect(dealer.brands).toEqual([...TP5_DEALER_BRANDS]);
    expect(dealer.turnaround).toBe("⏱️ Izpilde: 24-48h");
    expect(dealer.footnote).toContain("ja dati ir pieejami");
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
  });
});
