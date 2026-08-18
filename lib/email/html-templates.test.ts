import { describe, expect, it } from "vitest";
import { listingPeekCustomerCommentHtml } from "@/lib/email/html-templates";

const listingUrl = "https://www.ss.com/msg/lv/transport/cars/bmw/x5/abc.html";

describe("listingPeekCustomerCommentHtml", () => {
  it("includes the listing URL as a clickable link above the comment", () => {
    const html = listingPeekCustomerCommentHtml({
      comment: "Sveiki!\nIRISS",
      auditsUrl: "https://provin.lv/?plan=audits#home-hero",
      listingUrl,
    });
    expect(html).toMatch(/Sludinājums/);
    expect(html).toContain(`href="${listingUrl}"`);
    expect(html).toContain(listingUrl);
    expect(html.indexOf("Sludinājums")).toBeLessThan(html.indexOf("Sveiki!"));
  });

  it("omits javascript URLs", () => {
    const html = listingPeekCustomerCommentHtml({
      comment: "Sveiki!",
      auditsUrl: "https://provin.lv/?plan=audits",
      listingUrl: "javascript:alert(1)",
    });
    expect(html).not.toMatch(/javascript:/i);
    expect(html).not.toMatch(/>Sludinājums</);
  });
});
