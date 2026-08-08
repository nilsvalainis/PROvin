import { describe, expect, it } from "vitest";
import {
  getTp5DesktopHeroFeatures,
  TP5_DESKTOP_HERO_FEATURES,
} from "@/lib/test-pricing-5-desktop-hero-features";

describe("test-pricing-5 desktop hero features", () => {
  it("exposes eight feature labels for the full catalog", () => {
    expect(TP5_DESKTOP_HERO_FEATURES).toHaveLength(8);
    expect(TP5_DESKTOP_HERO_FEATURES[0]?.label).toBe("Individuāla konsultācija");
    expect(TP5_DESKTOP_HERO_FEATURES[6]?.label).toBe("Oficiālo dīleru un izsoļu portālu arhīvs*");
  });

  it("keeps four PROVIN MINI icons without history-vendor and archive marks", () => {
    const mini = getTp5DesktopHeroFeatures("lv", "mini");
    expect(mini.map((f) => f.icon)).toEqual([
      "consultation",
      "listing-analysis",
      "eu-registry",
      "inspection-tips",
    ]);
    expect(mini.some((f) => f.icon === "carvertical")).toBe(false);
    expect(mini.some((f) => f.icon === "autodna")).toBe(false);
    expect(mini.some((f) => f.icon === "international")).toBe(false);
    expect(mini.some((f) => f.icon === "dealer-data")).toBe(false);
  });

  it("keeps the full set for PROVIN AUDITS", () => {
    expect(getTp5DesktopHeroFeatures("lv", "audits")).toHaveLength(8);
  });
});
