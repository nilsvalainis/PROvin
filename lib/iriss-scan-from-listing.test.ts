import { describe, expect, it } from "vitest";
import { irissScanSeedFromListing } from "@/lib/iriss-scan-from-listing";
import { parseListingSearchUrl } from "@/lib/iriss-listings-ecarstrade-search";

const vin = "WBAZZZ8V0K1237731";

describe("irissScanSeedFromListing", () => {
  it("prefills Radars storage from listing model data and builds source filters", () => {
    const rec = irissScanSeedFromListing(
      {
        manufacturer: "Volvo",
        title: "Volvo XC60",
        year: "2019",
        firstRegistration: "2019-06",
        fuel: "dīzelis",
        powerKw: "140 kW",
        transmission: "automātiskā",
        bodyType: "SUV",
        vin,
      },
      "11111111-1111-4111-8111-111111111111",
      "2026-10-19T10:00:00.000Z",
    );
    expect(rec.brandModel).toBe("Volvo XC60");
    expect(rec.vin).toBe(vin);
    expect(rec.productionYears).toBe("2019");
    expect(rec.engineType).toContain("140 kW");
    expect(rec.transmission).toMatch(/auto/i);
    expect(rec.bodyType).toMatch(/suv/i);
    expect(rec.listingLinkAuto1[0]).toContain("manufacturer=VOLVO");
    expect(rec.listingLinkOpenline[0]).toContain("makes=volvo");
    expect(rec.listingLinkAutobid[0]).toContain("brandId-brand=49");
    expect(rec.listingLinkEcarstrade[0]).toContain("ecarstrade.com");
    expect(rec.listingLinkMobile[0]).toContain("suchen.mobile.de");
    expect(rec.listingLinksOther[0]).toContain("autoscout24.de");
    const parsed = parseListingSearchUrl(rec.listingLinkAuto1[0]!);
    expect(parsed.yearFrom).toBe(2019);
    expect(parsed.yearTo).toBe(2019);
    expect(parsed.fuels).toEqual(["Diesel"]);
    expect(parsed.gearboxes).toEqual(["Automatic"]);
  });

  it("does not copy a specific listing URL as a search filter", () => {
    const rec = irissScanSeedFromListing(
      {
        manufacturer: "BMW",
        title: "BMW 520d",
        year: "2018",
        firstRegistration: "",
        fuel: "Diesel",
        powerKw: "140",
        transmission: "Automatic",
        bodyType: "Sedan",
        vin: "",
      },
      "11111111-1111-4111-8111-111111111112",
      "2026-10-19T10:00:00.000Z",
    );
    expect(rec.listingLinkAuto1.join(" ")).not.toContain("/a/");
    expect(rec.listingLinkAuto1[0]).toContain("/en/app/merchant/cars?");
  });
});
