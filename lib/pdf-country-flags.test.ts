import { describe, expect, it } from "vitest";
import { PDF_COUNTRY_FLAG_EU, pdfCountryCodeLetters, pdfCountryFlagEmoji } from "@/lib/pdf-country-flags";

describe("pdfCountryFlagEmoji", () => {
  it("shows a US flag for Louisiana, not Laos or EU", () => {
    expect(pdfCountryFlagEmoji("Baton Rouge, LA")).toBe("🇺🇸");
    expect(pdfCountryCodeLetters("LA")).toBe("US");
    expect(pdfCountryFlagEmoji("LA")).not.toBe("🇱🇦");
  });

  it("shows no flag / no EU letters for unrecognized country", () => {
    expect(pdfCountryFlagEmoji("Nezināma vieta")).toBe("");
    expect(pdfCountryCodeLetters("Nezināma vieta")).toBe("");
    expect(pdfCountryFlagEmoji("")).toBe("");
    expect(pdfCountryFlagEmoji("XYZ-land")).not.toBe(PDF_COUNTRY_FLAG_EU);
    expect(pdfCountryCodeLetters("XYZ-land")).not.toBe("EU");
  });
});
