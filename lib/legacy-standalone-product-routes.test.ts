import { describe, expect, it } from "vitest";
import {
  normalizePathWithoutLocale,
  shouldBlockClosedExperimentPath,
  shouldBlockLegacyStandaloneProductPath,
} from "@/lib/legacy-standalone-product-routes";

describe("legacy standalone product routes", () => {
  it("normalizes locale-prefixed paths", () => {
    expect(normalizePathWithoutLocale("/lv/provin-audits")).toBe("/provin-audits");
    expect(normalizePathWithoutLocale("/en/provin-select")).toBe("/provin-select");
    expect(normalizePathWithoutLocale("/lv")).toBe("/");
  });

  it("blocks hidden standalone routes by default", () => {
    expect(shouldBlockLegacyStandaloneProductPath("/provin-audits")).toBe(true);
    expect(shouldBlockLegacyStandaloneProductPath("/lv/provin-audits")).toBe(true);
    expect(shouldBlockLegacyStandaloneProductPath("/provin-select")).toBe(true);
    expect(shouldBlockLegacyStandaloneProductPath("/lv/provin-select-pieteikums")).toBe(true);
    expect(shouldBlockLegacyStandaloneProductPath("/lv/pasutit")).toBe(false);
  });

  it("blocks closed experiment URLs including azvin and test-pricing-5", () => {
    expect(shouldBlockClosedExperimentPath("/test-pricing-5")).toBe(true);
    expect(shouldBlockClosedExperimentPath("/test-pricing")).toBe(true);
    expect(shouldBlockClosedExperimentPath("/test-checkout")).toBe(true);
    expect(shouldBlockClosedExperimentPath("/lv/demo/azvin")).toBe(true);
    expect(shouldBlockClosedExperimentPath("/en/demo")).toBe(true);
    expect(shouldBlockClosedExperimentPath("/silhouette-preview")).toBe(true);
    expect(shouldBlockClosedExperimentPath("/lv/pakalpojumi")).toBe(false);
  });

  it("does not close live public, checkout, or admin paths", () => {
    const live = [
      "/",
      "/lv",
      "/en",
      "/lv/pakalpojumi",
      "/lv/paraugi",
      "/lv/par-mums",
      "/lv/blogs",
      "/lv/pasutit",
      "/lv/partneriem",
      "/lv/partneriem/konts",
      "/lv/partneriem/konts/pasutijumi",
      "/lv/partneriem/konts/rekviziti",
      "/lv/paldies",
      "/lv/lietosanas-noteikumi",
      "/lv/privatuma-politika",
      "/admin",
      "/admin/dashboard",
      "/admin/login",
      "/admin/orders/cs_test",
      "/admin/iriss/pasutijumi",
      "/admin/konsultacijas",
      "/admin/commission-invoice",
      "/admin/partneri",
    ];
    for (const path of live) {
      expect(shouldBlockClosedExperimentPath(path)).toBe(false);
      expect(shouldBlockLegacyStandaloneProductPath(path)).toBe(false);
    }
  });
});
