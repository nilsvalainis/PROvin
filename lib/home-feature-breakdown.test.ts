import { describe, expect, it } from "vitest";
import {
  HERO_CHECKOUT_TAB_IDS,
  HERO_CHECKOUT_TAB_MAX,
  homeHeroCheckoutHref,
  parseHeroPlanParam,
} from "@/lib/home-hero-plan";
import {
  catalogPackageAnchorId,
  getCatalogFeatureBreakdownPackages,
} from "@/lib/home-feature-breakdown";
import { buildSiteRailSections, siteRailActiveFromHash, siteRailRouteActiveIndex } from "@/lib/site-rail-sections";

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
    expect(pkgs.map((p) => p.id)).toEqual(["audits", "mini", "dealer", "koreaUsa"]);
    const dealer = pkgs.find((p) => p.id === "dealer")!;
    expect(dealer.title).toBe("DĪLERA DATI");
    expect(dealer.items).toHaveLength(4);
    expect(dealer.goal).toContain("autorizēto servisu");
    expect(dealer.sampleReportHref).toContain("dilera");
    const mini = pkgs.find((p) => p.id === "mini")!;
    expect(mini.sampleReportHref).toContain("provin-mini-piemers");
    const koreaUsa = pkgs.find((p) => p.id === "koreaUsa")!;
    expect(koreaUsa.title).toBe("ASV UN KOREJA");
    expect(koreaUsa.buttonText).toContain("19,99");
    expect(koreaUsa.items).toHaveLength(4);
    expect(koreaUsa.items[1]?.title).toContain("Izsoļu");
  });

  it("builds stable section anchors for jump pills (scales with catalog size)", () => {
    const pkgs = getCatalogFeatureBreakdownPackages();
    expect(pkgs.map((p) => catalogPackageAnchorId(p.id))).toEqual([
      "pakalpojums-audits",
      "pakalpojums-mini",
      "pakalpojums-dealer",
      "pakalpojums-koreaUsa",
    ]);
  });

  it("keeps Par PROVIN in the site rail as its own page", () => {
    const sections = buildSiteRailSections("/");
    const keys = sections.map((s) => s.labelKey);
    expect(keys).toContain("pakalpojumi");
    expect(keys).not.toContain("paraugi");
    expect(keys).toContain("kasSlapjasAizProvin");
    expect(keys).toContain("blogs");
    expect(keys).toContain("b2b");
    expect(keys.indexOf("kasSlapjasAizProvin")).toBeGreaterThan(keys.indexOf("pakalpojumi"));
    expect(keys.indexOf("b2b")).toBeGreaterThan(keys.indexOf("blogs"));
    expect(keys).not.toContain("buj");
    expect(keys).not.toContain("kontakti");
    expect(sections.find((s) => s.labelKey === "pakalpojumi")?.href).toBe("/pakalpojumi");
    expect(sections.find((s) => s.labelKey === "kasSlapjasAizProvin")?.href).toBe("/par-mums");
    expect(sections.find((s) => s.labelKey === "b2b")?.href).toBe("/partneriem");
    expect(siteRailRouteActiveIndex("/pakalpojumi")).toBe(keys.indexOf("pakalpojumi"));
    expect(siteRailRouteActiveIndex("/paraugi")).toBe(keys.indexOf("pakalpojumi"));
    expect(siteRailActiveFromHash("paraugi")).toBe(keys.indexOf("pakalpojumi"));
    expect(siteRailActiveFromHash("paraugs-fordGalaxy")).toBe(keys.indexOf("pakalpojumi"));
    expect(siteRailRouteActiveIndex("/par-mums")).toBe(keys.indexOf("kasSlapjasAizProvin"));
    expect(siteRailRouteActiveIndex("/blogs")).toBe(keys.indexOf("blogs"));
    expect(siteRailRouteActiveIndex("/partneriem")).toBe(keys.indexOf("b2b"));
    expect(siteRailRouteActiveIndex("/partneriem/konts")).toBe(keys.indexOf("b2b"));
    expect(siteRailRouteActiveIndex("/partneriem/konts/pasutijumi")).toBe(keys.indexOf("b2b"));
    expect(siteRailRouteActiveIndex("/partneriem/konts/rekviziti")).toBe(keys.indexOf("b2b"));
  });
});
