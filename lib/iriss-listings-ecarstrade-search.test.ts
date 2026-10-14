import { describe, expect, it } from "vitest";
import { resolveEcarstradeMake, resolveEcarstradeModel, resolveMakeModelFromBrand } from "@/lib/iriss-listings-ecarstrade-catalog";
import {
  ecarstradeSearchUrl,
  fillMakeModelFromBrand,
  filterFromBrandModel,
  parseListingSearchUrl,
  sameEcarstradeSearch,
} from "@/lib/iriss-listings-ecarstrade-search";

describe("eCarsTrade search mapper", () => {
  it("resolves Volvo XC60 to mark 68 / model 1866", () => {
    const r = resolveMakeModelFromBrand("Volvo XC60");
    expect(r.make).toMatchObject({ id: 68, name: "Volvo" });
    expect(r.model).toMatchObject({ id: 1866, name: "XC60" });
  });

  it("maps brandModel to a BE/NL/LU/DE search URL", () => {
    const url = ecarstradeSearchUrl(filterFromBrandModel("Volvo XC60"));
    expect(url).toContain("https://ecarstrade.com/search?");
    const u = new URL(url!);
    expect(u.searchParams.getAll("mark[]")).toEqual(["68"]);
    expect(u.searchParams.getAll("model[]")).toEqual(["1866"]);
    expect(u.searchParams.getAll("country[]")).toEqual(["BEL", "NET", "LUX", "GER"]);
  });

  it("maps Auto1 filters including year, fuel, gearbox, km, price and kW", () => {
    const url =
      "https://www.auto1.com/en/app/merchant/cars?channel=24h&manufacturer=VOLVO&model=XC60&firstRegistrationFrom=2018-01-01&firstRegistrationTo=2022-12-31&minMileage=10000&maxMileage=150000&fuelTypes=DIESEL&gearboxes=AUTOMATIC&bodyTypes=SUV&minPrice=12000&maxPrice=28000&powerFrom=110&powerTo=180";
    const filter = parseListingSearchUrl(url);
    expect(filter.makeIds).toEqual([68]);
    expect(filter.modelId).toBe(1866);
    expect(filter.yearFrom).toBe(2018);
    expect(filter.yearTo).toBe(2022);
    expect(filter.mileageFrom).toBe(10000);
    expect(filter.mileageTo).toBe(150000);
    expect(filter.priceFrom).toBe(12000);
    expect(filter.priceTo).toBe(28000);
    expect(filter.powerFromKw).toBe(110);
    expect(filter.powerToKw).toBe(180);
    expect(filter.fuels).toEqual(["Diesel"]);
    expect(filter.gearboxes).toEqual(["Automatic"]);
    expect(filter.bodies).toEqual(["SUV/Off-road Vehicle/Pickup Truck"]);
    const built = ecarstradeSearchUrl(filter)!;
    const u = new URL(built);
    expect(u.searchParams.get("year_from")).toBe("2018");
    expect(u.searchParams.get("year_to")).toBe("2022");
    expect(u.searchParams.get("mileage_from")).toBe("10000");
    expect(u.searchParams.get("mileage_to")).toBe("150000");
    expect(u.searchParams.get("price_from")).toBe("12000");
    expect(u.searchParams.get("price_to")).toBe("28000");
    expect(u.searchParams.get("power_from")).toBe("110");
    expect(u.searchParams.get("power_to")).toBe("180");
    expect(u.searchParams.getAll("fuel[]")).toEqual(["Diesel"]);
    expect(u.searchParams.getAll("gearbox[]")).toEqual(["Automatic"]);
    expect(u.searchParams.getAll("category[]")).toEqual(["SUV/Off-road Vehicle/Pickup Truck"]);
    expect(u.searchParams.getAll("country[]")).toEqual(["BEL", "NET", "LUX", "GER"]);
  });

  it("maps Openlane makes/models/years and Autobid brandId+name-model", () => {
    const openlane = parseListingSearchUrl(
      "https://www.openlane.eu/en/findcar?makes=volvo&models=xc60&yearFrom=2019&yearTo=2023&mileageFrom=0&mileageTo=180000&fuels=diesel&transmissions=automatic",
    );
    expect(openlane.makeIds).toEqual([68]);
    expect(openlane.modelId).toBe(1866);
    expect(openlane.yearFrom).toBe(2019);
    expect(openlane.fuels).toEqual(["Diesel"]);

    const autobid = parseListingSearchUrl(
      "https://autobid.de/en/search-results?brandId-brand=49&name-model=XC60&yearFrom-year=2018&mileageTo-mileage=160000",
    );
    expect(autobid.makeIds).toEqual([68]);
    expect(autobid.modelId).toBe(1866);
    expect(autobid.yearFrom).toBe(2018);
    expect(autobid.mileageTo).toBe(160000);
  });

  it("fills missing make/model from brandModel and converts Auto1 horsepower to kW", () => {
    const parsed = parseListingSearchUrl(
      "https://www.auto1.com/en/app/merchant/cars?minHorsePower=150&maxHorsePower=200&fuelTypes=PETROL",
    );
    const filled = fillMakeModelFromBrand(parsed, "BMW 520d");
    expect(filled.makeIds).toEqual([7]);
    expect(filled.modelId).toBe(resolveEcarstradeModel(7, "520")?.id);
    expect(filled.powerFromKw).toBe(110);
    expect(filled.powerToKw).toBe(147);
    expect(filled.fuels).toEqual(["Petrol"]);
  });

  it("maps Avant / Variant to Estate Car and VW alias", () => {
    expect(resolveEcarstradeMake("VW")?.name).toBe("Volkswagen");
    const filter = filterFromBrandModel("Audi A6 Avant");
    expect(filter.makeIds).toEqual([5]);
    expect(filter.modelName).toBe("A6");
    expect(filter.bodies).toEqual(["Estate Car"]);
  });

  it("maps slash-joined multi-make brandModel and kW from the title", () => {
    const lexus = filterFromBrandModel("LEXUS/TOYOTA");
    expect(lexus.makeIds).toEqual([39, 66]);
    expect(lexus.modelId).toBeNull();
    const lexusUrl = ecarstradeSearchUrl(lexus)!;
    expect(lexusUrl).toContain("mark[]=39");
    expect(lexusUrl).toContain("mark[]=66");
    expect(lexusUrl).not.toContain("model[]=");

    const power = filterFromBrandModel("Audi/VW/Porsche 176kw");
    expect(power.makeIds).toEqual([5, 67, 54]);
    expect(power.powerFromKw).toBe(176);
    expect(power.powerToKw).toBe(176);
    const powerUrl = ecarstradeSearchUrl(power)!;
    expect(powerUrl).toContain("mark[]=5");
    expect(powerUrl).toContain("mark[]=67");
    expect(powerUrl).toContain("mark[]=54");
    expect(powerUrl).toContain("power_from=176");
    expect(powerUrl).toContain("power_to=176");
  });

  it("keeps BMW 5/7 as one make and maps Volvo 100-130kw power range", () => {
    const bmw = filterFromBrandModel("BMW 5/7");
    expect(bmw.makeIds).toEqual([7]);
    const volvo = filterFromBrandModel("Volvo 100-130kw");
    expect(volvo.makeIds).toEqual([68]);
    expect(volvo.powerFromKw).toBe(100);
    expect(volvo.powerToKw).toBe(130);
  });

  it("reads multiple Openlane makes and Mobile kW into one filter", () => {
    const openlane = parseListingSearchUrl(
      "https://www.openlane.eu/en/findcar?makes=lexus&makes=toyota&yearFrom=2018",
    );
    expect(openlane.makeIds).toEqual([39, 66]);
    expect(openlane.yearFrom).toBe(2018);
    const mobile = parseListingSearchUrl(
      "https://suchen.mobile.de/fahrzeuge/search.html?make=Porsche&minPowerAsArray=176&maxPowerAsArray=176",
    );
    expect(mobile.makeIds).toEqual([54]);
    expect(mobile.powerFromKw).toBe(176);
    expect(mobile.powerToKw).toBe(176);
  });

  it("treats reordered country params as the same search", () => {
    const a = "https://ecarstrade.com/search?mark[]=68&model[]=1866&country[]=BEL&country[]=NET&country[]=LUX&country[]=GER";
    const b = "https://ecarstrade.com/search?country[]=GER&model[]=1866&mark[]=68&country[]=BEL&country[]=LUX&country[]=NET";
    expect(sameEcarstradeSearch(a, b)).toBe(true);
    expect(sameEcarstradeSearch(a, "https://ecarstrade.com/search?mark[]=68&model[]=1510")).toBe(false);
  });
});
