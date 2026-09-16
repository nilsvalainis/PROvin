import { describe, expect, it } from "vitest";
import {
  TP5_DEALER_BRANDS,
  TP5_DEALER_COVERAGE_TIERS,
  dealerBrandsHudDurationMs,
  type DealerCoverageTierId,
} from "@/lib/dealer-brands";
import { getDealerCoverageTierCopy, getTp5UiCopy } from "@/lib/test-pricing-5-ui-copy";

describe("dealer coverage tiers", () => {
  it("keeps 48 unique brands with Subaru in limited coverage", () => {
    const seen = new Set<string>();
    const byTier = new Map<string, DealerCoverageTierId>();
    for (const tier of TP5_DEALER_COVERAGE_TIERS) {
      for (const brand of tier.brands) {
        expect(seen.has(brand)).toBe(false);
        seen.add(brand);
        byTier.set(brand, tier.id);
      }
    }
    expect(seen.size).toBe(48);
    expect(TP5_DEALER_BRANDS).toHaveLength(48);
    expect(TP5_DEALER_BRANDS.length % 6).toBe(0);
    expect(TP5_DEALER_BRANDS.length % 8).toBe(0);
    expect([...seen].sort()).toEqual([...TP5_DEALER_BRANDS].sort());
    expect(byTier.get("Subaru")).toBe("limited");
    expect(byTier.get("BMW")).toBe("full");
    expect(byTier.get("Opel")).toBe("full");
    expect(byTier.get("Volvo")).toBe("full");
    expect(byTier.get("Alfa Romeo")).toBe("workshop");
    expect(byTier.get("Honda")).toBe("limited");
    expect(byTier.get("Polestar")).toBe("workshop");
  });

  it("puts the whole VW Group and every site brand into exactly one tier", () => {
    const byTier = new Map<string, DealerCoverageTierId>();
    for (const tier of TP5_DEALER_COVERAGE_TIERS) {
      for (const brand of tier.brands) byTier.set(brand, tier.id);
    }
    const vwGroup = [
      "Audi",
      "Bentley",
      "CUPRA",
      "Lamborghini",
      "Porsche",
      "SEAT",
      "Škoda",
      "Volkswagen",
    ];
    for (const brand of vwGroup) {
      expect(byTier.get(brand), brand).toBe("full");
    }
    /** Canonical 48 from the public site list (ownership order, Sep 2026). */
    const siteBrands = [
      "BMW",
      "MINI",
      "Rolls-Royce",
      "Mercedes-Benz",
      "Smart",
      "Volkswagen",
      "Audi",
      "Škoda",
      "SEAT",
      "CUPRA",
      "Porsche",
      "Bentley",
      "Lamborghini",
      "Volvo",
      "Polestar",
      "Jaguar",
      "Land Rover",
      "Toyota",
      "Lexus",
      "Ford",
      "Mazda",
      "Honda",
      "Nissan",
      "Infiniti",
      "Mitsubishi",
      "Subaru",
      "Suzuki",
      "Peugeot",
      "Citroën",
      "DS Automobiles",
      "Opel",
      "Vauxhall",
      "Fiat",
      "Abarth",
      "Alfa Romeo",
      "Lancia",
      "Jeep",
      "Renault",
      "Dacia",
      "Alpine",
      "Hyundai",
      "Kia",
      "Genesis",
      "Ferrari",
      "Maserati",
      "Aston Martin",
      "Lotus",
      "MG",
    ];
    expect(siteBrands).toHaveLength(48);
    expect([...TP5_DEALER_BRANDS].sort()).toEqual([...siteBrands].sort());
    expect(TP5_DEALER_COVERAGE_TIERS.map((t) => t.brands.length)).toEqual([22, 14, 12]);
    expect([...TP5_DEALER_BRANDS]).toEqual(
      TP5_DEALER_COVERAGE_TIERS.flatMap((tier) => [...tier.brands]),
    );
  });

  it("explains each coverage tier in Latvian and English", () => {
    const lv = getTp5UiCopy("lv");
    const en = getTp5UiCopy("en");
    expect(getDealerCoverageTierCopy(lv, "full").title).toBe("Pilna servisa vēsture");
    expect(getDealerCoverageTierCopy(en, "limited").title).toBe("Limited coverage");
    expect(getTp5UiCopy("de").dealerCoverageLimitedTitle).toBe("Limited coverage");
    expect(getTp5UiCopy("ru").dealerCoverageWorkshopTitle).toBe("Workshop remarks");
  });

  it("times the HUD read as 2.4s plus 28ms per following brand", () => {
    expect(dealerBrandsHudDurationMs(1)).toBe(2400);
    expect(dealerBrandsHudDurationMs(48)).toBe(2400 + 47 * 28);
  });
});
