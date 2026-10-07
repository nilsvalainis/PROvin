import { describe, expect, it } from "vitest";
import robots from "@/app/robots";
import { INDEXABLE_PUBLIC_PATHS } from "@/lib/seo-public-paths";

describe("robots.txt", () => {
  it("points at the sitemap and does not block CSS/JS", () => {
    const doc = robots();
    expect(doc.sitemap).toMatch(/\/sitemap\.xml$/);
    const disallow = doc.rules[0]?.disallow ?? [];
    expect(disallow).toEqual(expect.arrayContaining(["/_next/static/media/", "/admin", "/p/"]));
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
  });
});
