import { describe, expect, it } from "vitest";
import {
  HERO_CHECKOUT_TAB_IDS,
  HERO_CHECKOUT_TAB_MAX,
  homeHeroCheckoutHref,
  parseHeroPlanParam,
} from "@/lib/home-hero-plan";
import { getCatalogFeatureBreakdownPackages } from "@/lib/home-feature-breakdown";
import { buildSiteRailSections, siteRailRouteActiveIndex } from "@/lib/site-rail-sections";

describe("home-hero-plan", () => {
  it("keeps hero tabs within the catalog deep-link cap", () => {
    expect(HERO_CHECKOUT_TAB_IDS.length).toBeLessThanOrEqual(HERO_CHECKOUT_TAB_MAX);
    expect(HERO_CHECKOUT_TAB_IDS).toEqual(["mini", "audits", "dealer", "koreaUsa"]);
  });

  it("parses plan query aliases", () => {
    expect(parseHeroPlanParam("dealer")).toBe("dealer");
    expect(parseHeroPlanParam("audit")).toBe("audits");
    expect(parseHeroPlanParam("nope")).toBeNull();
  });

  it("builds checkout deep-links", () => {
    expect(homeHeroCheckoutHref("mini")).toBe("/?plan=mini#home-hero");
  });
});

describe("pakalpojumi catalog", () => {
  it("exposes four detailed cards including dealer and koreaUsa", () => {
    const pkgs = getCatalogFeatureBreakdownPackages();
    expect(pkgs.map((p) => p.id)).toEqual(["mini", "audits", "dealer", "koreaUsa"]);
    const dealer = pkgs.find((p) => p.id === "dealer")!;
    expect(dealer.title).toBe("DĪLERA DATI");
    expect(dealer.items).toHaveLength(4);
    expect(dealer.goal).toContain("autorizēto servisu");
    expect(dealer.sampleReportHref).toContain("dilera");
    const koreaUsa = pkgs.find((p) => p.id === "koreaUsa")!;
    expect(koreaUsa.title).toBe("ASV UN KOREJA");
    expect(koreaUsa.buttonText).toContain("19,99");
    expect(koreaUsa.items).toHaveLength(4);
    expect(koreaUsa.items[1]?.title).toContain("Izsoļu");
  });

  it("adds Pakalpojumi to the site rail", () => {
    const sections = buildSiteRailSections("/");
    expect(sections.map((s) => s.labelKey)).toContain("pakalpojumi");
    expect(siteRailRouteActiveIndex("/pakalpojumi")).toBe(
      sections.findIndex((s) => s.labelKey === "pakalpojumi"),
    );
  });
});
