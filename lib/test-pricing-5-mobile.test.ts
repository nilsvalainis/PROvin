import { describe, expect, it } from "vitest";
import {
  getTp5MobileService,
  getTp5MobileServices,
  getTp5MobileTurnaround,
  TP5_CORE_FEATURE_ROW_COUNT,
  TP5_DEALER_BRANDS,
  TP5_FULL_FEATURE_NAMES_LV,
  TP5_MOBILE_CHECKOUT_PLAN,
  TP5_MOBILE_SERVICES,
  TP5_MOBILE_SERVICE_ORDER,
} from "@/lib/test-pricing-5-mobile";
import { getTestPricingPlan } from "@/lib/test-pricing-plans";

describe("test-pricing-5 mobile three-tier model", () => {
  it("exposes mini, audits and dealer", () => {
    expect(TP5_MOBILE_SERVICE_ORDER).toEqual(["mini", "audits", "dealer"]);
    expect(TP5_MOBILE_SERVICES).toHaveLength(3);
    expect(TP5_MOBILE_CHECKOUT_PLAN.mini).toBe("plus");
    expect(TP5_MOBILE_CHECKOUT_PLAN.audits).toBe("premium");
    expect(TP5_MOBILE_CHECKOUT_PLAN.dealer).toBe("dealer");
  });

  it("shows exactly four core rows on every card", () => {
    expect(TP5_CORE_FEATURE_ROW_COUNT).toBe(4);
    for (const id of TP5_MOBILE_SERVICE_ORDER) {
      expect(getTp5MobileService(id).features).toHaveLength(4);
      expect(getTp5MobileService(id).features.every((f) => f.included)).toBe(true);
    }
  });

  it("keeps AUDITS modal as full eleven included services", () => {
    const audits = getTp5MobileService("audits");
    expect(audits.description).toContain("Pilnīgākais");
    expect(audits.modalFeatures).toHaveLength(11);
    expect(audits.modalFeatures.map((f) => f.name)).toEqual([...TP5_FULL_FEATURE_NAMES_LV]);
    expect(audits.modalFeatures.every((f) => f.included)).toBe(true);
    expect(audits.modalTrigger).toContain("11");
  });

  it("keeps MINI modal with five included and six excluded, Latvia long-use copy", () => {
    const mini = getTp5MobileService("mini");
    expect(mini.description).toContain("ilgstoši ekspluatētām");
    expect(mini.modalFeatures).toHaveLength(11);
    expect(mini.modalFeatures.filter((f) => f.included)).toHaveLength(5);
    expect(mini.modalFeatures.filter((f) => !f.included)).toHaveLength(6);
  });

  it("maps dealer core + modal detail and brands", () => {
    const dealer = getTp5MobileService("dealer");
    expect(dealer.features[0]?.name).toContain("Tiešā piekļuve");
    expect(dealer.extraNote).toContain("100%");
    expect(dealer.modalFeatures.map((f) => f.name)).toEqual([
      "Odometra rādījumi",
      "Servisa vēsture",
      "Apkopju intervāli",
      "Kopsavilkums",
      "Izsoļu portālu arhīva dati*",
    ]);
    expect(dealer.brands).toEqual([...TP5_DEALER_BRANDS]);
    expect(getTp5MobileTurnaround()).toContain("24-72h");
  });

  it("keeps English structure aligned with Latvian", () => {
    const lv = getTp5MobileServices();
    const en = getTp5MobileServices("en");
    expect(en.map((s) => s.id)).toEqual(lv.map((s) => s.id));
    en.forEach((service, index) => {
      expect(service.features).toHaveLength(lv[index]!.features.length);
      expect(service.modalFeatures).toHaveLength(lv[index]!.modalFeatures.length);
    });
  });

  it("maps checkout tiers to Stripe plan amounts", () => {
    expect(getTestPricingPlan(TP5_MOBILE_CHECKOUT_PLAN.mini)!.amountCents).toBe(3999);
    expect(getTestPricingPlan(TP5_MOBILE_CHECKOUT_PLAN.audits)!.amountCents).toBe(9999);
    expect(getTestPricingPlan(TP5_MOBILE_CHECKOUT_PLAN.dealer)!.amountCents).toBe(2499);
  });
});
