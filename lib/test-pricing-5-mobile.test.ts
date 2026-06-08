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

  it("maps MINI to three active and five inactive audits features", () => {
    const mini = getTp5MobileService("mini");
    expect(mini.title).toBe("PROVIN MINI");
    expect(mini.buttonText).toBe("PASŪTĪT MINI AUDITU — 39,99 €");
    expect(mini.description).toContain("ilgāku laiku reģistrētiem auto");
    expect(mini.features.filter((feature) => feature.included)).toHaveLength(3);
    expect(mini.features.filter((feature) => !feature.included)).toHaveLength(5);
    expect(mini.features[1]?.name).toBe("EU reģistru pārbaude & TA vēsture");
    expect(mini.features[3]?.name).toBe("Auto vēstures pārbaude");
    expect(mini.features[3]?.included).toBe(false);
  });

  it("maps AUDITS to five active premium features", () => {
    const audits = getTp5MobileService("audits");
    expect(audits.title).toBe("PROVIN AUDITS");
    expect(audits.description).toContain("oficiālo dīleru datus");
    expect(audits.buttonText).toBe("PASŪTĪT PROVIN AUDITU — 89,99 €");
    expect(audits.features).toHaveLength(5);
    expect(audits.features.map((feature) => feature.name)).toEqual([
      "Auto vēstures pārbaude",
      "carVertical integrācija",
      "autoDNA integrācija",
      "Oficiālo dīleru dati*",
      "Individuāla konsultācija",
    ]);
    expect(audits.features.every((feature) => feature.included)).toBe(true);
  });
});
