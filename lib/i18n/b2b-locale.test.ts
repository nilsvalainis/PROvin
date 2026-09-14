import { describe, expect, it } from "vitest";
import {
  detectB2bDefaultLocale,
  isB2bOnlyLocale,
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

  it("lets explicit en/de/ru URLs win over IP and cookie", () => {
    expect(
      resolveB2bEntryLocale({ urlLocale: "en", cookie: "de", country: "DE" }),
    ).toBe("en");
    expect(
      resolveB2bEntryLocale({ urlLocale: "de", cookie: "en", country: "US" }),
    ).toBe("de");
    expect(
      resolveB2bEntryLocale({ urlLocale: "ru", cookie: "lv", country: "LV" }),
    ).toBe("ru");
  });

  it("uses cookie then IP when the URL is the site default /lv dump", () => {
    expect(
      resolveB2bEntryLocale({ urlLocale: "lv", cookie: "de", country: "US" }),
    ).toBe("de");
    expect(
      resolveB2bEntryLocale({ urlLocale: "lv", cookie: null, country: "DE" }),
    ).toBe("de");
    expect(
      resolveB2bEntryLocale({ urlLocale: "lv", cookie: null, country: "FR" }),
    ).toBe("en");
    expect(
      resolveB2bEntryLocale({ urlLocale: null, cookie: null, country: "DE" }),
    ).toBe("de");
  });

  it("keeps de/ru as B2B-only and English site chrome", () => {
    expect(isB2bOnlyLocale("de")).toBe(true);
    expect(siteMessageLocale("de")).toBe("en");
    expect(siteMessageLocale("ru")).toBe("en");
    expect(siteMessageLocale("lv")).toBe("lv");
    expect(parsePrefixedPath("/de/partneriem/konts")).toEqual({
      locale: "de",
      rest: "/partneriem/konts",
    });
    expect(isPartneriemPath("/partneriem")).toBe(true);
    expect(isPartneriemPath("/pakalpojumi")).toBe(false);
  });
});
