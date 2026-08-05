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

const SHARED_COMPARE_ROWS_LV = [
  "Konsultācija un ieteikumi klātienes apskatei",
  "Apdrošinātāju dati un tehnisko apskašu vēsture",
  "Sludinājuma, pārdevēja un tehnisko risku analīze",
  "CarVertical + AutoDNA + EU reģistru pārbaude",
  "Oficiālo dīleru un izsoļu portālu arhīva dati*",
];

describe("test-pricing-5 mobile three-tier model", () => {
  it("exposes mini, audits and dealer", () => {
    expect(TP5_MOBILE_SERVICE_ORDER).toEqual(["mini", "audits", "dealer"]);
    expect(TP5_MOBILE_SERVICES).toHaveLength(3);
    expect(TP5_MOBILE_CHECKOUT_PLAN.mini).toBe("plus");
    expect(TP5_MOBILE_CHECKOUT_PLAN.audits).toBe("premium");
    expect(TP5_MOBILE_CHECKOUT_PLAN.dealer).toBe("dealer");
  });

  it("keeps a fixed five-row checklist on every tier", () => {
    expect(TP5_MOBILE_FEATURE_ROW_COUNT).toBe(5);
    for (const id of TP5_MOBILE_SERVICE_ORDER) {
      expect(getTp5MobileService(id).features).toHaveLength(5);
    }
  });

  it("maps AUDITS and MINI as the same compare stack with EU/LV framing", () => {
    const mini = getTp5MobileService("mini");
    const audits = getTp5MobileService("audits");
    expect(audits.description).toContain("Pilnīgākais");
    expect(audits.description).toContain("🇪🇺");
    expect(mini.description).toContain("Latvijā ekspluatētiem");
    expect(mini.description).toContain("🇱🇻");
    expect(audits.features.map((f) => f.name)).toEqual(SHARED_COMPARE_ROWS_LV);
    expect(mini.features.map((f) => f.name)).toEqual(SHARED_COMPARE_ROWS_LV);
    expect(audits.features.every((f) => f.included)).toBe(true);
    expect(mini.features.filter((f) => f.included)).toHaveLength(3);
    expect(mini.features.filter((f) => !f.included)).toHaveLength(2);
    expect(mini.features.some((f) => f.name.includes("CSDD"))).toBe(false);
  });

  it("maps dealer to data rows, guarantee, soft scope notes and brands-only tip data", () => {
    const dealer = getTp5MobileService("dealer");
    expect(dealer.title).toBe("DĪLERA DATI");
    expect(dealer.description).toContain("oficiālo dīleru");
    expect(dealer.description).toContain("🌐");
    expect(dealer.features.map((f) => f.name)).toEqual([
      "Servisa un apkopju vēsture",
      "Odometra rādījumi un kopsavilkums",
      "100% naudas atmaksa (ja dati nav pieejami)",
      "Bez PROVIN PDF vēstures audita",
      "Bez individuālas konsultācijas",
    ]);
    expect(dealer.features[2]?.tone).toBe("guarantee");
    expect(dealer.features[3]?.tone).toBe("soft");
    expect(dealer.features[4]?.tone).toBe("soft");
    expect(dealer.extraNote).toContain("2009");
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
      expect(service.features.map((feature) => feature.tone ?? "default")).toEqual(
        lv[index]!.features.map((feature) => feature.tone ?? "default"),
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
