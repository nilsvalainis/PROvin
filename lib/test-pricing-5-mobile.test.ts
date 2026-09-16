import { describe, expect, it } from "vitest";
import {
  getTp5MobileCardTitle,
  getTp5MobileCtaLabel,
  getTp5MobileService,
  getTp5MobileServices,
  getTp5MobileTabTitle,
  getTp5MobileTurnaround,
  getTp5HeroTabServices,
  isTp5PublicServiceId,
  TP5_DEALER_BRAND_ROWS,
  TP5_DEALER_BRANDS,
  TP5_DEALER_BRANDS_WITH_LOGO,
  TP5_KOREA_USA_PUBLIC,
  TP5_MOBILE_CHECKOUT_PLAN,
  TP5_MOBILE_FEATURE_ROW_COUNT,
  TP5_MOBILE_SERVICES,
  TP5_MOBILE_SERVICE_ORDER,
} from "@/lib/test-pricing-5-mobile";
import { TP5_DEALER_SAMPLE_REPORT_HREF, TP5_MINI_SAMPLE_REPORT_HREF } from "@/lib/test-pricing-5-ui-copy";
import { getTestPricingPlan } from "@/lib/test-pricing-plans";

const SHARED_COMPARE_ROWS_LV = [
  "Konsultācija un ieteikumi klātienes apskatei",
  "Apdrošinātāju dati un tehnisko apskašu vēsture",
  "Sludinājuma, pārdevēja un tehnisko risku analīze",
  "CarVertical + AutoDNA + Izcelsmes valsts reģistri",
  "Oficiālo dīleru un izsoļu portālu arhīva dati*",
];

