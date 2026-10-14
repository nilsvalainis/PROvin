import { describe, expect, it } from "vitest";
import {
  appendEcarstradeLinksToPasutijums,
  hasOtherAuctionListingLinks,
  previewEcarstradeLinksForPasutijums,
  replaceEcarstradeLinksOnPasutijums,
  withAutoEcarstradeLinks,
} from "@/lib/iriss-pasutijumi-ecarstrade-links";
import { emptyIrissPasutijums } from "@/lib/iriss-pasutijumi-types";

function rec(patch: Partial<ReturnType<typeof emptyIrissPasutijums>> = {}) {
  return {
    ...emptyIrissPasutijums("11111111-1111-4111-8111-111111111111", "2026-10-14T00:00:00.000Z"),
    clientFirstName: "Anna",
    ...patch,
  };
}

describe("iriss pasūtījumi eCarsTrade link backfill", () => {
  it("builds a search URL from Auto1/Openlane/Autobid filters", () => {
    const row = rec({
      brandModel: "Volvo XC60",
      listingLinkAuto1: [
        "https://www.auto1.com/en/app/merchant/cars?manufacturer=VOLVO&model=XC60&firstRegistrationFrom=2018&fuelTypes=DIESEL",
      ],
      listingLinkOpenline: ["https://www.openlane.eu/en/findcar?makes=volvo&models=xc60&yearFrom=2018&fuels=diesel"],
      listingLinkAutobid: ["https://autobid.de/en/search-results?brandId-brand=49&name-model=XC60&yearFrom-year=2018"],
      listingLinkEcarstrade: [""],
    });
    expect(hasOtherAuctionListingLinks(row)).toBe(true);
    const preview = previewEcarstradeLinksForPasutijums(row);
    expect(preview.added.length).toBeGreaterThan(0);
    expect(preview.added.every((u) => u.includes("mark[]=68"))).toBe(true);
    expect(preview.added.every((u) => u.includes("model[]=1866"))).toBe(true);

    const once = appendEcarstradeLinksToPasutijums(row);
    expect(once.record.clientFirstName).toBe("Anna");
    expect(once.record.listingLinkEcarstrade[0]).toContain("ecarstrade.com/search");

    const twice = appendEcarstradeLinksToPasutijums(once.record);
    expect(twice.preview.added).toEqual([]);
    expect(twice.record.listingLinkEcarstrade).toEqual(once.record.listingLinkEcarstrade);
  });

  it("does not auto-generate ET from brandModel or form fields alone", () => {
    const next = withAutoEcarstradeLinks(rec({ brandModel: "Skoda Octavia" }));
    expect(next.listingLinkEcarstrade).toEqual([""]);
    expect(next.clientFirstName).toBe("Anna");
    expect(withAutoEcarstradeLinks(next).listingLinkEcarstrade).toEqual(next.listingLinkEcarstrade);
  });

  it("skips orders without a resolvable make or other auction links", () => {
    const empty = rec({ brandModel: "", listingLinkAuto1: ["https://www.auto1.com/en/app/merchant/cars"] });
    expect(hasOtherAuctionListingLinks(empty)).toBe(true);
    const preview = previewEcarstradeLinksForPasutijums(empty);
    expect(preview.added).toEqual([]);
    expect(preview.skippedReason).toMatch(/nav izsoles saites/i);
    expect(hasOtherAuctionListingLinks(rec({ brandModel: "Volvo XC60" }))).toBe(false);
    expect(
      hasOtherAuctionListingLinks(
        rec({
          brandModel: "Audi A6",
          listingLinkMobile: ["https://suchen.mobile.de/fahrzeuge/search.html?ms=1900"],
        }),
      ),
    ).toBe(false);
  });

  it("does not invent LEXUS/TOYOTA from the form when auction URLs have no make params", () => {
    const preview = previewEcarstradeLinksForPasutijums(
      rec({
        brandModel: "LEXUS/TOYOTA",
        listingLinkAuto1: ["https://www.auto1.com/en/app/merchant/cars?channel=24h"],
        listingLinkOpenline: ["https://www.openlane.eu/en/findcar"],
        listingLinkAutobid: ["https://autobid.de/en/search-results"],
      }),
    );
    expect(preview.added).toEqual([]);
    expect(preview.generated).toEqual([]);
  });

  it("replace copies Auto1 filters and does not stack order-form years/km/price", () => {
    const row = rec({
      brandModel: "Volvo XC60",
      productionYears: "2019-2022",
      maxMileage: "140000",
      totalBudget: "26000",
      driveType: "AWD",
      listingLinkAuto1: [
        "https://www.auto1.com/en/app/merchant/cars?manufacturer=VOLVO&model=XC60&fuelTypes=DIESEL",
      ],
      listingLinkEcarstrade: ["https://ecarstrade.com/search?mark[]=68", "https://ecarstrade.com/search?mark[]=68&mark[]=7"],
    });
    const next = replaceEcarstradeLinksOnPasutijums(row);
    expect(next.record.clientFirstName).toBe("Anna");
    expect(next.record.listingLinkEcarstrade).toHaveLength(1);
    expect(next.record.listingLinkEcarstrade[0]).toContain("fuel[]=Diesel");
    expect(next.record.listingLinkEcarstrade[0]).toContain("model[]=1866");
    expect(next.record.listingLinkEcarstrade[0]).not.toContain("year_from=2019");
    expect(next.record.listingLinkEcarstrade[0]).not.toContain("mileage_to=140000");
    expect(next.record.listingLinkEcarstrade[0]).not.toContain("price_to=26000");
    expect(next.record.listingLinkEcarstrade[0]).not.toContain("iriss_drive=awd");
  });

  it("replace clears form-derived ET when the order has no auction links", () => {
    const row = rec({
      brandModel: "Skoda Octavia",
      listingLinkEcarstrade: ["https://ecarstrade.com/search?mark[]=61&model[]=1460"],
    });
    const next = replaceEcarstradeLinksOnPasutijums(row);
    expect(next.preview.changed).toBe(true);
    expect(next.preview.generated).toEqual([]);
    expect(next.record.listingLinkEcarstrade).toEqual([""]);
    expect(next.record.clientFirstName).toBe("Anna");
  });
});
