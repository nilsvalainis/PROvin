import { describe, expect, it } from "vitest";
import {
  getTp5MobileService,
  TP5_MOBILE_CHECKOUT_PLAN,
  TP5_MOBILE_SERVICES,
  TP5_MOBILE_SERVICE_ORDER,
} from "@/lib/test-pricing-5-mobile";

describe("test-pricing-5 mobile two-tier model", () => {
  it("exposes mini and audits only", () => {
    expect(TP5_MOBILE_SERVICE_ORDER).toEqual(["mini", "audits"]);
    expect(TP5_MOBILE_SERVICES).toHaveLength(2);
    expect(TP5_MOBILE_CHECKOUT_PLAN.mini).toBe("plus");
    expect(TP5_MOBILE_CHECKOUT_PLAN.audits).toBe("premium");
  });

  it("maps MINI to three included and four excluded features", () => {
    const mini = getTp5MobileService("mini");
    expect(mini.title).toBe("PROVIN MINI");
    expect(mini.buttonText).toBe("PASŪTĪT MINI AUDITU — 39,99 €");
    expect(mini.features.filter((feature) => feature.included)).toHaveLength(3);
    expect(mini.features.filter((feature) => !feature.included)).toHaveLength(4);
  });

  it("maps AUDITS to all seven included features", () => {
    const audits = getTp5MobileService("audits");
    expect(audits.title).toBe("PROVIN AUDITS");
    expect(audits.description).toContain("oficiālā dīlera sistēmu datus");
    expect(audits.buttonText).toBe("PASŪTĪT PROVIN AUDITU — 89,99 €");
    expect(audits.features.every((feature) => feature.included)).toBe(true);
  });
});
