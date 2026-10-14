import { describe, expect, it } from "vitest";
import { appendEcarstradeLinksToScan, previewEcarstradeLinksForScan, replaceEcarstradeLinks } from "@/lib/iriss-scan-ecarstrade-links";
import { emptyIrissScanRecord } from "@/lib/iriss-scan-types";

function rec(patch: Partial<ReturnType<typeof emptyIrissScanRecord>> = {}) {
  return { ...emptyIrissScanRecord("11111111-1111-4111-8111-111111111111", "2026-10-14T00:00:00.000Z"), ...patch };
}

describe("iriss scan eCarsTrade link backfill", () => {
  it("builds one URL per distinct Auto1/Openlane/Autobid filter and appends without overwrite", () => {
    const row = rec({
      brandModel: "Volvo XC60",
      listingLinkAuto1: [
        "https://www.auto1.com/en/app/merchant/cars?manufacturer=VOLVO&model=XC60&firstRegistrationFrom=2018&fuelTypes=DIESEL",
      ],
      listingLinkOpenline: ["https://www.openlane.eu/en/findcar?makes=volvo&models=xc60&yearFrom=2018&fuels=diesel"],
      listingLinkAutobid: ["https://autobid.de/en/search-results?brandId-brand=49&name-model=XC60&yearFrom-year=2018"],
      listingLinkEcarstrade: [""],
    });
    const preview = previewEcarstradeLinksForScan(row);
    expect(preview.generated.length).toBeGreaterThanOrEqual(1);
    expect(preview.added.every((u) => u.includes("mark[]=68"))).toBe(true);
    expect(preview.added.every((u) => u.includes("model[]=1866"))).toBe(true);
    expect(preview.added.every((u) => u.includes("country[]=BEL"))).toBe(true);

    const once = appendEcarstradeLinksToScan(row);
    expect(once.preview.added.length).toBeGreaterThan(0);
    expect(once.record.listingLinkEcarstrade[0]).toContain("ecarstrade.com/search");

    const twice = appendEcarstradeLinksToScan(once.record);
    expect(twice.preview.added).toEqual([]);
    expect(twice.record.listingLinkEcarstrade).toEqual(once.record.listingLinkEcarstrade);
  });

  it("does not generate ET from brandModel or form fields when there are no auction links", () => {
    const preview = previewEcarstradeLinksForScan(rec({ brandModel: "Skoda Octavia" }));
    expect(preview.added).toEqual([]);
    expect(preview.generated).toEqual([]);
    expect(preview.skippedReason).toMatch(/nav izsoles saites/i);
  });

  it("skips auction URLs without a make and does not fill from brandModel", () => {
    const preview = previewEcarstradeLinksForScan(rec({ brandModel: "Skoda Octavia", listingLinkAuto1: ["https://www.auto1.com/en/app/merchant/cars"] }));
    expect(preview.added).toEqual([]);
    expect(preview.skippedReason).toMatch(/nav izsoles saites/i);
  });

  it("does not invent LEXUS/TOYOTA from brand when auction URLs have no make params", () => {
    const preview = previewEcarstradeLinksForScan(
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

  it("does not generate ET from brandModel 176kw or Mobile.de when auction URLs have no make", () => {
    const preview = previewEcarstradeLinksForScan(
      rec({
        brandModel: "Audi/VW/Porsche 176kw",
        listingLinkOpenline: ["https://www.openlane.eu/en/findcar"],
        listingLinkAutobid: ["https://autobid.de/en/search-results"],
        listingLinkMobile: ["https://suchen.mobile.de/fahrzeuge/search.html?minPowerAsArray=176&maxPowerAsArray=176"],
      }),
    );
    expect(preview.added).toEqual([]);
    expect(preview.generated).toEqual([]);
  });

  it("keeps exact km from each auction and splits when fuel differs", () => {
    const same = previewEcarstradeLinksForScan(
      rec({
        brandModel: "Volvo XC60",
        listingLinkAuto1: [
          "https://www.auto1.com/en/app/merchant/cars?manufacturer=VOLVO&model=XC60&firstRegistrationFrom=2018&fuelTypes=DIESEL&maxMileage=150000",
        ],
        listingLinkOpenline: ["https://www.openlane.eu/en/findcar?makes=volvo&models=xc60&yearFrom=2018&fuels=diesel&mileageTo=180000"],
      }),
    );
    expect(same.generated).toHaveLength(2);
    expect(same.generated.some((u) => u.includes("mileage_to=150000"))).toBe(true);
    expect(same.generated.some((u) => u.includes("mileage_to=180000"))).toBe(true);
    expect(same.generated.every((u) => u.includes("year_from=2018") && u.includes("fuel[]=Diesel"))).toBe(true);

    const split = previewEcarstradeLinksForScan(
      rec({
        brandModel: "Volvo XC60",
        listingLinkAuto1: [
          "https://www.auto1.com/en/app/merchant/cars?manufacturer=VOLVO&model=XC60&fuelTypes=DIESEL&firstRegistrationFrom=2018",
        ],
        listingLinkMobile: [
          "https://suchen.mobile.de/fahrzeuge/search.html?ms=25100&fuels=PETROL&minFirstRegistrationDate=2019",
        ],
      }),
    );
    expect(split.generated).toHaveLength(1);
    expect(split.generated[0]).toContain("fuel[]=Diesel");
    expect(split.generated[0]).not.toContain("fuel[]=Petrol");
    expect(split.generated[0]).toContain("year_from=2018");
    expect(split.generated[0]).not.toContain("year_from=2019");
    expect(split.plans.every((p) => p.sourceUrls.every((u) => !/mobile\.de/i.test(u)))).toBe(true);
  });

  it("does not generate ET from mobile.de-only links or a mobile.de URL pasted into Auto1", () => {
    const mobileOnly = previewEcarstradeLinksForScan(
      rec({
        brandModel: "Audi A6",
        listingLinkMobile: [
          "https://suchen.mobile.de/fahrzeuge/search.html?ms=1900&fuels=PETROL&minFirstRegistrationDate=2017",
        ],
      }),
    );
    expect(mobileOnly.plans).toEqual([]);
    expect(mobileOnly.generated).toEqual([]);
    expect(mobileOnly.skippedReason).toMatch(/nav izsoles saites/i);

    const pasted = previewEcarstradeLinksForScan(
      rec({
        brandModel: "Audi A6",
        listingLinkAuto1: [
          "https://suchen.mobile.de/fahrzeuge/search.html?ms=1900&fuels=PETROL&minFirstRegistrationDate=2017",
        ],
      }),
    );
    expect(pasted.plans).toEqual([]);
    expect(pasted.generated).toEqual([]);
  });

  it("replace overwrites an old coarse eCarsTrade URL", () => {
    const row = rec({
      brandModel: "Volvo XC60",
      listingLinkAuto1: [
        "https://www.auto1.com/en/app/merchant/cars?manufacturer=VOLVO&model=XC60&firstRegistrationFrom=2018&maxMileage=150000&fuelTypes=DIESEL",
      ],
      listingLinkEcarstrade: ["https://ecarstrade.com/search?mark[]=68"],
    });
    const next = replaceEcarstradeLinks(row);
    expect(next.preview.added).toHaveLength(1);
    expect(next.record.listingLinkEcarstrade).toHaveLength(1);
    expect(next.record.listingLinkEcarstrade[0]).toContain("year_from=2018");
    expect(next.record.listingLinkEcarstrade[0]).toContain("mileage_to=150000");
    expect(next.record.listingLinkEcarstrade[0]).not.toBe(row.listingLinkEcarstrade[0]);
    const again = replaceEcarstradeLinks(next.record);
    expect(again.preview.added).toEqual([]);
    expect(again.record.listingLinkEcarstrade).toEqual(next.record.listingLinkEcarstrade);
  });

  it("ignores Openlane auctionId single-car links when planning ET searches", () => {
    const preview = previewEcarstradeLinksForScan(
      rec({
        brandModel: "Volvo XC60",
        listingLinkOpenline: ["https://www.openlane.eu/en/findcar?auctionId=1234567"],
      }),
    );
    expect(preview.plans.every((p) => !p.sourceUrls.some((u) => /auctionId=/i.test(u)))).toBe(true);
    expect(preview.generated).toEqual([]);
    expect(preview.skippedReason).toMatch(/nav izsoles saites/i);
  });

  it("replace clears form-derived ET when there is no auction make", () => {
    const row = rec({
      brandModel: "Skoda Octavia",
      listingLinkEcarstrade: ["https://ecarstrade.com/search?mark[]=61&model[]=1460"],
    });
    const next = replaceEcarstradeLinks(row);
    expect(next.preview.changed).toBe(true);
    expect(next.preview.generated).toEqual([]);
    expect(next.record.listingLinkEcarstrade).toEqual([""]);
    const again = replaceEcarstradeLinks(next.record);
    expect(again.preview.changed).toBe(false);
    expect(again.record.listingLinkEcarstrade).toEqual([""]);
  });
});
