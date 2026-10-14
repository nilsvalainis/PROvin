import { describe, expect, it } from "vitest";
import { appendEcarstradeLinksToScan, previewEcarstradeLinksForScan } from "@/lib/iriss-scan-ecarstrade-links";
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
    expect(preview.added.some((u) => u.includes("power_from=176") && u.includes("power_to=176"))).toBe(true);
  });
});
