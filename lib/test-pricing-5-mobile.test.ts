import { describe, expect, it } from "vitest";
import {
  getTp5MobileService,
  TP5_MOBILE_CHECKOUT_PLAN,
  TP5_MOBILE_SERVICES,
  TP5_MOBILE_SERVICE_ORDER,
} from "@/lib/test-pricing-5-mobile";

const FULL_FEATURE_STACK = [
  "Sludinājuma un tehnisko risku analīze",
  "EU reģistru pārbaude & TA vēsture",
  "Ieteikumi klātienes apskatei",
  "carVertical integrācija",
  "autoDNA integrācija",
  "Oficiālo dīleru dati*",
  "Individuāla konsultācija",
];

describe("test-pricing-5 mobile two-tier model", () => {
  it("exposes mini and audits only", () => {
    expect(TP5_MOBILE_SERVICE_ORDER).toEqual(["mini", "audits"]);
    expect(TP5_MOBILE_SERVICES).toHaveLength(2);
    expect(TP5_MOBILE_CHECKOUT_PLAN.mini).toBe("plus");
    expect(TP5_MOBILE_CHECKOUT_PLAN.audits).toBe("premium");
  });

  it("maps MINI to three active and four inactive rows in the full stack", () => {
    const mini = getTp5MobileService("mini");
    expect(mini.title).toBe("PROVIN MINI");
    expect(mini.buttonText).toBe("PASŪTĪT MINI AUDITU — 39,99 €");
    expect(mini.description).toContain("ilgāku laiku reģistrētiem auto");
    expect(mini.features).toHaveLength(7);
    expect(mini.features.map((feature) => feature.name)).toEqual(FULL_FEATURE_STACK);
    expect(mini.features.filter((feature) => feature.included)).toHaveLength(3);
    expect(mini.features.filter((feature) => !feature.included)).toHaveLength(4);
    expect(mini.features[3]?.included).toBe(false);
    expect(mini.features[3]?.name).toBe("carVertical integrācija");
  });

  it("maps AUDITS to all seven active rows in the full stack", () => {
    const audits = getTp5MobileService("audits");
    expect(audits.title).toBe("PROVIN AUDITS");
    expect(audits.description).toContain("oficiālā dīlera sistēmu datus");
    expect(audits.buttonText).toBe("PASŪTĪT PROVIN AUDITU — 89,99 €");
    expect(audits.features).toHaveLength(7);
    expect(audits.features.map((feature) => feature.name)).toEqual(FULL_FEATURE_STACK);
    expect(audits.features.every((feature) => feature.included)).toBe(true);
  });
});
