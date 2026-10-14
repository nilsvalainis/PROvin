import { describe, expect, it } from "vitest";
import {
  IRISS_LISTING_ALLOWED_COUNTRY_CODES,
  listingCountryAllowed,
  normalizeListingCountryCode,
  rejectListingsOutsideAllowedCountries,
} from "@/lib/iriss-listings-country-filter";

describe("IRISS listing country filter", () => {
  it("is always BE, NL, LU, DE", () => {
    expect(IRISS_LISTING_ALLOWED_COUNTRY_CODES).toEqual(["BE", "NL", "LU", "DE"]);
  });

  it("maps eCarsTrade codes and names to ISO", () => {
    expect(normalizeListingCountryCode("BEL")).toBe("BE");
    expect(normalizeListingCountryCode("NET")).toBe("NL");
    expect(normalizeListingCountryCode("The Netherlands")).toBe("NL");
    expect(normalizeListingCountryCode("LUX")).toBe("LU");
    expect(normalizeListingCountryCode("GER")).toBe("DE");
    expect(normalizeListingCountryCode("be")).toBe("BE");
    expect(normalizeListingCountryCode("FRA")).toBe("FR");
    expect(normalizeListingCountryCode("")).toBe("");
  });

  it("keeps unknown country and drops known countries outside the list", () => {
    expect(listingCountryAllowed("")).toBe(true);
    expect(listingCountryAllowed("BE")).toBe(true);
    expect(listingCountryAllowed("nl")).toBe(true);
    expect(listingCountryAllowed("FR")).toBe(false);
    expect(listingCountryAllowed("ESP")).toBe(false);
    expect(
      rejectListingsOutsideAllowedCountries([
        { countryCode: "BE" },
        { countryCode: "FR" },
        { countryCode: "" },
        { countryCode: "DE" },
      ]).map((x) => x.countryCode),
    ).toEqual(["BE", "", "DE"]);
  });
});
