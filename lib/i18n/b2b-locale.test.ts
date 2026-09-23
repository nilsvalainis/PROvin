import { describe, expect, it } from "vitest";
import {
  detectB2bDefaultLocale,
  isB2bLegalPath,
  isPartneriemPath,
  parsePrefixedPath,
  resolveB2bEntryLocale,
  siteMessageLocale,
} from "@/i18n/locales";

describe("B2B locale detection", () => {
  it("maps German-market IPs to de and other foreign IPs to en", () => {
    expect(detectB2bDefaultLocale("DE")).toBe("de");
    expect(detectB2bDefaultLocale("AT")).toBe("de");
    expect(detectB2bDefaultLocale("LV")).toBe("lv");
    expect(detectB2bDefaultLocale("")).toBe("lv");
    expect(detectB2bDefaultLocale(null)).toBe("lv");
    expect(detectB2bDefaultLocale("NL")).toBe("en");
    expect(detectB2bDefaultLocale("US")).toBe("en");
    expect(detectB2bDefaultLocale("RU")).toBe("en");
  });

  it("lets explicit lv/en/de/ru URLs win over IP and cookie", () => {
    expect(
      resolveB2bEntryLocale({ urlLocale: "en", cookie: "de", country: "DE" }),
    ).toBe("en");
    expect(
      resolveB2bEntryLocale({ urlLocale: "de", cookie: "en", country: "US" }),
    ).toBe("de");
    expect(
      resolveB2bEntryLocale({ urlLocale: "ru", cookie: "lv", country: "LV" }),
    ).toBe("ru");
    expect(
      resolveB2bEntryLocale({ urlLocale: "lv", cookie: "de", country: "DE" }),
    ).toBe("lv");
  });

  it("uses cookie then IP only on unprefixed /partneriem", () => {
    expect(
      resolveB2bEntryLocale({
        urlLocale: null,
        cookie: "de",
        country: "US",
        preferStoredLocale: true,
      }),
    ).toBe("de");
    expect(
      resolveB2bEntryLocale({
        urlLocale: "lv",
        cookie: "de",
        country: "US",
        preferStoredLocale: true,
      }),
    ).toBe("de");
    expect(
      resolveB2bEntryLocale({ urlLocale: null, cookie: null, country: "DE" }),
    ).toBe("de");
    expect(
      resolveB2bEntryLocale({ urlLocale: null, cookie: null, country: "FR" }),
    ).toBe("en");
  });

  it("serves de and ru as native public locales", () => {
    expect(siteMessageLocale("de")).toBe("de");
    expect(siteMessageLocale("ru")).toBe("ru");
    expect(siteMessageLocale("en")).toBe("en");
    expect(siteMessageLocale("lv")).toBe("lv");
    expect(parsePrefixedPath("/de/partneriem/konts")).toEqual({
      locale: "de",
      rest: "/partneriem/konts",
    });
    expect(isPartneriemPath("/partneriem")).toBe(true);
    expect(isPartneriemPath("/pakalpojumi")).toBe(false);
    expect(isB2bLegalPath("/lietosanas-noteikumi")).toBe(true);
    expect(isB2bLegalPath("/privatuma-politika")).toBe(true);
    expect(isB2bLegalPath("/pakalpojumi")).toBe(false);
  });
});
