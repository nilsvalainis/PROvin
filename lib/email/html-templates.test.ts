import { describe, expect, it } from "vitest";
import { listingPeekCustomerCommentHtml, partnerVerifyEmailHtml, adminNewPartnerHtml } from "@/lib/email/html-templates";

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

describe("partnerVerifyEmailHtml", () => {
  it("includes a one-time confirmation CTA without leaking extra copy", () => {
    const html = partnerVerifyEmailHtml({
      verifyUrl: "https://provin.lv/lv/partneriem/apstiprinat?token=ver_abc",
      locale: "lv",
      purpose: "signup",
    });
    expect(html).toContain("Apstipriniet e-pastu");
    expect(html).toContain("https://provin.lv/lv/partneriem/apstiprinat?token=ver_abc");
    expect(html).toContain("24 stundas");
  });
});

describe("adminNewPartnerHtml", () => {
  it("lists the new partner and links to admin", () => {
    const html = adminNewPartnerHtml({
      adminUrl: "https://provin.lv/admin/partneri/ptr_0123456789abcdef",
      lines: [
        { label: "Uzņēmums", value: "SIA Demo Auto" },
        { label: "E-pasts", value: "demo@salon.lv" },
      ],
    });
    expect(html).toContain("Jauns B2B partneris");
    expect(html).toContain("SIA Demo Auto");
    expect(html).toContain("https://provin.lv/admin/partneri/ptr_0123456789abcdef");
    expect(html).toContain("Atvērt partneri adminā");
    expect(html).not.toContain("\u2014");
    expect(html).not.toContain("\u2013");
  });
});
