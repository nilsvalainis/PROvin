import { afterEach, describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import robots from "@/app/robots";
import { getBlogPost, isBlogLocaleIndexable } from "@/lib/blog/posts";
import { parsePrefixedPath } from "@/i18n/locales";
import { buildPublicPageMetadata } from "@/lib/seo-public-metadata";
import { sitemapLastModified, withSitemapTimeout } from "@/lib/seo-sitemap";
import {
  GSC_NOINDEX_SITEMAP_BLOCKLIST,
  GSC_REDIRECTING_INDEX_URLS,
  INDEXABLE_PUBLIC_LOCALES,
  INDEXABLE_PUBLIC_PATHS,
  NEVER_INDEX_PUBLIC_PATHS,
  isCanonicalSitemapHref,
  isIndexablePublicPage,
  publicPageRobots,
} from "@/lib/seo-public-paths";

describe("robots.txt", () => {
  it("points at the sitemap and does not block CSS/JS", () => {
    const doc = robots();
    expect(doc.sitemap).toMatch(/\/sitemap\.xml$/);
    const rules = Array.isArray(doc.rules) ? doc.rules : doc.rules ? [doc.rules] : [];
    const disallow = rules[0]?.disallow ?? [];
    expect(disallow).toEqual(expect.arrayContaining(["/admin", "/p/", "/a/", "/s/"]));
    // Fonti un attēli renderēšanai: Google tos drīkst ielādēt.
    expect(disallow).not.toContain("/_next/static/media/");
    expect(disallow).not.toContain("/s");
    expect(disallow).not.toContain("/p");
    expect(disallow).not.toContain("/icon");
    expect(disallow).not.toContain("/_next/");
    expect(disallow).not.toContain("/_next/static/");
  });
});

describe("sitemap paths", () => {
  it("includes FAQ, VIN landing and partner landing for every locale build", () => {
    const paths = INDEXABLE_PUBLIC_PATHS.map((p) => p.path);
    expect(paths).toEqual(
      expect.arrayContaining(["", "/biezi-jautajumi", "/vin-koda-parbaude", "/partneriem", "/pakalpojumi"]),
    );
    expect(paths.some((p) => p === "/s" || p.startsWith("/s/"))).toBe(false);
    expect([...INDEXABLE_PUBLIC_LOCALES]).toEqual(["lv", "en", "de", "ru"]);
  });

  it("does not list known noindex public paths", () => {
    const paths = INDEXABLE_PUBLIC_PATHS.map((p) => p.path);
    for (const blocked of NEVER_INDEX_PUBLIC_PATHS) {
      expect(paths).not.toContain(blocked);
      expect(isIndexablePublicPage("lv", blocked)).toBe(false);
      expect(publicPageRobots("lv", blocked).index).toBe(false);
    }
  });
});

function splitSitemapUrl(url: string): { locale: string; path: string } {
  const pathname = new URL(url).pathname.replace(/\/$/, "") || "/";
  const { locale, rest } = parsePrefixedPath(pathname);
  if (!locale) throw new Error(`sitemap URL missing locale prefix: ${url}`);
  return { locale, path: rest === "/" ? "" : rest };
}

describe("sitemap contains only indexable canonical URLs", () => {
  it("every loc and hreflang URL would render robots index, not noindex", async () => {
    const entries = await sitemap();
    expect(entries.length).toBeGreaterThan(0);

    const locs = entries.map((entry) => entry.url).filter((url): url is string => typeof url === "string");
    expect(locs.length).toBe(entries.length);
    expect(new Set(locs).size).toBe(locs.length);

    for (const entry of entries) {
      const listed = [entry.url, ...Object.values(entry.alternates?.languages ?? {})].filter(
        (url): url is string => typeof url === "string" && url.length > 0,
      );
      for (const url of listed) {
        const { locale, path } = splitSitemapUrl(url);
        if (path.startsWith("/blogs/") && path !== "/blogs") {
          const slug = path.slice("/blogs/".length);
          const post = await getBlogPost(slug);
          expect(post, `missing blog post for sitemap URL ${url}`).toBeTruthy();
          expect(isBlogLocaleIndexable(post!, locale)).toBe(true);
          continue;
        }
        expect(isIndexablePublicPage(locale, path)).toBe(true);
        expect(publicPageRobots(locale, path)).toEqual({ index: true, follow: true });
        const meta = buildPublicPageMetadata({
          locale,
          path,
          title: "t",
          description: "d",
        });
        expect(meta.robots).toEqual({ index: true, follow: true });
      }
    }

    for (const blocked of NEVER_INDEX_PUBLIC_PATHS) {
      expect(locs.some((url) => url.includes(blocked))).toBe(false);
    }
    for (const url of locs) {
      expect(isCanonicalSitemapHref(url)).toBe(true);
      const parsed = new URL(url);
      if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
        expect(parsed.protocol).toBe("http:");
      } else {
        expect(parsed.protocol).toBe("https:");
      }
      expect(parsed.search).toBe("");
      expect(url.includes("/paraugi")).toBe(false);
      expect(url.includes("/samples/")).toBe(false);
    }
    for (const blocked of [...GSC_REDIRECTING_INDEX_URLS, ...GSC_NOINDEX_SITEMAP_BLOCKLIST]) {
      expect(locs).not.toContain(blocked);
    }
  });

  it("keeps lv public pages in the sitemap", async () => {
    const entries = await sitemap();
    const locs = entries.map((entry) => entry.url).filter((url): url is string => typeof url === "string");
    for (const { path } of INDEXABLE_PUBLIC_PATHS) {
      expect(locs.some((url) => splitSitemapUrl(url).locale === "lv" && splitSitemapUrl(url).path === path)).toBe(
        true,
      );
    }
  });

  it("omits thin blog locales that render noindex", async () => {
    const entries = await sitemap();
    const blogLocs = entries
      .map((entry) => entry.url)
      .filter((url): url is string => typeof url === "string")
      .filter((url) => splitSitemapUrl(url).path.startsWith("/blogs/"));
    expect(blogLocs.some((url) => splitSitemapUrl(url).locale === "de")).toBe(false);
    expect(blogLocs.some((url) => splitSitemapUrl(url).locale === "ru")).toBe(false);
    expect(blogLocs.some((url) => splitSitemapUrl(url).locale === "en")).toBe(false);
    expect(blogLocs.some((url) => splitSitemapUrl(url).locale === "lv")).toBe(true);
  });
});

