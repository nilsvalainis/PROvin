import { describe, expect, it } from "vitest";
import {
  isPublicSiteAnalyticsHost,
  isPublicSiteAnalyticsPath,
  shouldEnablePublicSiteAnalytics,
} from "./analytics-public-scope";

describe("isPublicSiteAnalyticsPath", () => {
  it("ļauj publiskās lapas", () => {
    expect(isPublicSiteAnalyticsPath("/")).toBe(true);
    expect(isPublicSiteAnalyticsPath("/lv")).toBe(true);
    expect(isPublicSiteAnalyticsPath("/lv/pakalpojumi")).toBe(true);
    expect(isPublicSiteAnalyticsPath("/en/blog/foo")).toBe(true);
    expect(isPublicSiteAnalyticsPath("/lv/partneriem/konts")).toBe(true);
  });

  it("izslēdz admin un demo", () => {
    expect(isPublicSiteAnalyticsPath("/admin")).toBe(false);
    expect(isPublicSiteAnalyticsPath("/admin/iriss/pasutijumi")).toBe(false);
    expect(isPublicSiteAnalyticsPath("/lv/demo")).toBe(false);
    expect(isPublicSiteAnalyticsPath("/en/demo/something")).toBe(false);
    expect(isPublicSiteAnalyticsPath("/api/checkout")).toBe(false);
  });
});

describe("isPublicSiteAnalyticsHost", () => {
  it("izslēdz demo apakšdomēnu", () => {
    expect(isPublicSiteAnalyticsHost("www.provin.lv")).toBe(true);
    expect(isPublicSiteAnalyticsHost("provin.lv")).toBe(true);
    expect(isPublicSiteAnalyticsHost("demo.provin.lv")).toBe(false);
  });
});

describe("shouldEnablePublicSiteAnalytics", () => {
  it("apvieno ceļu un hostu", () => {
    expect(shouldEnablePublicSiteAnalytics("/lv", "www.provin.lv")).toBe(true);
    expect(shouldEnablePublicSiteAnalytics("/lv", "demo.provin.lv")).toBe(false);
    expect(shouldEnablePublicSiteAnalytics("/admin", "www.provin.lv")).toBe(false);
  });
});