describe("test-pricing-5 mobile three-tier model", () => {
  it("exposes mini, audits, dealer and catalog koreaUsa (koreaUsa kept in catalog, public visibility gated)", () => {
    expect(TP5_MOBILE_SERVICE_ORDER).toEqual(["mini", "audits", "dealer", "koreaUsa"]);
    expect(TP5_MOBILE_SERVICES).toHaveLength(4);
    expect(TP5_MOBILE_CHECKOUT_PLAN.mini).toBe("plus");
    expect(TP5_MOBILE_CHECKOUT_PLAN.audits).toBe("premium");
    expect(TP5_MOBILE_CHECKOUT_PLAN.dealer).toBe("dealer");
    expect(TP5_MOBILE_CHECKOUT_PLAN.koreaUsa).toBe("koreaUsa");
  });

  it("hides koreaUsa from public hero tabs while keeping the service definition", () => {
    expect(TP5_KOREA_USA_PUBLIC).toBe(false);
    expect(isTp5PublicServiceId("koreaUsa")).toBe(false);
    expect(isTp5PublicServiceId("dealer")).toBe(true);
    expect(getTp5HeroTabServices("koreaUsa").map((s) => s.id)).toEqual(["mini", "audits", "dealer"]);
    expect(getTp5MobileService("koreaUsa").title).toBe("ASV UN KOREJA");
  });

  it("keeps a five-row checklist on MINI/AUDITS and dealer", () => {
    expect(TP5_MOBILE_FEATURE_ROW_COUNT).toBe(5);
    expect(getTp5MobileService("mini").features).toHaveLength(5);
    expect(getTp5MobileService("audits").features).toHaveLength(5);
    expect(getTp5MobileService("dealer").features).toHaveLength(5);
  });

  it("maps AUDITS and MINI as the same compare stack without flag emojis", () => {
    const mini = getTp5MobileService("mini");
    const audits = getTp5MobileService("audits");
    expect(audits.description).toBe("");
    expect(mini.description).toBe("");
    expect(audits.recommended).toBe(true);
    expect(audits.features.map((f) => f.name)).toEqual(SHARED_COMPARE_ROWS_LV);
    expect(mini.features.map((f) => f.name)).toEqual(SHARED_COMPARE_ROWS_LV);
    expect(audits.features.every((f) => f.included)).toBe(true);
    expect(mini.features.filter((f) => f.included)).toHaveLength(3);
    expect(mini.features.filter((f) => !f.included)).toHaveLength(2);
    expect(mini.features.some((f) => f.name.includes("CSDD"))).toBe(false);
  });

  it("maps dealer to five checklist rows, brands before the guarantee", () => {
    const dealer = getTp5MobileService("dealer");
    expect(dealer.title).toBe("DĪLERA DATI");
    expect(getTp5MobileTabTitle(dealer)).toBe("DĪLERI");
    expect(getTp5MobileCardTitle(dealer)).toBe("OFICIĀLO DĪLERU DATI");
    expect(getTp5MobileCtaLabel(dealer, true)).toBe("PASŪTĪT 24,99 €");
    expect(dealer.description).toBe("");
    expect(dealer.features.map((f) => f.name)).toEqual([
      "Servisa un apkopju vēsture*",
      "Odometra rādījumi",
      "Kopsavilkums",
      "Atbalstītie ražotāji",
      "100% Naudas atmaksas garantija.",
    ]);
    expect(dealer.features.map((f) => f.tone)).toEqual([
      undefined,
      undefined,
      undefined,
      "brands",
      "guarantee",
    ]);
    expect(dealer.features.every((f) => f.included)).toBe(true);
    expect(getTp5MobileService("dealer", "en").features.map((f) => f.name)).toEqual([
      "Service and maintenance history*",
      "Odometer readings",
      "Summary",
      "Supported manufacturers",
      "100% money-back guarantee.",
    ]);
    expect(dealer.extraNote).toBeUndefined();
    expect(TP5_DEALER_BRAND_ROWS).toEqual([
      [
        "Audi",
        "Bentley",
        "BMW",
        "CUPRA",
        "Ford",
        "Infiniti",
        "Jaguar",
        "Lamborghini",
        "Land Rover",
        "Lexus",
        "Mazda",
        "Mercedes-Benz",
        "MINI",
        "Nissan",
        "Opel",
        "Porsche",
        "SEAT",
        "Škoda",
        "Toyota",
        "Vauxhall",
        "Volkswagen",
        "Volvo",
      ],
      [
        "Abarth",
        "Alfa Romeo",
        "Citroën",
        "Dacia",
        "Fiat",
        "Genesis",
        "Hyundai",
        "Jeep",
        "Kia",
        "Lancia",
        "Peugeot",
        "Polestar",
        "Renault",
        "Smart",
      ],
      [
        "Alpine",
        "Aston Martin",
        "DS Automobiles",
        "Ferrari",
        "Honda",
        "Lotus",
        "Maserati",
        "MG",
        "Mitsubishi",
        "Rolls-Royce",
        "Subaru",
        "Suzuki",
      ],
    ]);
    expect(TP5_DEALER_BRANDS).toHaveLength(48);
    expect(TP5_DEALER_BRANDS_WITH_LOGO).toHaveLength(48);
    expect(dealer.brands).toEqual([...TP5_DEALER_BRANDS]);
    expect(dealer.turnaround).toBe("⏱️ Izpilde: 24h");
    expect(getTp5MobileService("dealer", "en").turnaround).toBe("⏱️ Delivery: 24h");
    expect(TP5_DEALER_SAMPLE_REPORT_HREF).toBe("/samples/provin-dilera-dati-piemers.pdf");
    expect(TP5_MINI_SAMPLE_REPORT_HREF).toBe("/samples/provin-mini-piemers.pdf");
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
    expect(getTp5MobileTabTitle(getTp5MobileService("dealer", "en"))).toBe("DEALERS");
    expect(getTp5MobileCardTitle(getTp5MobileService("dealer", "en"))).toBe("OFFICIAL DEALER DATA");
    expect(getTp5MobileTurnaround("en")).toContain("24-72h");
    expect(lv.every((service) => !service.buttonText.includes("\u2014"))).toBe(true);
    expect(en.every((service) => !service.buttonText.includes("\u2014"))).toBe(true);
  });

  it("maps checkout tiers to Stripe plan amounts", () => {
    const miniPlan = getTestPricingPlan(TP5_MOBILE_CHECKOUT_PLAN.mini)!;
    const auditsPlan = getTestPricingPlan(TP5_MOBILE_CHECKOUT_PLAN.audits)!;
    const dealerPlan = getTestPricingPlan(TP5_MOBILE_CHECKOUT_PLAN.dealer)!;
    const koreaUsaPlan = getTestPricingPlan(TP5_MOBILE_CHECKOUT_PLAN.koreaUsa)!;
    expect(miniPlan.amountCents).toBe(3999);
    expect(auditsPlan.amountCents).toBe(9999);
    expect(dealerPlan.amountCents).toBe(2499);
    expect(koreaUsaPlan.amountCents).toBe(1999);
  });
});
