import { describe, expect, it } from "vitest";
import {
  HERO_CHECKOUT_TAB_IDS,
  HERO_CHECKOUT_TAB_MAX,
  homeHeroCheckoutHref,
  parseHeroPlanParam,
} from "@/lib/home-hero-plan";
import {
  catalogPackageAnchorId,
  catalogPackageNavLines,
  getCatalogFeatureBreakdownPackages,
} from "@/lib/home-feature-breakdown";
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
      "pakalpojums-mini",
      "pakalpojums-audits",
      "pakalpojums-dealer",
      "pakalpojums-koreaUsa",
    ]);
  });

  it("uses consistent two-line jump-tab labels", () => {
    for (const id of ["mini", "audits", "dealer", "koreaUsa"] as const) {
      const lines = catalogPackageNavLines(id, "lv");
      expect(lines).toHaveLength(2);
      expect(lines[0]?.length).toBeGreaterThan(0);
      expect(lines[1]?.length).toBeGreaterThan(0);
    }
    expect(catalogPackageNavLines("koreaUsa", "lv")).toEqual(["ASV UN", "KOREJA"]);
    expect(catalogPackageNavLines("dealer", "en")).toEqual(["DEALER", "DATA"]);
  });

  it("keeps Par mums in the site rail as its own page", () => {
    const sections = buildSiteRailSections("/");
    const keys = sections.map((s) => s.labelKey);
    expect(keys).toContain("pakalpojumi");
    expect(keys).toContain("kasSlapjasAizProvin");
    expect(keys).toContain("blogs");
    expect(keys.indexOf("kasSlapjasAizProvin")).toBeGreaterThan(keys.indexOf("pakalpojumi"));
    expect(keys).not.toContain("buj");
    expect(keys).not.toContain("kontakti");
    expect(sections.find((s) => s.labelKey === "kasSlapjasAizProvin")?.href).toBe("/par-mums");
    expect(siteRailRouteActiveIndex("/pakalpojumi")).toBe(keys.indexOf("pakalpojumi"));
    expect(siteRailRouteActiveIndex("/par-mums")).toBe(keys.indexOf("kasSlapjasAizProvin"));
    expect(siteRailRouteActiveIndex("/blogs")).toBe(keys.indexOf("blogs"));
  });
});
