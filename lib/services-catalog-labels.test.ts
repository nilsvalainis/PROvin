import { describe, expect, it } from "vitest";
import { getCatalogFeatureBreakdownPackages } from "@/lib/home-feature-breakdown";
import { packagePriceLabel, packageShortLabel } from "@/lib/services-catalog-labels";

describe("ServicesCatalog labels", () => {
  it("reads the price from the CTA text in every locale", () => {
    for (const locale of ["lv", "en", "ru", "de"]) {
      const pkgs = getCatalogFeatureBreakdownPackages(locale);
      const audits = pkgs.find((p) => p.id === "audits")!;
      expect(packagePriceLabel(audits.buttonText)).toMatch(/99[.,]99/);
      const partner = pkgs.find((p) => p.id === "partner")!;
      expect(packagePriceLabel(partner.buttonText)).toBeNull();
    }
  });

  it("shortens PROVIN titles for the mobile segments", () => {
    expect(packageShortLabel("PROVIN AUDITS")).toBe("AUDITS");
    expect(packageShortLabel("DĪLERA DATI")).toBe("DĪLERA DATI");
  });
});
