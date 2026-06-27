import { describe, expect, it } from "vitest";
import { TP5_DESKTOP_HERO_FEATURES } from "@/lib/test-pricing-5-desktop-hero-features";

describe("test-pricing-5 desktop hero features", () => {
  it("exposes eight feature labels for the icon row", () => {
    expect(TP5_DESKTOP_HERO_FEATURES).toHaveLength(8);
    expect(TP5_DESKTOP_HERO_FEATURES[0]?.label).toBe("Individuāla konsultācija");
    expect(TP5_DESKTOP_HERO_FEATURES[6]?.label).toBe("Oficiālo dīleru un izsoļu portālu arhīvs*");
  });
});
