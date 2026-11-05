import { describe, expect, it } from "vitest";
import { businessPartnerCookieName, businessPartnerCookieValue, hasBusinessPartnerCookie } from "@/lib/business-partner-cookie";

const hash = "0123456789abcdef".repeat(4);

describe("partnera saite der tikai pogas pārlūkā", () => {
  it("ar pogas uzlikto sīkdatni saite der", () => {
    const cookie = `a=1; ${businessPartnerCookieName(hash)}=${businessPartnerCookieValue(hash)}; b=2`;
    expect(hasBusinessPartnerCookie(cookie, hash)).toBe(true);
  });

  it("pārsūtīta saite (bez sīkdatnes vai ar citu vērtību) neder", () => {
    expect(hasBusinessPartnerCookie(null, hash)).toBe(false);
    expect(hasBusinessPartnerCookie("a=1", hash)).toBe(false);
    expect(hasBusinessPartnerCookie(`${businessPartnerCookieName(hash)}=nepareizi`, hash)).toBe(false);
  });
});
