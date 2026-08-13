import { describe, expect, it } from "vitest";
import { buildPublicPageMetadata, openGraphLocale, publicPageAlternates, publicPageUrl } from "@/lib/seo-public-metadata";

describe("seo-public-metadata", () => {
  it("canonical + hreflang point at the same path in both locales", () => {
    const alt = publicPageAlternates("lv", "/pakalpojumi");
    expect(alt.canonical).toBe(publicPageUrl("lv", "/pakalpojumi"));
    expect(alt.languages).toMatchObject({
      lv: publicPageUrl("lv", "/pakalpojumi"),
      en: publicPageUrl("en", "/pakalpojumi"),
      "x-default": publicPageUrl("lv", "/pakalpojumi"),
    });
  });

  it("openGraph locale follows the page locale", () => {
    expect(openGraphLocale("lv")).toBe("lv_LV");
    expect(openGraphLocale("en")).toBe("en_GB");
  });

  it("buildPublicPageMetadata sets per-page canonical, not the homepage", () => {
    const meta = buildPublicPageMetadata({
      locale: "lv",
      path: "/biezi-jautajumi",
      title: "BUJ",
      description: "Jautājumi",
    });
    expect(meta.alternates?.canonical).toBe(publicPageUrl("lv", "/biezi-jautajumi"));
    expect(String(meta.alternates?.canonical)).not.toMatch(/\/lv$/);
  });
});
