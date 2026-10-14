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

  it("still generates from brandModel when platform links are empty", () => {
    const preview = previewEcarstradeLinksForScan(rec({ brandModel: "Skoda Octavia" }));
    expect(preview.added).toHaveLength(1);
    expect(preview.added[0]).toContain("mark[]=61");
    expect(preview.added[0]).toMatch(/model\[\]=/);
  });

  it("skips rows without a resolvable make", () => {
    const preview = previewEcarstradeLinksForScan(rec({ brandModel: "", listingLinkAuto1: ["https://www.auto1.com/en/app/merchant/cars"] }));
    expect(preview.added).toEqual([]);
    expect(preview.skippedReason).toMatch(/nav markas/i);
  });

  it("adds LEXUS/TOYOTA even when Auto1/Openlane/Autobid URLs have no make params", () => {
    const preview = previewEcarstradeLinksForScan(
      rec({
        brandModel: "LEXUS/TOYOTA",
        listingLinkAuto1: ["https://www.auto1.com/en/app/merchant/cars?channel=24h"],
        listingLinkOpenline: ["https://www.openlane.eu/en/findcar"],
        listingLinkAutobid: ["https://autobid.de/en/search-results"],
      }),
    );
    expect(preview.added.length).toBeGreaterThanOrEqual(1);
    expect(preview.added[0]).toContain("mark[]=39");
    expect(preview.added[0]).toContain("mark[]=66");
  });

  it("adds Audi/VW/Porsche 176kw from brandModel and Mobile filters", () => {
    const preview = previewEcarstradeLinksForScan(
      rec({
        brandModel: "Audi/VW/Porsche 176kw",
        listingLinkOpenline: ["https://www.openlane.eu/en/findcar"],
        listingLinkAutobid: ["https://autobid.de/en/search-results"],
        listingLinkMobile: ["https://suchen.mobile.de/fahrzeuge/search.html?minPowerAsArray=176&maxPowerAsArray=176"],
      }),
    );
    expect(preview.added.some((u) => u.includes("mark[]=5") && u.includes("mark[]=67") && u.includes("mark[]=54"))).toBe(true);
    expect(preview.added.some((u) => u.includes("power_from=161") && u.includes("power_to=191"))).toBe(true);
  });

  it("keeps one ET link when Auto1 and Openlane overlap, and two when fuel differs", () => {
    const same = previewEcarstradeLinksForScan(
      rec({
        brandModel: "Volvo XC60",
        listingLinkAuto1: [
          "https://www.auto1.com/en/app/merchant/cars?manufacturer=VOLVO&model=XC60&firstRegistrationFrom=2018&fuelTypes=DIESEL&maxMileage=150000",
        ],
        listingLinkOpenline: ["https://www.openlane.eu/en/findcar?makes=volvo&models=xc60&yearFrom=2018&fuels=diesel&mileageTo=180000"],
      }),
    );
    expect(same.generated).toHaveLength(1);
    expect(same.generated[0]).toContain("year_from=2018");
    expect(same.generated[0]).toContain("mileage_to=150000");
    expect(same.generated[0]).toContain("fuel[]=Diesel");

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
    expect(split.generated.length).toBe(2);
    expect(split.generated.some((u) => u.includes("fuel[]=Diesel"))).toBe(true);
    expect(split.generated.some((u) => u.includes("fuel[]=Petrol"))).toBe(true);
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
    expect(preview.generated[0]).toContain("mark[]=68");
    expect(preview.generated[0]).toContain("model[]=1866");
  });
});
