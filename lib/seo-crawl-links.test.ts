import { describe, expect, it } from "vitest";
import { blogSlugFromPublicPath } from "@/lib/blog/crawlable-locales";
import { hrefSelectsPlan, isNoindexSamplePdfHref, publicAnchorRel } from "@/lib/seo-crawl-links";

describe("publicAnchorRel", () => {
  it("keeps plan preselect links usable and adds nofollow", () => {
    expect(hrefSelectsPlan("/?plan=dealer#home-hero")).toBe(true);
    expect(hrefSelectsPlan("/lv?plan=audits#home-hero")).toBe(true);
    expect(hrefSelectsPlan("/lv#home-hero")).toBe(false);
    expect(publicAnchorRel("/?plan=dealer#home-hero")).toBe("nofollow");
    expect(publicAnchorRel("/en?plan=mini")).toBe("nofollow");
  });

  it("adds nofollow to sample PDFs without dropping the existing rel", () => {
    expect(isNoindexSamplePdfHref("/samples/provin-audits-piemers.pdf")).toBe(true);
    expect(isNoindexSamplePdfHref("/samples/provin-audits-bmw-525-e61-v2.pdf")).toBe(true);
    expect(isNoindexSamplePdfHref("/samples/provin-dilera-dati-piemers.pdf")).toBe(true);
    expect(publicAnchorRel("/samples/provin-audits-piemers.pdf", "noopener noreferrer")).toBe(
      "noopener noreferrer nofollow",
    );
    expect(isNoindexSamplePdfHref("/pakalpojumi#paraugi")).toBe(false);
    expect(publicAnchorRel("/partneriem")).toBeUndefined();
  });

  it("reads a blog slug only from a post path", () => {
    expect(blogSlugFromPublicPath("/blogs/ka-pirkt-lietotu-auto-bez-tabu")).toBe(
      "ka-pirkt-lietotu-auto-bez-tabu",
    );
    expect(blogSlugFromPublicPath("/blogs")).toBeNull();
    expect(blogSlugFromPublicPath("/lv/blogs/ka-pirkt-lietotu-auto-bez-tabu")).toBeNull();
  });
});
