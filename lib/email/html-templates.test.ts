import { describe, expect, it } from "vitest";
import {
  listingPeekCustomerCommentHtml,
  partnerPasswordResetEmailHtml,
  partnerVerifyEmailHtml,
  staffInviteEmailHtml,
  adminNewPartnerHtml,
  morningSummaryEmailHtml,
  adminAuditSlaWarningHtml,
} from "@/lib/email/html-templates";

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

  it("embeds operator photos by content id", () => {
    const html = listingPeekCustomerCommentHtml({
      comment: "Sveiki!",
      auditsUrl: "https://provin.lv/?plan=audits#home-hero",
      listingUrl,
      photoCids: ["peek-photo-11111111-1111-4111-8111-111111111111@provin.lv"],
    });
    expect(html).toContain("Fotogrāfijas");
    expect(html).toContain('src="cid:peek-photo-11111111-1111-4111-8111-111111111111@provin.lv"');
    expect(html.indexOf("Sveiki!")).toBeLessThan(html.indexOf("Fotogrāfijas"));
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

describe("partnerPasswordResetEmailHtml", () => {
  it("includes a one-time reset CTA", () => {
    const html = partnerPasswordResetEmailHtml({
      resetUrl: "https://provin.lv/lv/partneriem/parole?token=rst_abc",
      locale: "lv",
    });
    expect(html).toContain("Atjaunojiet paroli");
    expect(html).toContain("https://provin.lv/lv/partneriem/parole?token=rst_abc");
    expect(html).toContain("24 stundas");
    expect(html).not.toContain("\u2014");
    expect(html).not.toContain("\u2013");
  });
});

describe("staffInviteEmailHtml", () => {
  it("includes the one-time IRISS invite CTA without dashes", () => {
    const html = staffInviteEmailHtml({
      name: "Anna Piemere",
      inviteUrl: "https://www.provin.lv/admin/uzaicinajums/abc",
    });
    expect(html).toContain("IRISS pieeja");
    expect(html).toContain("https://www.provin.lv/admin/uzaicinajums/abc");
    expect(html).toContain("24 stundas");
    expect(html).not.toContain("\u2014");
    expect(html).not.toContain("\u2013");
  });
});

describe("adminAuditSlaWarningHtml", () => {
  it("warns about the 3 h audit SLA without IRISS LIST copy or dashes", () => {
    const html = adminAuditSlaWarningHtml({
      adminUrl: "https://www.provin.lv/admin/orders/cs_test",
      lines: [
        { label: "VIN", value: "WVWZZZ" },
        { label: "Atlicis", value: "2 h 10 min" },
      ],
    });
    expect(html).toContain("Līdz audita termiņam atlikušas 3 h vai mazāk");
    expect(html).toContain("WVWZZZ");
    expect(html).toContain("https://www.provin.lv/admin/orders/cs_test");
    expect(html).toContain("Pabeidz auditu, lai iekļautos termiņā");
    expect(html).not.toContain("\u2014");
    expect(html).not.toContain("\u2013");
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

describe("morningSummaryEmailHtml", () => {
  it("lists counts, deadlines and the admin page CTA", () => {
    const html = morningSummaryEmailHtml({
      dateLabel: "13. oktobris",
      pageUrl: "https://provin.lv/admin/kopsavilkums",
      open: 5,
      urgent: 1,
      overdue: 2,
      openAudits: 3,
      openPeeks: 2,
      newPeeksLast24h: 1,
      overdueAudits: [{ title: "Audi A4", detail: "Kavējas 3 h" }],
      dueTodayAudits: [{ title: "VINURGENT", detail: "1 h 0 min" }],
      newPeeks: [{ title: "ss.com", detail: "Jauns" }],
    });
    expect(html).toContain("Rīta kopsavilkums");
    expect(html).toContain("13. oktobris");
    expect(html).toContain("Atvērti");
    expect(html).toContain("Audi A4");
    expect(html).toContain("Jauni ātrie vērtējumi (24 h)");
    expect(html).toContain("https://provin.lv/admin/kopsavilkums");
    expect(html).toContain("Atvērt kopsavilkumu");
    expect(html).not.toContain("\u2014");
    expect(html).not.toContain("\u2013");
    expect(html.toLowerCase()).not.toContain("eksperts");
    expect(html).not.toContain("Datu avoti ar kļūdām 3 reizes pēc kārtas");
  });

  it("rāda datu avotus ar kļūdām 3 reizes pēc kārtas", () => {
    const html = morningSummaryEmailHtml({
      dateLabel: "15. oktobris",
      pageUrl: "https://provin.lv/admin/kopsavilkums",
      open: 1,
      urgent: 0,
      overdue: 0,
      openAudits: 1,
      openPeeks: 0,
      newPeeksLast24h: 0,
      overdueAudits: [],
      dueTodayAudits: [],
      newPeeks: [],
      failingSources: [{ title: "stat.vin", detail: "3x: timeout" }],
    });
    expect(html).toContain("Datu avoti ar kļūdām 3 reizes pēc kārtas (pārbaudi piekļuvi)");
    expect(html).toContain("stat.vin");
    expect(html).not.toContain("\u2014");
    expect(html).not.toContain("\u2013");
  });
});
