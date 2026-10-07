import { describe, expect, it } from "vitest";
import { isApexHostname, resolveLegacyAliasRedirect, wwwOrigin } from "@/lib/seo-redirects";
import { INDEXABLE_PUBLIC_PATHS, LEGACY_PATH_ALIASES } from "@/lib/seo-public-paths";
import { stripLocalePrefix } from "@/i18n/locales";

describe("seo redirects", () => {
  it("maps legacy English and sample paths to canonical Latvian slugs", () => {
    expect(resolveLegacyAliasRedirect("/faq")).toBe("/lv/biezi-jautajumi");
    expect(resolveLegacyAliasRedirect("/en/about")).toBe("/en/par-mums");
    expect(resolveLegacyAliasRedirect("/de/samples")).toBe("/de/pakalpojumi");
    expect(resolveLegacyAliasRedirect("/ru/paraugi")).toBe("/ru/pakalpojumi");
    expect(resolveLegacyAliasRedirect("/lv/pakalpojumi")).toBeNull();
  });

  it("treats the apex host as www-bound", () => {
    expect(isApexHostname("provin.lv")).toBe(true);
    expect(isApexHostname("www.provin.lv")).toBe(false);
    const dest = wwwOrigin(new URL("http://provin.lv/pakalpojumi"));
    expect(dest.origin).toBe("https://www.provin.lv");
    expect(dest.pathname).toBe("/pakalpojumi");
  });

  it("keeps FAQ and VIN landing in the indexable path list", () => {
    const paths = INDEXABLE_PUBLIC_PATHS.map((p) => p.path);
    expect(paths).toContain("/biezi-jautajumi");
    expect(paths).toContain("/vin-koda-parbaude");
    expect(paths).toContain("/partneriem");
    expect(LEGACY_PATH_ALIASES["/faq"]).toBe("/biezi-jautajumi");
  });
});

describe("stripLocalePrefix", () => {
  it("strips lv, en, de and ru", () => {
    expect(stripLocalePrefix("/de/pakalpojumi")).toBe("/pakalpojumi");
    expect(stripLocalePrefix("/ru/biezi-jautajumi")).toBe("/biezi-jautajumi");
    expect(stripLocalePrefix("/lv")).toBe("/");
    expect(stripLocalePrefix("/pakalpojumi")).toBe("/pakalpojumi");
  });
});