describe("isCanonicalSitemapHref", () => {
  const previous = process.env.NEXT_PUBLIC_SITE_URL;

  afterEach(() => {
    if (previous == null) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = previous;
  });

  it("accepts locale-prefixed https www URLs without a trailing slash", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://www.provin.lv";
    expect(isCanonicalSitemapHref("https://www.provin.lv/lv")).toBe(true);
    expect(isCanonicalSitemapHref("https://www.provin.lv/lv/vin-koda-parbaude")).toBe(true);
    expect(isCanonicalSitemapHref("https://www.provin.lv/de/partneriem")).toBe(true);
    expect(isCanonicalSitemapHref("https://www.provin.lv/ru/partneriem")).toBe(true);
  });

  it("rejects the GSC redirecting URL set from 02.11.2026", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://www.provin.lv";
    for (const url of GSC_REDIRECTING_INDEX_URLS) {
      expect(isCanonicalSitemapHref(url), url).toBe(false);
    }
  });

  it("rejects GSC noindex URLs that must stay out of the sitemap", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://www.provin.lv";
    for (const url of GSC_NOINDEX_SITEMAP_BLOCKLIST) {
      expect(isCanonicalSitemapHref(url), url).toBe(false);
    }
  });
});

describe("sitemap helpers", () => {
  it("drops invalid blog dates instead of emitting Invalid Date", () => {
    expect(sitemapLastModified("2026-10-30")?.toISOString()).toBe("2026-10-30T12:00:00.000Z");
    expect(sitemapLastModified("not-a-date")).toBeUndefined();
  });

  it("returns the fallback when the sitemap blog listing times out", async () => {
    const result = await withSitemapTimeout(new Promise<string[]>(() => undefined), 15, []);
    expect(result).toEqual([]);
  });
});

