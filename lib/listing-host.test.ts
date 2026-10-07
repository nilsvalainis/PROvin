import { describe, expect, it } from "vitest";
import { isListingAutofillUrl, listingCountryFromUrl, listingHostname } from "@/lib/listing-host";

describe("listingHostname", () => {
  it("strips www and lowercases", () => {
    expect(listingHostname("https://www.autoplius.lt/skelbimai/123")).toBe("autoplius.lt");
  });
});

describe("listingCountryFromUrl", () => {
  it("maps Baltic and DE portals", () => {
    expect(listingCountryFromUrl("https://www.ss.lv/msg/lv/transport/cars/x.html")).toBe("Latvija");
    expect(listingCountryFromUrl("https://www.city24.lv/lv/real-estate/123")).toBe("Latvija");
    expect(listingCountryFromUrl("https://www.auto24.ee/used/123")).toBe("Igaunija");
    expect(listingCountryFromUrl("https://autoplius.lt/skelbimai/audi-q7-123")).toBe("Lietuva");
    expect(listingCountryFromUrl("https://suchen.mobile.de/fahrzeuge/details.html?id=1")).toBe("Vācija");
  });

  it("returns empty for unknown hosts", () => {
    expect(listingCountryFromUrl("https://example.com/car/1")).toBe("");
  });
});

describe("isListingAutofillUrl", () => {
  it("accepts a concrete listing path, not a site root", () => {
    expect(isListingAutofillUrl("https://autoplius.lt/skelbimai/123")).toBe(true);
    expect(isListingAutofillUrl("https://autoplius.lt")).toBe(false);
    expect(isListingAutofillUrl("")).toBe(false);
  });
});
