import { describe, expect, it } from "vitest";
import { listingExtrasI } from "@/lib/iriss-listings-cost";
import {
  applyGeneratedPlatformSearchLink,
  auto1SearchUrl,
  autobidSearchUrl,
  listingPlatformSearchUrl,
  openlaneSearchUrl,
} from "@/lib/iriss-listings-platform-search";
import { filterFromOrderFields, parseListingSearchUrl } from "@/lib/iriss-listings-ecarstrade-search";
import { emptyIrissPasutijums } from "@/lib/iriss-pasutijumi-types";

const volvoOrder = {
  brandModel: "Volvo XC60",
  productionYears: "2018-2022",
  maxMileage: "150000",
  totalBudget: "28000",
  engineType: "dīzelis",
  transmission: "automātiskā",
  bodyType: "SUV",
};

describe("platform search URL builders", () => {
  it("round-trips Auto1 Volvo XC60 filter through parseListingSearchDetailed", () => {
    const filter = filterFromOrderFields(volvoOrder);
    const url = auto1SearchUrl(filter);
    expect(url).toContain("https://www.auto1.com/en/app/merchant/cars?");
    expect(url).toContain("manufacturer=VOLVO");
    expect(url).toContain("model=XC60");
    const parsed = parseListingSearchUrl(url!);
    expect(parsed.makeIds).toEqual([68]);
    expect(parsed.modelId).toBe(1866);
    expect(parsed.yearFrom).toBe(2018);
    expect(parsed.yearTo).toBe(2022);
    expect(parsed.mileageTo).toBe(150000);
    expect(parsed.priceTo).toBe(28000 - listingExtrasI());
    expect(parsed.fuels).toEqual(["Diesel"]);
    expect(parsed.gearboxes).toEqual(["Automatic"]);
    expect(parsed.bodies).toEqual(["SUV/Off-road Vehicle/Pickup Truck"]);
  });

  it("round-trips Openlane Volvo XC60 filter", () => {
    const filter = filterFromOrderFields({
      brandModel: "Volvo XC60",
      productionYears: "2019-2023",
      maxMileage: "180000",
      engineType: "dīzelis",
      transmission: "automātiskā",
    });
    const url = openlaneSearchUrl(filter);
    expect(url).toContain("https://www.openlane.eu/en/findcar?");
    expect(url).toContain("makes=volvo");
    expect(url).toContain("models=xc60");
    const parsed = parseListingSearchUrl(url!);
    expect(parsed.makeIds).toEqual([68]);
    expect(parsed.modelId).toBe(1866);
    expect(parsed.yearFrom).toBe(2019);
    expect(parsed.yearTo).toBe(2023);
    expect(parsed.mileageTo).toBe(180000);
    expect(parsed.fuels).toEqual(["Diesel"]);
    expect(parsed.gearboxes).toEqual(["Automatic"]);
  });

  it("round-trips Autobid Volvo XC60 brandId-brand + name-model", () => {
    const filter = filterFromOrderFields({
      brandModel: "Volvo XC60",
      productionYears: "2018",
      maxMileage: "160000",
    });
    const url = autobidSearchUrl(filter);
    expect(url).toContain("https://autobid.de/en/search-results?");
    expect(url).toContain("brandId-brand=49");
    expect(url).toContain("name-model=XC60");
    const parsed = parseListingSearchUrl(url!);
    expect(parsed.makeIds).toEqual([68]);
    expect(parsed.modelId).toBe(1866);
    expect(parsed.yearFrom).toBe(2018);
    expect(parsed.mileageTo).toBe(160000);
  });

  it("builds from order fields per platform and appends once", () => {
    const rec = emptyIrissPasutijums("ord-1", "2026-10-17T00:00:00.000Z");
    rec.brandModel = "Volvo XC60";
    rec.productionYears = "2018-2022";
    rec.engineType = "dīzelis";
    const auto1 = applyGeneratedPlatformSearchLink(rec, "auto1");
    expect(auto1.url).toContain("manufacturer=VOLVO");
    expect(auto1.record.listingLinkAuto1[0]).toBe(auto1.url);
    const again = applyGeneratedPlatformSearchLink(auto1.record, "auto1");
    expect(again.record.listingLinkAuto1).toEqual(auto1.record.listingLinkAuto1);
    expect(listingPlatformSearchUrl("openline", rec)).toContain("makes=volvo");
    expect(listingPlatformSearchUrl("autobid", rec)).toContain("brandId-brand=49");
  });

  it("round-trips eCarsTrade from the same order fields", () => {
    const url = listingPlatformSearchUrl("ecarstrade", volvoOrder);
    expect(url).toContain("ecarstrade.com");
    expect(url).not.toContain("year_from=");
    expect(url).not.toContain("mileage_to=");
    const parsed = parseListingSearchUrl(url!);
    expect(parsed.makeIds).toEqual([68]);
    expect(parsed.modelId).toBe(1866);
    expect(parsed.yearFrom).toBeNull();
    expect(parsed.yearTo).toBeNull();
    expect(filterFromOrderFields(volvoOrder).yearFrom).toBe(2018);
    expect(filterFromOrderFields(volvoOrder).yearTo).toBe(2022);
  });

  it("returns null without a make", () => {
    expect(auto1SearchUrl(filterFromOrderFields({ brandModel: "" }))).toBeNull();
    expect(openlaneSearchUrl(filterFromOrderFields({ brandModel: "   " }))).toBeNull();
    expect(listingPlatformSearchUrl("auto1", { brandModel: "" })).toBeNull();
  });
});
