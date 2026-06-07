import { describe, expect, it } from "vitest";
import {
  getTp5MobileFeatureLayout,
  TP5_MOBILE_CTA_LABEL,
  TP5_MOBILE_TAB_LABEL,
  TP5_MOBILE_TIER_META,
  TP5_MOBILE_TIER_ORDER,
} from "@/lib/test-pricing-5-mobile";

describe("test-pricing-5 mobile two-tier model", () => {
  it("exposes plus and premium only", () => {
    expect(TP5_MOBILE_TIER_ORDER).toEqual(["plus", "premium"]);
    expect(TP5_MOBILE_TAB_LABEL.plus).toBe("PROVIN MINI");
    expect(TP5_MOBILE_TAB_LABEL.premium).toBe("PROVIN AUDITS");
  });

  it("maps MINI to three active and four inactive features", () => {
    const { activeRows, inactiveRows } = getTp5MobileFeatureLayout("plus");
    expect(activeRows).toHaveLength(3);
    expect(inactiveRows).toHaveLength(4);
    expect(TP5_MOBILE_TIER_META.plus.description).toContain("Latvijā reģistrētiem auto");
    expect(TP5_MOBILE_CTA_LABEL.plus).toBe("PASŪTĪT MINI AUDITU — 39,99 €");
  });

  it("maps AUDITS to all seven active features", () => {
    const { activeRows, inactiveRows } = getTp5MobileFeatureLayout("premium");
    expect(activeRows).toHaveLength(7);
    expect(inactiveRows).toHaveLength(0);
    expect(TP5_MOBILE_CTA_LABEL.premium).toBe("PASŪTĪT PROVIN AUDITU — 89,99 €");
  });
});
