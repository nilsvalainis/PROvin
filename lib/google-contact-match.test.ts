import { describe, expect, it } from "vitest";
import {
  emptyGoogleContactMatchIndex,
  findResourceNameInGoogleContactIndex,
  googleContactPhoneKeys,
  googleContactPhonesMatch,
  indexGoogleContactPhonesAndEmails,
  normalizeGoogleContactEmail,
  normalizeGoogleContactPhoneDigits,
  orderHasMatchableGoogleContact,
} from "@/lib/google-contact-match";

describe("google contact phone matching", () => {
  it("keeps digits, drops leading 00, prefixes Latvian 8-digit numbers", () => {
    expect(normalizeGoogleContactPhoneDigits("+371 20 000 000")).toBe("37120000000");
    expect(normalizeGoogleContactPhoneDigits("0037120000000")).toBe("37120000000");
    expect(normalizeGoogleContactPhoneDigits("20000000")).toBe("37120000000");
    expect(normalizeGoogleContactPhoneDigits("37120000000")).toBe("37120000000");
    expect(normalizeGoogleContactPhoneDigits("+3725111111")).toBe("3725111111");
  });

  it("compares with and without + and matches local LV to E.164", () => {
    expect(googleContactPhonesMatch("20000000", "+37120000000")).toBe(true);
    expect(googleContactPhonesMatch("+37120000000", "37120000000")).toBe(true);
    expect(googleContactPhonesMatch("00371 2000 0000", "20000000")).toBe(true);
    expect(googleContactPhonesMatch("20000000", "+37220000000")).toBe(false);
    expect(googleContactPhoneKeys("20000000")).toEqual(
      expect.arrayContaining(["20000000", "+20000000", "37120000000", "+37120000000"]),
    );
  });

  it("matches email case-insensitively and requires phone or email", () => {
    expect(normalizeGoogleContactEmail("  Info@Provin.lv ")).toBe("info@provin.lv");
    expect(orderHasMatchableGoogleContact({ phone: "", email: "" })).toBe(false);
    expect(orderHasMatchableGoogleContact({ phone: "20000000", email: "" })).toBe(true);
    expect(orderHasMatchableGoogleContact({ phone: "", email: "a@b.lv" })).toBe(true);
  });

  it("finds a resourceName from the in-memory index", () => {
    const index = emptyGoogleContactMatchIndex();
    indexGoogleContactPhonesAndEmails(index, "people/nils", {
      phone: "+37120000000",
      email: "nils@example.com",
    });
    expect(findResourceNameInGoogleContactIndex(index, { phone: "20000000", email: "" })).toBe("people/nils");
    expect(findResourceNameInGoogleContactIndex(index, { phone: "", email: "NILS@example.com" })).toBe("people/nils");
    expect(findResourceNameInGoogleContactIndex(index, { phone: "21111111", email: "other@example.com" })).toBeNull();
  });
});
