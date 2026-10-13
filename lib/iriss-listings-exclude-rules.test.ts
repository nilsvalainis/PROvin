import { describe, expect, it } from "vitest";
import { HP_TO_KW } from "@/lib/engine-power-kw";
import {
  fillListingPowerKwField,
  IRISS_LISTING_EXCLUDE_RULES,
  listingMakeMatches,
  listingMatchesExcludeRule,
  purgeExcludedIrissListings,
  rejectExcludedIrissListings,
  resolveListingPowerKw,
  shouldExcludeIrissListing,
} from "@/lib/iriss-listings-exclude-rules";

describe("IRISS_LISTING_EXCLUDE_RULES", () => {
  it("starts with Volvo 133 and 140 kW", () => {
    expect(IRISS_LISTING_EXCLUDE_RULES).toEqual([{ make: "volvo", powerKw: [133, 140] }]);
  });
});

describe("listingMakeMatches", () => {
  it("matches manufacturer or title, case-insensitive, as a whole word", () => {
    expect(listingMakeMatches({ manufacturer: "Volvo", title: "XC60 B5" }, "volvo")).toBe(true);
    expect(listingMakeMatches({ manufacturer: "VOLVO", title: "" }, "volvo")).toBe(true);
    expect(listingMakeMatches({ manufacturer: "", title: "2019 volvo V60 D4" }, "volvo")).toBe(true);
    expect(listingMakeMatches({ manufacturer: "Volvo Cars", title: "XC60" }, "volvo")).toBe(true);
    expect(listingMakeMatches({ manufacturer: "BMW", title: "320d" }, "volvo")).toBe(false);
    expect(listingMakeMatches({ manufacturer: "", title: "Involvo special" }, "volvo")).toBe(false);
  });
});

describe("resolveListingPowerKw", () => {
  it("reads Openlane/Auto1/Autobid powerKw as kW (canonical Openlane field is auction.Kw)", () => {
    expect(resolveListingPowerKw({ powerKw: "140" })).toBe(140);
    expect(resolveListingPowerKw({ powerKw: "133 kW" })).toBe(133);
  });

  it("derives kW from title/engine text when powerKw is empty", () => {
    expect(resolveListingPowerKw({ powerKw: "", title: "Volvo V60 133 kW" })).toBe(133);
    expect(resolveListingPowerKw({ powerKw: "", title: "Volvo V60 181 PS" })).toBe(Math.round(181 * HP_TO_KW));
    expect(resolveListingPowerKw({ powerKw: "", title: "Volvo V60 181 hp" })).toBe(133);
    expect(resolveListingPowerKw({ powerKw: "", title: "Volvo V60 190 PS" })).toBe(140);
    expect(resolveListingPowerKw({ powerKw: "", engineText: "181 hp D4" })).toBe(133);
  });

  it("prefers the powerKw field over title text", () => {
    expect(resolveListingPowerKw({ powerKw: "173", title: "Volvo XC60 140 kW" })).toBe(173);
  });

  it("returns null when power is unknown", () => {
    expect(resolveListingPowerKw({ powerKw: "", title: "Volvo XC60 B5 AWD" })).toBeNull();
    expect(resolveListingPowerKw({ powerKw: "0", title: "Volvo XC60" })).toBeNull();
  });

  it("fillListingPowerKwField keeps a numeric field and fills from title when empty", () => {
    expect(fillListingPowerKwField({ powerKw: "140", title: "Volvo V60 181 PS" })).toBe("140");
    expect(fillListingPowerKwField({ powerKw: "", title: "Volvo V60 181 PS" })).toBe("133");
    expect(fillListingPowerKwField({ powerKw: "", title: "Volvo XC60 B5" })).toBe("");
  });
});

describe("shouldExcludeIrissListing", () => {
  it("excludes Volvo at 133 and 140 kW from any source fields", () => {
    expect(shouldExcludeIrissListing({ manufacturer: "Volvo", title: "XC60", powerKw: "133" })).toBe(true);
    expect(shouldExcludeIrissListing({ manufacturer: "Volvo", title: "V60", powerKw: "140" })).toBe(true);
    expect(shouldExcludeIrissListing({ manufacturer: "volvo", title: "V60 D4", powerKw: "140" })).toBe(true);
  });

  it("tolerates ±1 kW rounding", () => {
    expect(shouldExcludeIrissListing({ manufacturer: "Volvo", powerKw: "132" })).toBe(true);
    expect(shouldExcludeIrissListing({ manufacturer: "Volvo", powerKw: "134" })).toBe(true);
    expect(shouldExcludeIrissListing({ manufacturer: "Volvo", powerKw: "139" })).toBe(true);
    expect(shouldExcludeIrissListing({ manufacturer: "Volvo", powerKw: "141" })).toBe(true);
    expect(shouldExcludeIrissListing({ manufacturer: "Volvo", powerKw: "131" })).toBe(false);
    expect(shouldExcludeIrissListing({ manufacturer: "Volvo", powerKw: "142" })).toBe(false);
  });

  it("excludes when kW is only in the title (181 PS / 190 hp)", () => {
    expect(shouldExcludeIrissListing({ manufacturer: "Volvo", title: "V60 181 PS", powerKw: "" })).toBe(true);
    expect(shouldExcludeIrissListing({ manufacturer: "", title: "Volvo V60 190 hp - Diesel", powerKw: "" })).toBe(true);
  });

  it("keeps the item when power is unknown", () => {
    expect(shouldExcludeIrissListing({ manufacturer: "Volvo", title: "XC60 B5", powerKw: "" })).toBe(false);
    expect(shouldExcludeIrissListing({ manufacturer: "Volvo", title: "XC60", powerKw: "0" })).toBe(false);
  });

  it("keeps other makes and other Volvo powers", () => {
    expect(shouldExcludeIrissListing({ manufacturer: "BMW", title: "320d", powerKw: "140" })).toBe(false);
    expect(shouldExcludeIrissListing({ manufacturer: "Volvo", title: "XC60 B5", powerKw: "173" })).toBe(false);
    expect(shouldExcludeIrissListing({ manufacturer: "Mitsubishi", title: "Pajero", powerKw: "140" })).toBe(false);
  });

  it("accepts a generic extra rule list", () => {
    expect(
      shouldExcludeIrissListing({ manufacturer: "BMW", powerKw: "140" }, [{ make: "bmw", powerKw: [140] }]),
    ).toBe(true);
    expect(
      listingMatchesExcludeRule({ manufacturer: "Audi", powerKw: "140" }, { make: "volvo", powerKw: [140] }),
    ).toBe(false);
  });
});

describe("rejectExcludedIrissListings / purge", () => {
  it("drops matching rows and reports how many were removed", () => {
    const items = [
      { id: "keep-bmw", manufacturer: "BMW", title: "320d", powerKw: "140" },
      { id: "drop-kw", manufacturer: "Volvo", title: "V60", powerKw: "140" },
      { id: "drop-ps", manufacturer: "Volvo", title: "V60 181 PS", powerKw: "" },
      { id: "keep-unknown", manufacturer: "Volvo", title: "XC60 B5", powerKw: "" },
      { id: "keep-173", manufacturer: "Volvo", title: "XC60 B5", powerKw: "173" },
    ];
    expect(rejectExcludedIrissListings(items).map((v) => v.id)).toEqual(["keep-bmw", "keep-unknown", "keep-173"]);
    expect(purgeExcludedIrissListings(items)).toEqual({
      items: [items[0], items[3], items[4]],
      removed: 2,
    });
  });
});
