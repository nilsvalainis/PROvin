import { describe, expect, it } from "vitest";
import {
  AUTOBID_BRAND_ID_TO_NAME,
  resolveEcarstradeMake,
  resolveEcarstradeModel,
  resolveMakeModelFromBrand,
} from "@/lib/iriss-listings-ecarstrade-catalog";
import {
  isMobileDeListingUrl,
  isSingleVehicleListingUrl,
  parseMobileDeColonRange,
  parseZeroUnboundedRange,
} from "@/lib/iriss-listings-ecarstrade-criteria";
import {
  applyEcarstradeOrderCriteria,
  ecarstradeSearchUrl,
  fillFilterGaps,
  fillMakeModelFromBrand,
  filterFromBrandModel,
  filterFromOrderFields,
  filtersFromBrandModel,
  parseListingSearchUrl,
  sameEcarstradeSearch,
  widenExactSearchBounds,
} from "@/lib/iriss-listings-ecarstrade-search";
import { planEcarstradeSearchUrls } from "@/lib/iriss-scan-ecarstrade-links";

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

  it("maps Auto1 drive, color, doors, equipment and exclusions to ET + post-filter params", () => {
    const filter = parseListingSearchUrl(
      "https://www.auto1.com/en/app/merchant/cars?manufacturer=AUDI&model=A6&driveTypes=ALL_WHEEL&colors=BLACK&doorCount=5&equipment=navigation&excludedModels=Allroad&maxMileage=160000&fuelTypes=DIESEL&gearboxes=AUTOMATIC&bodyTypes=ESTATE&cubicCapacityFrom=2000&cubicCapacityTo=3000",
    );
    expect(filter.makeIds).toEqual([5]);
    expect(filter.drives).toEqual(["awd"]);
    expect(filter.colors).toEqual(["Black"]);
    expect(filter.doorsFrom).toBe(5);
    expect(filter.includeTokens).toContain("navigation");
    expect(filter.excludeTokens.some((t) => /allroad/i.test(t))).toBe(true);
    expect(filter.engineFromCc).toBe(2000);
    expect(filter.engineToCc).toBe(3000);
    const url = ecarstradeSearchUrl(filter)!;
    expect(url).toContain("color[]=Black");
    expect(url).toContain("iriss_drive=awd");
    expect(url).toContain("iriss_need=navigation");
    expect(url).toContain("engine_from=2000");
    expect(url).toContain("doors_from=5");
    expect(url).toContain("category[]=Estate%20Car");
  });

  it("maps official mobile.de make ids (24100 Toyota, 17700 Mitsubishi)", () => {
    const toyota = parseListingSearchUrl("https://suchen.mobile.de/fahrzeuge/search.html?ms=24100;19;;");
    expect(toyota.makeNames).toEqual(["Toyota"]);
    const mitsubishi = parseListingSearchUrl("https://suchen.mobile.de/fahrzeuge/search.html?ms=17700;19;;");
    expect(mitsubishi.makeNames).toEqual(["Mitsubishi"]);
    const mini = parseListingSearchUrl("https://suchen.mobile.de/fahrzeuge/search.html?ms=17500;;;");
    expect(mini.makeNames).toEqual(["Mini"]);
    const suzuki = parseListingSearchUrl("https://suchen.mobile.de/fahrzeuge/search.html?ms=23600;20;;");
    expect(suzuki.makeNames).toEqual(["Suzuki"]);
    const lexus = parseListingSearchUrl("https://suchen.mobile.de/fahrzeuge/search.html?ms=15200;;;");
    expect(lexus.makeNames).toEqual(["Lexus"]);
    const porsche = parseListingSearchUrl("https://suchen.mobile.de/fahrzeuge/search.html?ms=20100;;;");
    expect(porsche.makeNames).toEqual(["Porsche"]);
    expect(parseListingSearchUrl("https://suchen.mobile.de/fahrzeuge/search.html?ms=13900;;;").makeNames).not.toContain(
      "Lexus",
    );
  });

  it("reads Autobid name= as model when name-model is absent", () => {
    const x5 = parseListingSearchUrl("https://autobid.de/en/search-results?brandId=1&name=X5&e17=3");
    expect(x5.makeNames).toEqual(["BMW"]);
    expect(x5.modelName).toBe("X5");
    const land = parseListingSearchUrl("https://autobid.de/en/search-results?brandId=8&name=land");
    expect(land.makeNames).toEqual(["Toyota"]);
    expect(land.modelName).toMatch(/Land Cruiser/i);
    const both = parseListingSearchUrl(
      "https://autobid.de/en/search-results?brandId=7&name=kodiaq&name-model=Kodiaq",
    );
    expect(both.modelName).toMatch(/Kodiaq/i);
    const unknown32 = parseListingSearchUrl("https://autobid.de/en/search-results?brandId=32&name=X5");
    expect(unknown32.unmapped.some((u) => u.key === "brandId" && u.value === "32")).toBe(true);
    expect(unknown32.modelName).toBe("X5");
  });

  it("maps Mobile.de ms make id and Autobid name-brand", () => {
    const mobile = parseListingSearchUrl("https://suchen.mobile.de/fahrzeuge/search.html?ms=25100;29;;&minMileage=10000&maxMileage=140000&fuels=DIESEL");
    expect(mobile.makeIds).toEqual([68]);
    expect(mobile.modelId).toBe(1866);
    expect(mobile.modelName).toBe("XC60");
    expect(mobile.mileageFrom).toBe(10000);
    expect(mobile.mileageTo).toBe(140000);
    expect(mobile.fuels).toEqual(["Diesel"]);

    const autobid = parseListingSearchUrl(
      "https://autobid.de/en/search-results?name-brand=BMW&name-model=530&yearFrom-year=2017&gearboxId-gearbox=Automatic",
    );
    expect(autobid.makeIds).toEqual([7]);
    expect(autobid.modelName).toMatch(/530/);
    expect(autobid.gearboxes).toEqual(["Automatic"]);
  });

  it("fills order form years, budget, km and drive into gaps", () => {
    const fromUrl = parseListingSearchUrl(
      "https://www.auto1.com/en/app/merchant/cars?manufacturer=VOLVO&model=XC60&fuelTypes=DIESEL",
    );
    const fromOrder = filterFromOrderFields({
      brandModel: "Volvo XC60",
      productionYears: "2018-2022",
      maxMileage: "150 000",
      totalBudget: "28 000 €",
      driveType: "4x4",
      preferredColors: "melns, pelēks",
      nonPreferredColors: "dzeltens",
      equipmentRequired: "navigācija",
      dealVat21Required: true,
    });
    const filled = fillFilterGaps(fromUrl, fromOrder);
    expect(filled.yearFrom).toBe(2018);
    expect(filled.yearTo).toBe(2022);
    expect(filled.mileageTo).toBe(150000);
    expect(filled.priceTo).toBe(28000);
    expect(filled.drives).toEqual(["awd"]);
    expect(filled.colors).toEqual(["Black", "Grey"]);
    expect(filled.excludeColors).toEqual(["Yellow"]);
    expect(filled.vat).toEqual(["reclaimable"]);
    const url = ecarstradeSearchUrl(filled)!;
    expect(url).toContain("year_from=2018");
    expect(url).toContain("price_to=28000");
    expect(url).toContain("iriss_drive=awd");
    expect(url).toContain("iriss_exclude_color=Yellow");
    expect(url).toContain("vat[]=reclaimable");
  });

  it("sends order year, km, price, fuel and gearbox with ET param names and tightens a wider auction range", () => {
    const auction = parseListingSearchUrl(
      "https://www.auto1.com/en/app/merchant/cars?manufacturer=VOLVO&model=XC60&firstRegistrationFrom=2016&firstRegistrationTo=2024&maxMileage=200000&maxPrice=40000",
    );
    const order = filterFromOrderFields({
      productionYears: "2018–2021",
      maxMileage: "140 000",
      totalBudget: "26 000 €",
      engineType: "benzīns",
      transmission: "mehāniskā",
    });
    expect(order.yearFrom).toBe(2018);
    expect(order.yearTo).toBe(2021);
    const applied = applyEcarstradeOrderCriteria(auction, order);
    const url = ecarstradeSearchUrl(applied)!;
    const params = new URL(url).searchParams;
    expect(params.get("year_from")).toBe("2018");
    expect(params.get("year_to")).toBe("2021");
    expect(params.get("mileage_to")).toBe("140000");
    expect(params.get("price_to")).toBe("26000");
    expect(params.get("fuel[]")).toBe("Petrol");
    expect(params.get("gearbox[]")).toBe("Manual");
    const dieselAuction = parseListingSearchUrl(
      "https://www.auto1.com/en/app/merchant/cars?manufacturer=VOLVO&model=XC60&fuelTypes=DIESEL&gearboxes=AUTOMATIC",
    );
    const kept = applyEcarstradeOrderCriteria(
      dieselAuction,
      filterFromOrderFields({ engineType: "benzīns", transmission: "mehāniskā" }),
    );
    const keptUrl = new URL(ecarstradeSearchUrl(kept)!);
    expect(keptUrl.searchParams.get("fuel[]")).toBe("Diesel");
    expect(keptUrl.searchParams.get("gearbox[]")).toBe("Automatic");
  });

  it("treats reordered country params as the same search", () => {
    const a = "https://ecarstrade.com/search?mark[]=68&model[]=1866&country[]=BEL&country[]=NET&country[]=LUX&country[]=GER";
    const b = "https://ecarstrade.com/search?country[]=GER&model[]=1866&mark[]=68&country[]=BEL&country[]=LUX&country[]=NET";
    expect(sameEcarstradeSearch(a, b)).toBe(true);
    expect(sameEcarstradeSearch(a, "https://ecarstrade.com/search?mark[]=68&model[]=1510")).toBe(false);
  });

  it("reads eCarsTrade mark[] / model[] as catalog ids, not Autobid brandIds", () => {
    const volvo = parseListingSearchUrl(
      "https://ecarstrade.com/search?mark[]=68&model[]=1866&year_from=2018&mileage_to=150000&iriss_drive=awd",
    );
    expect(volvo.makeIds).toEqual([68]);
    expect(volvo.makeNames).toEqual(["Volvo"]);
    expect(volvo.modelId).toBe(1866);
    expect(volvo.modelName).toBe("XC60");
    expect(volvo.yearFrom).toBe(2018);
    expect(volvo.mileageTo).toBe(150000);
    expect(volvo.drives).toEqual(["awd"]);

    const nissan = parseListingSearchUrl("https://ecarstrade.com/search?mark[]=49");
    expect(nissan.makeIds).toEqual([49]);
    expect(nissan.makeNames).toEqual(["Nissan"]);

    const autobidVolvo = parseListingSearchUrl(
      "https://autobid.de/en/search-results?brandId-brand=49&name-model=XC60",
    );
    expect(autobidVolvo.makeIds).toEqual([68]);
    expect(autobidVolvo.makeNames).toEqual(["Volvo"]);
  });

  it("maps ALL_WHEEL and AUTOMATIC without treating substring all as wildcard", () => {
    const filter = parseListingSearchUrl(
      "https://www.auto1.com/en/app/merchant/cars?manufacturer=AUDI&driveTypes=ALL_WHEEL&gearboxes=AUTOMATIC",
    );
    expect(filter.drives).toEqual(["awd"]);
    expect(filter.gearboxes).toEqual(["Automatic"]);
  });

  it("does not treat XC60 model digits as engine cm3", () => {
    const filter = filterFromBrandModel("Volvo XC60");
    expect(filter.makeIds).toEqual([68]);
    expect(filter.modelId).toBe(1866);
    expect(filter.engineFromCc).toBeNull();
    expect(filter.engineToCc).toBeNull();
    const url = ecarstradeSearchUrl(filter)!;
    expect(url).not.toContain("engine_from=");
  });

  it("reads Auto1 manufacturers=MAKE|MODEL and gearTypes/reg/km without splitting pipes", () => {
    const filter = parseListingSearchUrl(
      "https://www.auto1.com/en/app/merchant/cars?manufacturers=BMW%7C2er%7C218d%20Gran%20Tourer%3BBMW%7C2er%7C220d%20Gran%20Tourer&gearTypes=automatic&regFrom=2016&regTo=2020&mileageTo=150000&fuelTypes=DIESEL",
    );
    expect(filter.makeIds).toEqual([7]);
    expect(filter.modelName).toMatch(/2 Series/i);
    expect(filter.gearboxes).toEqual(["Automatic"]);
    expect(filter.yearFrom).toBe(2016);
    expect(filter.yearTo).toBe(2020);
    expect(filter.mileageTo).toBe(150000);
    expect(filter.fuels).toEqual(["Diesel"]);
  });

  it("reads Openlane makesModels, registrationYears and numeric fuelTypes", () => {
    const filter = parseListingSearchUrl(
      "https://www.openlane.eu/en/findcar?makesModels=BMW,2%20Series&registrationYears=2018,2022&fuelTypes=100003&transmissionTypes=Automatic&mileages=0,175000&prices=0,20000",
    );
    expect(filter.makeIds).toEqual([7]);
    expect(filter.modelName).toMatch(/2 Series/i);
    expect(filter.yearFrom).toBe(2018);
    expect(filter.yearTo).toBe(2022);
    expect(filter.fuels).toEqual(["Diesel"]);
    expect(filter.gearboxes).toEqual(["Automatic"]);
    expect(filter.mileageTo).toBe(175000);
    expect(filter.priceTo).toBe(20000);
  });

  it("maps Autobid brandId 5 as Porsche, powerOutputTo and carList-manufacturermodel", () => {
    const porsche = parseListingSearchUrl(
      "https://autobid.de/en/search-results?brandId=5&carList-manufacturermodel=5;911&powerOutputFrom=150&powerOutputTo=250",
    );
    expect(porsche.makeNames).toEqual(["Porsche"]);
    expect(porsche.modelName).toMatch(/911/);
    expect(porsche.powerFromKw).toBe(150);
    expect(porsche.powerToKw).toBe(250);
    expect(porsche.unmapped.some((u) => u.key === "brandId")).toBe(false);
  });

  it("maps Autobid carList-e21 year and carList-e19 power", () => {
    const s60 = parseListingSearchUrl(
      "https://autobid.de/lv/meklesanas-rezultati?brandId=49&name=S60&carList-e21from=2004&carList-e21to=2009&carList-e19from=100&carList-e19to=120",
    );
    expect(s60.makeNames).toEqual(["Volvo"]);
    expect(s60.modelName).toBe("S60");
    expect(s60.yearFrom).toBe(2004);
    expect(s60.yearTo).toBe(2009);
    expect(s60.powerFromKw).toBe(100);
    expect(s60.powerToKw).toBe(120);
  });

  it("maps BMW iX40, MAN/Crafter/Sprinter and Jeep/Pajero brand rows", () => {
    const ix = filterFromBrandModel("BMW iX40");
    expect(ix.makeNames).toEqual(["BMW"]);
    expect(ix.modelName).toBe("iX");

    const vans = filtersFromBrandModel("MAN/Crafter/Sprinter");
    expect(vans.map((f) => f.makeNames[0])).toEqual(expect.arrayContaining(["MAN", "Volkswagen", "Mercedes"]));
    expect(vans.some((f) => f.makeNames[0] === "Volkswagen" && /Crafter/i.test(f.modelName))).toBe(true);
    expect(vans.some((f) => f.makeNames[0] === "Mercedes" && /Sprinter/i.test(f.modelName))).toBe(true);

    const jeep = filtersFromBrandModel("Jeep, Mitsubishi Pajero");
    expect(jeep.some((f) => f.makeNames[0] === "Jeep")).toBe(true);
    expect(jeep.some((f) => f.makeNames[0] === "Mitsubishi" && /Pajero/i.test(f.modelName))).toBe(true);
  });

  it("maps Autobid brandIds from the verified IRISS set and e17 diesel", () => {
    const bmw = parseListingSearchUrl("https://autobid.de/en/search-results?brandId-brand=1&name-model=X5&e17=3&registrationFrom=2014");
    expect(bmw.makeIds).toEqual([7]);
    expect(bmw.modelName).toBe("X5");
    expect(bmw.fuels).toEqual(["Diesel"]);
    expect(bmw.yearFrom).toBe(2014);
    const opel = parseListingSearchUrl("https://autobid.de/en/search-results?brandId=41&name-model=Vivaro");
    expect(opel.makeNames).toEqual(["Opel"]);
    const mercedes = parseListingSearchUrl("https://autobid.de/en/search-results?brandId-brand=271&name-model=Viano");
    expect(mercedes.makeNames).toEqual(["Mercedes"]);
  });

  it("reads Mobile.de ft/tr/p/fr/ml ranges and skips Porsche camper ms", () => {
    const filter = parseListingSearchUrl(
      "https://suchen.mobile.de/fahrzeuge/search.html?ms=19000;;;Vivaro&ms=20700;;;Wohnmobil&ms=20700;;;Evado&ft=DIESEL&tr=AUTOMATIC_GEAR&p=8000:15000&fr=2015:2018&ml=100000:2990000",
    );
    expect(filter.makeNames).toEqual(["Opel"]);
    expect(filter.makeNames).not.toContain("Porsche");
    expect(filter.fuels).toEqual(["Diesel"]);
    expect(filter.gearboxes).toEqual(["Automatic"]);
    expect(filter.priceFrom).toBe(8000);
    expect(filter.priceTo).toBe(15000);
    expect(filter.yearFrom).toBe(2015);
    expect(filter.yearTo).toBe(2018);
    expect(filter.mileageFrom).toBe(100000);
    expect(filter.mileageTo).toBe(2990000);
  });

  it("extracts models from plan titles: A6, W212, V-Klasse, Ceed, 3er, Traffic", () => {
    expect(filterFromBrandModel("Audi A6").modelName).toBe("A6");
    expect(filterFromBrandModel("Mercedes w212 (E250/300/350) ELEGANCE").modelName).toBe("E-Class");
    expect(filterFromBrandModel("Mercedes V klase").modelName).toBe("V-Class");
    expect(filterFromBrandModel("KIA CEED CD").modelName).toMatch(/cee'd/i);
    expect(filterFromBrandModel("BMW 3er ar M57 e90").modelName).toBe("3 Series");
    const vans = filterFromBrandModel("Opel Vivaro/Traffic (Evado/Westfalia) + VIANO");
    expect(vans.makeNames).toEqual(expect.arrayContaining(["Opel", "Renault", "Mercedes"]));
    expect(vans.makeNames).not.toContain("Porsche");
  });

  it("ignores Openlane auctionId single-car links", () => {
    expect(isSingleVehicleListingUrl("https://www.openlane.eu/en/findcar?auctionId=1234567")).toBe(true);
    expect(isSingleVehicleListingUrl("https://www.openlane.eu/en/car/1234567")).toBe(true);
    expect(isSingleVehicleListingUrl("https://www.openlane.eu/en/findcar?makes=volvo&models=xc60")).toBe(false);
    expect(isMobileDeListingUrl("https://suchen.mobile.de/fahrzeuge/search.html?ms=1900")).toBe(true);
    expect(isMobileDeListingUrl("https://www.mobile.de/fahrzeuge/search.html")).toBe(true);
    expect(isMobileDeListingUrl("https://www.auto1.com/en/app/merchant/cars?manufacturer=AUDI")).toBe(false);
  });

  it("ignores Auto1 id-only vehicle links and does not widen exact year/cm3/kW", () => {
    expect(isSingleVehicleListingUrl("https://www.auto1.com/en/app/merchant/cars?id=95a1ea78-e733-414d-a526-46e47e97efb3")).toBe(true);
    expect(
      isSingleVehicleListingUrl(
        "https://www.auto1.com/en/app/merchant/cars?id=95a1ea78-e733-414d-a526-46e47e97efb3&manufacturers=Opel%7CVivaro",
      ),
    ).toBe(false);
    const exact = widenExactSearchBounds({
      ...filterFromBrandModel("Audi A6"),
      yearFrom: 2018,
      yearTo: 2018,
      engineFromCc: 2000,
      engineToCc: 2000,
    });
    expect(exact.yearFrom).toBe(2018);
    expect(exact.yearTo).toBe(2018);
    expect(exact.engineFromCc).toBe(2000);
    expect(exact.engineToCc).toBe(2000);
    const kw = widenExactSearchBounds({
      ...filterFromBrandModel("Audi A6"),
      powerFromKw: 176,
      powerToKw: 176,
    });
    expect(kw.powerFromKw).toBe(176);
    expect(kw.powerToKw).toBe(176);
  });

  it("plans one exact ET URL per auction link and does not merge different km", () => {
    const plans = planEcarstradeSearchUrls({
      id: "exact-no-merge",
      brandModel: "Volvo XC60",
      listingLinkAuto1: [
        "https://www.auto1.com/en/app/merchant/cars?manufacturer=VOLVO&model=XC60&firstRegistrationFrom=2018&fuelTypes=DIESEL&maxMileage=150000",
      ],
      listingLinkOpenline: [
        "https://www.openlane.eu/en/findcar?makes=volvo&models=xc60&yearFrom=2018&fuels=diesel&mileageTo=180000",
      ],
      listingLinkAutobid: [""],
      listingLinkMobile: [""],
      listingLinkEcarstrade: [""],
    });
    expect(plans).toHaveLength(2);
    const auto1 = plans.find((p) => p.sourceUrls.some((u) => u.includes("auto1.com")));
    const openlane = plans.find((p) => p.sourceUrls.some((u) => u.includes("openlane")));
    expect(auto1?.filter.mileageTo).toBe(150000);
    expect(openlane?.filter.mileageTo).toBe(180000);
    expect(auto1?.url).toContain("mileage_to=150000");
    expect(openlane?.url).toContain("mileage_to=180000");
    expect(auto1?.url).not.toContain("mileage_to=180000");
  });

  it("does not generate ET from Mobile.de or brandModel when there is no auction link", () => {
    const plans = planEcarstradeSearchUrls({
      id: "audi-a6-mobile",
      brandModel: "Audi A6",
      listingLinkAuto1: [""],
      listingLinkOpenline: [""],
      listingLinkAutobid: [""],
      listingLinkMobile: [
        "https://suchen.mobile.de/fahrzeuge/search.html?ms=1900&fuels=PETROL&minFirstRegistrationDate=2017",
      ],
      listingLinkEcarstrade: [""],
    });
    expect(plans).toEqual([]);
  });

  it("plans Opel Vivaro/Traffic without Porsche and with Openlane years", () => {
    const plans = planEcarstradeSearchUrls({
      id: "vivaro-test",
      brandModel: "Opel Vivaro/Traffic (Evado/Westfalia) + VIANO",
      listingLinkAuto1: [
        "https://www.auto1.com/en/app/merchant/cars?id=95a1ea78-e733-414d-a526-46e47e97efb3&manufacturers=Opel%7CVivaro%3BRenault%7CTrafic&gearTypes=manual&regFrom=2009&regTo=2014&mileageTo=250000",
      ],
      listingLinkOpenline: ["https://www.openlane.eu/en/findcar?makesModels=Opel,Vivaro%7CRenault,Trafic&registrationYears=2009,2014&fuelTypes=100003"],
      listingLinkAutobid: ["https://autobid.de/en/search-results?brandId-brand=41&brandId=25&name-model=Vivaro&e17=3"],
      listingLinkMobile: [
        "https://suchen.mobile.de/fahrzeuge/search.html?ms=20700;;;Wohnmobil&ms=19000;;;Vivaro&ft=DIESEL",
      ],
      listingLinkEcarstrade: [""],
    });
    expect(plans.length).toBeGreaterThan(0);
    const joined = plans.map((p) => p.url).join(" ");
    expect(joined).not.toContain("mark[]=54");
    expect(plans.some((p) => p.filter.makeNames.includes("Opel"))).toBe(true);
    expect(plans.some((p) => p.filter.yearFrom === 2009 && p.filter.yearTo === 2014)).toBe(true);
    expect(plans.some((p) => p.filter.fuels.includes("Diesel"))).toBe(true);
    expect(plans.every((p) => p.sourceUrls.every((u) => !/mobile\.de/i.test(u)))).toBe(true);
  });

  it("keeps auction Pajero links and does not add a Jeep ET from the form", () => {
    const pajero = planEcarstradeSearchUrls({
      id: "jeep-pajero",
      brandModel: "Jeep, Mitsubishi Pajero",
      listingLinkAuto1: [
        "https://www.auto1.com/en/app/merchant/cars?manufacturers=Mitsubishi%7CPajero&fuelTypes=DIESEL",
      ],
      listingLinkOpenline: ["https://www.openlane.eu/en/findcar?makesModels=Mitsubishi,Pajero"],
      listingLinkAutobid: ["https://autobid.de/lv/meklesanas-rezultati?brandId=37&name=Pajero"],
      listingLinkMobile: [""],
      listingLinkEcarstrade: [""],
    });
    expect(pajero.some((p) => p.filter.makeNames.includes("Mitsubishi") && /Pajero/i.test(p.filter.modelName))).toBe(true);
    expect(pajero.every((p) => p.sourceUrls.length > 0)).toBe(true);
    expect(pajero.some((p) => p.filter.makeNames.includes("Jeep") && p.sourceUrls.length === 0)).toBe(false);

    const vans = planEcarstradeSearchUrls({
      id: "vans",
      brandModel: "MAN/Crafter/Sprinter",
      listingLinkAuto1: [""],
      listingLinkOpenline: [""],
      listingLinkAutobid: [""],
      listingLinkMobile: [""],
      listingLinkEcarstrade: [""],
    });
    expect(vans).toEqual([]);
  });

  it("keeps Auto1 stacked criteria and does not add order-form seats or colors", () => {
    const plans = planEcarstradeSearchUrls({
      id: "stacked-keep",
      brandModel: "Volvo XC60",
      productionYears: "2018-2022",
      maxMileage: "150000",
      totalBudget: "28000",
      engineType: "dīzelis",
      transmission: "automāts",
      bodyType: "SUV",
      seatCount: "5",
      preferredColors: "melns",
      listingLinkAuto1: [
        "https://www.auto1.com/en/app/merchant/cars?manufacturer=VOLVO&model=XC60&firstRegistrationFrom=2018&firstRegistrationTo=2022&fuelTypes=DIESEL&gearboxes=AUTOMATIC&bodyTypes=SUV&maxMileage=150000&maxPrice=28000",
      ],
      listingLinkOpenline: [""],
      listingLinkAutobid: [""],
      listingLinkMobile: [""],
      listingLinkEcarstrade: [""],
    });
    expect(plans).toHaveLength(1);
    const url = plans[0]!.url;
    expect(url).toContain("year_from=2018");
    expect(url).toContain("year_to=2022");
    expect(url).toContain("mileage_to=150000");
    expect(url).toContain("price_to=28000");
    expect(url).toContain("fuel[]=Diesel");
    expect(url).toContain("gearbox[]=Automatic");
    expect(url).toMatch(/category\[\]=/);
    expect(url).not.toContain("places_from=5");
    expect(url).not.toContain("color[]=Black");
  });

  it("does not clamp Openlane or Autobid with the order mileage and price, so ET 3 stays", () => {
    const plans = planEcarstradeSearchUrls({
      id: "xc60-three",
      brandModel: "Volvo XC60",
      productionYears: "2018-2022",
      maxMileage: "150000",
      totalBudget: "28000",
      engineType: "dīzelis",
      transmission: "automāts",
      listingLinkAuto1: [
        "https://www.auto1.com/en/app/merchant/cars?manufacturer=VOLVO&model=XC60&firstRegistrationFrom=2018&firstRegistrationTo=2022&fuelTypes=DIESEL&maxMileage=150000&maxPrice=28000",
      ],
      listingLinkOpenline: [
        "https://www.openlane.eu/en/findcar?makes=volvo&models=xc60&yearFrom=2018&yearTo=2022&fuels=diesel&transmissions=automatic&mileageTo=180000",
      ],
      listingLinkAutobid: [
        "https://autobid.de/en/search-results?brandId-brand=49&name-model=XC60&yearFrom-year=2018&mileageTo-mileage=160000&gearboxId-gearbox=Automatic",
      ],
      listingLinkMobile: [""],
      listingLinkEcarstrade: [""],
    });
    expect(plans).toHaveLength(3);
    const openlane = plans.find((p) => p.sourceUrls.some((u) => u.includes("openlane")));
    const autobid = plans.find((p) => p.sourceUrls.some((u) => u.includes("autobid")));
    expect(openlane?.url).toContain("mileage_to=180000");
    expect(openlane?.url).not.toContain("price_to=");
    expect(autobid?.url).toContain("mileage_to=160000");
    expect(autobid?.url).not.toContain("price_to=");
    expect(autobid?.url).not.toContain("year_to=");
  });

  it("maps Autobid e70 / gearboxId gearbox and does not invent brandId 12 as Mercedes", () => {
    expect(AUTOBID_BRAND_ID_TO_NAME["12"]).toBeUndefined();
    expect(AUTOBID_BRAND_ID_TO_NAME["1"]).toBe("BMW");
    expect(AUTOBID_BRAND_ID_TO_NAME["2"]).toBe("Volkswagen");
    expect(AUTOBID_BRAND_ID_TO_NAME["3"]).toBe("Mercedes");
    expect(AUTOBID_BRAND_ID_TO_NAME["10"]).toBe("Audi");
    expect(AUTOBID_BRAND_ID_TO_NAME["49"]).toBe("Volvo");
    const raw = parseListingSearchUrl("https://autobid.de/en/search-results?brandId-brand=12&name-model=E");
    expect(raw.makeIds).toEqual([]);
    expect(raw.unmapped.some((u) => u.key === "brandId" && u.value === "12")).toBe(true);
    const e70 = parseListingSearchUrl(
      "https://autobid.de/en/search-results?brandId=3&name-model=E&e70=Automatic",
    );
    expect(e70.makeNames).toEqual(["Mercedes"]);
    expect(e70.modelName).toBe("E-Class");
    expect(e70.modelId).toBe(815);
    expect(e70.gearboxes).toEqual(["Automatic"]);
    const idKey = parseListingSearchUrl(
      "https://autobid.de/lv/meklesanas-rezultati?brandId=1&name=5&gearboxId=Automatic&carList-e70=Automatik",
    );
    expect(idKey.makeNames).toEqual(["BMW"]);
    expect(idKey.modelName).toBe("5 Series");
    expect(idKey.modelId).toBe(83);
    expect(idKey.gearboxes).toEqual(["Automatic"]);
  });

  it("maps live Autobid e70=1|3|4 and carList-e70 from production order URLs", () => {
    const vitara = parseListingSearchUrl(
      "https://autobid.de/lv/meklesanas-rezultati?radiusSearchZipcode=3101&brandId=48&name=Vitara&e17=2&registrationFrom=2014&registrationTo=2019&kilometresTo=170000&e70=1",
    );
    expect(vitara.gearboxes).toEqual(["Manual"]);
    expect(ecarstradeSearchUrl(vitara)).toContain("gearbox[]=Manual");

    const passat = parseListingSearchUrl(
      "https://autobid.de/lv/meklesanas-rezultati?radiusSearchZipcode=3101&brandId-brand=2&name-model=Passat&e17=3&kilometresFrom-e68_1=140000&kilometresTo-e68_2=220000&e70=3&registrationTo=2023&registrationFrom=2018&sortingType=auctionStartDate-ASCENDING",
    );
    expect(passat.gearboxes).toEqual(["Automatic"]);

    const a6Meh = parseListingSearchUrl(
      "https://autobid.de/en/search-results?radiusSearchZipcode=3101&brandId-brand=10&name-model=A6&e70=1&sortingType=auctionStartDate-ASCENDING",
    );
    expect(a6Meh.gearboxes).toEqual(["Manual"]);

    const superb = parseListingSearchUrl(
      "https://autobid.de/lv/meklesanas-rezultati?radiusSearchZipcode=3101&brandId=7&e17=2&registrationFrom=2014&e70=1&name=Superb",
    );
    expect(superb.gearboxes).toEqual(["Manual"]);

    const vito = parseListingSearchUrl(
      "https://autobid.de/lv/meklesanas-rezultati?radiusSearchZipcode=3101&brandId-brand=3&name-model=vito&registrationFrom=2020&e70=3&e17=3&registrationTo=2024&sortingType=auctionStartDate-ASCENDING",
    );
    expect(vito.gearboxes).toEqual(["Automatic"]);

    const x3 = parseListingSearchUrl(
      "https://autobid.de/lv/meklesanas-rezultati?radiusSearchZipcode=3101&brandId-brand=1&name-model=X3&registrationTo=2019&registrationFrom=2014&e17=3&e70=3&sortingType=auctionStartDate-ASCENDING&carList-e21from=2014&carList-e21to=2020&carList-e19to=140",
    );
    expect(x3.gearboxes).toEqual(["Automatic"]);

    const golfBoth = parseListingSearchUrl(
      "https://autobid.de/en/search-results?radiusSearchZipcode=3101&brandId-brand=2&name-model=Golf&e17=3&kilometresTo-e68_2=200000&e70=1&powerOutputFrom=110&kilometresFrom-e68_1=0&sortingType=auctionStartDate-ASCENDING&carList-e70=3&carList-e21from=2018&carList-e68to=200000&carList-e17=3&carList-e21to=2024&carList-e19from=110",
    );
    expect(golfBoth.gearboxes).toEqual(["Manual", "Automatic"]);

    const e220 = parseListingSearchUrl(
      "https://autobid.de/en/search-results?radiusSearchZipcode=3101&brandId-brand=3&registrationTo=2021&sortingType=auctionStartDate-ASCENDING&carList-category=1;6&carList-e17=3&carList-e70=4&carList-e21to=2021&carList-e21from=2016&carList-e19from=140&carList-e19to=200",
    );
    expect(e220.gearboxes).toEqual(["Automatic"]);

    const ateca = parseListingSearchUrl(
      "https://autobid.de/lv/meklesanas-rezultati?radiusSearchZipcode=3101&brandId-brand=44&name-model=Ateca&e17=3&e70=1&sortingType=auctionStartDate-ASCENDING",
    );
    expect(ateca.gearboxes).toEqual(["Manual"]);

    const sharan = parseListingSearchUrl(
      "https://autobid.de/en/search-results?radiusSearchZipcode=3101&brandId-brand=2&name-model=sharan&sortingType=auctionStartDate-ASCENDING&carList-e17=3&carList-e70=4",
    );
    expect(sharan.gearboxes).toEqual(["Automatic"]);

    const tiguan = parseListingSearchUrl(
      "https://autobid.de/en/search-results?radiusSearchZipcode=3101&brandId-brand=2&name-model=Tiguan&registrationTo=2015&e17=3&e70=3&sortingType=auctionStartDate-ASCENDING&carList-e21from=2011&carList-e19from=103&carList-e19to=103",
    );
    expect(tiguan.gearboxes).toEqual(["Automatic"]);

    const granTourer = parseListingSearchUrl(
      "https://autobid.de/en/search-results?radiusSearchZipcode=3101&brandId-brand=1&name-model=Gran+Tourer&e17=2&e17=3&kilometresFrom-e68_1=80000&kilometresTo-e68_2=240000&powerOutputFrom=110&sortingType=auctionStartDate-ASCENDING&carList-e70=4&carList-e68to=230000&carList-e21to=2023&carList-e21from=2016&carList-e17=3",
    );
    expect(granTourer.gearboxes).toEqual(["Automatic"]);

    const kuga = parseListingSearchUrl(
      "https://autobid.de/en/search-results?radiusSearchZipcode=3101&brandId-brand=22&name-model=kuga&e17=3&e70=1&sortingType=auctionStartDate-ASCENDING&carList-e21from=2019",
    );
    expect(kuga.gearboxes).toEqual(["Manual"]);

    const xc60 = parseListingSearchUrl(
      "https://autobid.de/lv/meklesanas-rezultati?radiusSearchZipcode=3101&brandId-brand=49&name-model=XC60&e17=3&registrationTo=2017&sortingType=auctionStartDate-ASCENDING&carList-e19from=100&carList-e19to=120&carList-e21from=2013&carList-e21to=2017&carList-e70=4",
    );
    expect(xc60.gearboxes).toEqual(["Automatic"]);

    const kodiaqTarraco = parseListingSearchUrl(
      "https://autobid.de/en/search-results?radiusSearchZipcode=3101&brandId-brand=7&brandId-brand=44&e17=3&e70=3&kilometresFrom-e68_1=120000&registrationFrom=2017&registrationTo=2023&powerOutputFrom=110&sortingType=auctionStartDate-ASCENDING",
    );
    expect(kodiaqTarraco.gearboxes).toEqual(["Automatic"]);

    const mini105 = parseListingSearchUrl(
      "https://autobid.de/lv/meklesanas-rezultati?radiusSearchZipcode=3101&kilometresFrom-e68_1=100000&brandId-brand=105&sortingType=auctionStartDate-ASCENDING&carList-e70=4",
    );
    expect(mini105.makeNames).toEqual(["Mini"]);
    expect(mini105.gearboxes).toEqual(["Automatic"]);
    expect(ecarstradeSearchUrl(mini105)).toContain("gearbox[]=Automatic");
  });

  it("maps Auto1 limo/combi, Openlane MPV/Berline/Break, Autobid category and mobile.de SportsCar", () => {
    expect(parseListingSearchUrl("https://www.auto1.com/en/app/merchant/cars?bodyTypes=LIMO").bodies).toEqual(["Saloon"]);
    expect(parseListingSearchUrl("https://www.auto1.com/en/app/merchant/cars?bodyTypes=COMBI").bodies).toEqual([
      "Estate Car",
    ]);
    expect(parseListingSearchUrl("https://www.auto1.com/en/app/merchant/cars?bodyTypes=LIMOUSINE").bodies).toEqual([
      "Saloon",
    ]);
    expect(parseListingSearchUrl("https://www.openlane.eu/en/findcar?bodyTypes=mpv").bodies).toEqual(["Van/Minibus"]);
    expect(parseListingSearchUrl("https://www.openlane.eu/en/findcar?bodyTypes=berline").bodies).toEqual(["Saloon"]);
    expect(parseListingSearchUrl("https://www.openlane.eu/en/findcar?bodyTypes=break").bodies).toEqual(["Estate Car"]);
    expect(
      parseListingSearchUrl("https://autobid.de/en/search-results?categoryId-category=Limousine").bodies,
    ).toEqual(["Saloon"]);
    expect(parseListingSearchUrl("https://autobid.de/en/search-results?carList-category=Kombi").bodies).toEqual([
      "Estate Car",
    ]);
    expect(parseListingSearchUrl("https://suchen.mobile.de/fahrzeuge/search.html?c=SportsCar").bodies).toEqual([
      "Sports Car/Coupe",
    ]);
  });

  it("maps live Autobid categoryId-category and carList-category=1;6 from production URLs", () => {
    const vans = parseListingSearchUrl(
      "https://autobid.de/lv/meklesanas-rezultati?radiusSearchZipcode=3101&e17=3&brandId-brand=25&brandId-brand=41&brandId-brand=38&registrationTo=2012&registrationFrom=2007&categoryId-category=10&categoryId-category=8&categoryId-category=56&sortingType=auctionStartDate-ASCENDING",
    );
    expect(vans.bodies).toEqual(["Van/Minibus"]);
    expect(vans.unmapped.some((u) => u.key === "category")).toBe(false);
    expect(ecarstradeSearchUrl(vans)).toContain("category[]=Van%2FMinibus");

    const vivaro = parseListingSearchUrl(
      "https://autobid.de/en/search-results?radiusSearchZipcode=3101&brandId-brand=41&brandId-brand=25&categoryId-category=10&e17=3&registrationTo=2014&registrationFrom=2010&sortingType=auctionStartDate-ASCENDING",
    );
    expect(vivaro.bodies).toEqual(["Van/Minibus"]);

    const e220 = parseListingSearchUrl(
      "https://autobid.de/en/search-results?radiusSearchZipcode=3101&brandId-brand=3&registrationTo=2021&sortingType=auctionStartDate-ASCENDING&carList-category=1;6&carList-e17=3&carList-e70=4&carList-e21to=2021&carList-e21from=2016&carList-e19from=140&carList-e19to=200",
    );
    expect(e220.bodies).toEqual(["Saloon"]);
    expect(e220.unmapped.some((u) => u.key === "category" && u.value === "1")).toBe(false);

    const w212 = parseListingSearchUrl(
      "https://autobid.de/lv/meklesanas-rezultati?radiusSearchZipcode=3101&e17=3&registrationTo=2012&brandId-brand=3&name-model=E&sortingType=auctionStartDate-ASCENDING&carList-category=1;17&carList-category=1;6",
    );
    expect(w212.bodies).toEqual(["Estate Car", "Saloon"]);
  });

  it("keeps mobile.de fr=2018: as year_from only and AUTOMATIC_GEAR as Automatic only", () => {
    expect(parseZeroUnboundedRange("2018:")).toEqual({ from: 2018, to: null });
    expect(parseMobileDeColonRange("2018:")).toEqual({ from: 2018, to: null });
    expect(parseMobileDeColonRange("2018")).toEqual({ from: 2018, to: null });
    expect(parseMobileDeColonRange("2018:2022")).toEqual({ from: 2018, to: 2022 });
    const filter = parseListingSearchUrl(
      "https://suchen.mobile.de/fahrzeuge/search.html?ms=17700;;;Pajero&tr=AUTOMATIC_GEAR&fr=2018:",
    );
    expect(filter.yearFrom).toBe(2018);
    expect(filter.yearTo).toBeNull();
    expect(filter.gearboxes).toEqual(["Automatic"]);
    expect(filter.gearboxes).not.toContain("Semi-automatic");
    const url = ecarstradeSearchUrl(filter)!;
    expect(url).toContain("year_from=2018");
    expect(url).not.toContain("year_to=");
    expect(url).toContain("gearbox[]=Automatic");
    expect(url).not.toContain("Semi-automatic");

    const tiguanAllspace = parseListingSearchUrl(
      "https://suchen.mobile.de/fahrzeuge/search.html?cc=1450%3A2600&cn=DE&dam=false&fr=2018%3A&ft=DIESEL&isSearchRequest=true&ml=%3A160000&ms=25200%3B54%3B%3BAllspace&od=down&p=15000%3A24000&s=Car&sb=doc&tr=AUTOMATIC_GEAR&tr=SEMIAUTOMATIC_GEAR&vat=1&vc=Car",
    );
    expect(tiguanAllspace.gearboxes).toEqual(["Automatic"]);
    expect(tiguanAllspace.gearboxes).not.toContain("Semi-automatic");
    expect(ecarstradeSearchUrl(tiguanAllspace)).not.toContain("Semi-automatic");
  });

  it("maps Pajero, Mercedes E, BMW 5 and Auto1 BMW 5er+7er as exact model[] values", () => {
    const pajero = parseListingSearchUrl("https://suchen.mobile.de/fahrzeuge/search.html?ms=17700;;;Pajero");
    expect(pajero.makeNames).toEqual(["Mitsubishi"]);
    expect(pajero.modelName).toBe("Pajero");
    expect(pajero.modelId).toBe(897);
    expect(ecarstradeSearchUrl(pajero)).toContain("model[]=897");

    const mercedesE = parseListingSearchUrl("https://autobid.de/en/search-results?brandId=3&name-model=E");
    expect(mercedesE.makeNames).toEqual(["Mercedes"]);
    expect(mercedesE.modelName).toBe("E-Class");
    expect(mercedesE.modelId).toBe(815);
    expect(ecarstradeSearchUrl(mercedesE)).toContain("model[]=815");

    const bmw5 = parseListingSearchUrl("https://autobid.de/en/search-results?brandId=1&name-model=5");
    expect(bmw5.makeNames).toEqual(["BMW"]);
    expect(bmw5.modelName).toBe("5 Series");
    expect(bmw5.modelId).toBe(83);
    expect(ecarstradeSearchUrl(bmw5)).toContain("model[]=83");

    const both = parseListingSearchUrl(
      "https://www.auto1.com/en/app/merchant/cars?manufacturers=BMW%7C5er;BMW%7C7er",
    );
    expect(both.makeIds).toEqual([7]);
    expect(both.modelIds).toEqual([83, 85]);
    expect(both.modelName).toMatch(/5 Series/);
    expect(both.modelName).toMatch(/7 Series/);
    const bothUrl = ecarstradeSearchUrl(both)!;
    expect(bothUrl).toContain("model[]=83");
    expect(bothUrl).toContain("model[]=85");

    const brand = filterFromBrandModel("BMW 5/7");
    expect(brand.makeIds).toEqual([7]);
    expect(brand.modelIds).toEqual([83, 85]);

    const jeepPajero = planEcarstradeSearchUrls({
      id: "md-pajero",
      brandModel: "Jeep, Mitsubishi Pajero",
      listingLinkAuto1: [""],
      listingLinkOpenline: [""],
      listingLinkAutobid: [""],
      listingLinkMobile: ["https://suchen.mobile.de/fahrzeuge/search.html?ms=17700;;;"],
      listingLinkEcarstrade: [""],
    });
    expect(jeepPajero).toEqual([]);

    const fakeBrand = planEcarstradeSearchUrls({
      id: "ab-e220-12",
      brandModel: "Mercedes E",
      listingLinkAuto1: [""],
      listingLinkOpenline: [""],
      listingLinkAutobid: [
        "https://autobid.de/en/search-results?brandId-brand=12&name-model=E%20220&yearFrom-year=2017",
      ],
      listingLinkMobile: [""],
      listingLinkEcarstrade: [""],
    });
    expect(fakeBrand).toEqual([]);

    const e220 = planEcarstradeSearchUrls({
      id: "ab-e220",
      brandModel: "Mercedes E",
      listingLinkAuto1: [""],
      listingLinkOpenline: [""],
      listingLinkAutobid: [
        "https://autobid.de/en/search-results?brandId-brand=3&name-model=E%20220&yearFrom-year=2017",
      ],
      listingLinkMobile: [""],
      listingLinkEcarstrade: [""],
    });
    expect(e220[0]?.filter.makeNames).toEqual(["Mercedes"]);
    expect(e220[0]?.filter.modelName).toMatch(/E-Class|E 220/);
    expect(e220[0]?.url).toMatch(/model\[\]=(815|2530)/);
    expect(e220[0]?.sourceUrls[0]).toContain("autobid.de");
  });

  it("emits all mark[] and model[] pairs from live multi-make Auto1/Openlane/Autobid URLs", () => {
    const traficAuto1 = parseListingSearchUrl(
      "https://www.auto1.com/en/app/merchant/cars?channel=24h&countries=BE%3BDE%3BNL&dir=asc&fuelTypes=diesel&gearTypes=manual&manufacturers=Nissan%7CPrimastar%3BRenault%7CTrafic%3BOpel%7CVivaro&page=1&powerUnit=hp&priceMax=9000&priceMin=5000&regFrom=2007&regTo=2012",
    );
    expect(traficAuto1.makeNames).toEqual(expect.arrayContaining(["Nissan", "Renault", "Opel"]));
    expect(traficAuto1.modelIds).toEqual(expect.arrayContaining([2741, 1146, 1818]));
    const traficAuto1Url = ecarstradeSearchUrl(traficAuto1)!;
    expect(traficAuto1Url).toContain("mark[]=49");
    expect(traficAuto1Url).toContain("mark[]=55");
    expect(traficAuto1Url).toContain("mark[]=50");
    expect(traficAuto1Url).toContain("model[]=2741");
    expect(traficAuto1Url).toContain("model[]=1146");
    expect(traficAuto1Url).toContain("model[]=1818");

    const traficOpenlane = parseListingSearchUrl(
      "https://www.openlane.eu/en/findcar?makesModels=Renault%2CTrafic%7COpel%2CVivaro%7CNissan%2CPrimastar&fuelTypes=100003&transmissionTypes=Manual&registrationYears=0%2C2012",
    );
    expect(traficOpenlane.modelIds).toEqual(expect.arrayContaining([1146, 1818, 2741]));
    expect(ecarstradeSearchUrl(traficOpenlane)).toContain("model[]=1146");

    const kodiaqAuto1 = parseListingSearchUrl(
      "https://www.auto1.com/en/app/merchant/cars?channel=24h&dir=asc&manufacturers=Seat%7CTarraco%7C2.0%20TDI%3BSkoda%7CKodiaq%7C2.0%20TDI&page=1&powerUnit=hp&priceMax=16000",
    );
    expect(kodiaqAuto1.modelIds).toEqual(expect.arrayContaining([3074, 2850]));
    const kodiaqAuto1Url = ecarstradeSearchUrl(kodiaqAuto1)!;
    expect(kodiaqAuto1Url).toContain("model[]=3074");
    expect(kodiaqAuto1Url).toContain("model[]=2850");

    const kodiaqOpenlane = parseListingSearchUrl(
      "https://www.openlane.eu/ru/findcar?makesModels=Skoda%2CKodiaq%7CSeat%2CTarraco&fuelTypes=100003&transmissionTypes=Automatic&mileages=125000%2C0",
    );
    expect(kodiaqOpenlane.modelIds).toEqual(expect.arrayContaining([2850, 3074]));

    const tiguanPassatE = parseListingSearchUrl(
      "https://www.auto1.com/en/app/merchant/cars?channel=24h&fuelTypes=diesel&gearTypes=automatic&manufacturers=Volkswagen%7CTiguan%20Allspace%7C2.0%20TDI%3BVolkswagen%7CPassat%7C2.0%20TDI%3BVolkswagen%7CTiguan%7C2.0%20TDI%3BMercedes-Benz%7CE-Klasse",
    );
    expect(tiguanPassatE.makeNames).toEqual(expect.arrayContaining(["Volkswagen", "Mercedes"]));
    expect(tiguanPassatE.modelIds).toEqual(expect.arrayContaining([3183, 1460, 1860, 815]));
    const tiguanPassatEUrl = ecarstradeSearchUrl(tiguanPassatE)!;
    expect(tiguanPassatEUrl).toContain("model[]=3183");
    expect(tiguanPassatEUrl).toContain("model[]=1460");
    expect(tiguanPassatEUrl).toContain("model[]=1860");
    expect(tiguanPassatEUrl).toContain("model[]=815");

    const tiguanPassatOpenlane = parseListingSearchUrl(
      "https://www.openlane.eu/en/findcar?makesModels=Volkswagen%2CPassat%7CMercedes-Benz%2CE%7CVolkswagen&bodyTypes=Break%2CHatchback%2CSUV&fuelTypes=100003&transmissionTypes=Automatic",
    );
    expect(tiguanPassatOpenlane.makeNames).toEqual(expect.arrayContaining(["Volkswagen", "Mercedes"]));
    expect(tiguanPassatOpenlane.modelIds).toEqual(expect.arrayContaining([1460, 815]));
    expect(ecarstradeSearchUrl(tiguanPassatOpenlane)).toContain("model[]=1460");
    expect(ecarstradeSearchUrl(tiguanPassatOpenlane)).toContain("model[]=815");

    const alhambra = parseListingSearchUrl(
      "https://www.auto1.com/en/app/merchant/cars?channel=24h&fuelTypes=diesel&gearTypes=automatic&manufacturers=Seat%7CAlhambra%7C2.0%20TDI%3BVolkswagen%7CSharan%7C2.0%20TDI",
    );
    expect(alhambra.modelIds).toEqual(expect.arrayContaining([1181, 1472]));
    expect(ecarstradeSearchUrl(alhambra)).toContain("model[]=1181");
    expect(ecarstradeSearchUrl(alhambra)).toContain("model[]=1472");

    const touareg = parseListingSearchUrl(
      "https://autobid.de/en/search-results?brandId-brand=2&brandId-brand=10&brandId-brand=5&name-model=Touareg",
    );
    expect(touareg.makeNames).toEqual(expect.arrayContaining(["Volkswagen", "Audi", "Porsche"]));
    expect(touareg.modelIds).toContain(1475);
    const touaregUrl = ecarstradeSearchUrl(touareg)!;
    expect(touaregUrl).toContain("mark[]=67");
    expect(touaregUrl).toContain("mark[]=5");
    expect(touaregUrl).toContain("mark[]=54");
    expect(touaregUrl).toContain("model[]=1475");

    const kodiaqAutobid = planEcarstradeSearchUrls({
      id: "kodiaq-tarraco-ab",
      brandModel: "Škoda Kodiaq / Seat Tarraco",
      listingLinkAuto1: [""],
      listingLinkOpenline: [""],
      listingLinkAutobid: [
        "https://autobid.de/en/search-results?radiusSearchZipcode=3101&brandId-brand=7&brandId-brand=44&e17=3&e70=3&kilometresFrom-e68_1=120000&registrationFrom=2017&registrationTo=2023&powerOutputFrom=110&sortingType=auctionStartDate-ASCENDING",
      ],
      listingLinkMobile: [""],
      listingLinkEcarstrade: [""],
    });
    const ab = kodiaqAutobid.find((p) => p.sourceUrls.some((u) => u.includes("autobid.de")));
    expect(ab?.filter.gearboxes).toEqual(["Automatic"]);
    expect(ab?.filter.modelIds).toEqual(expect.arrayContaining([2850, 3074]));
    expect(ab?.url).toContain("model[]=2850");
    expect(ab?.url).toContain("model[]=3074");
    expect(ab?.url).toContain("gearbox[]=Automatic");

    const vans = planEcarstradeSearchUrls({
      id: "trafic-vans-ab",
      brandModel: "Renault Traffic, Vivaro, Primastar (Caddy Maxi) ROLANDS",
      listingLinkAuto1: [""],
      listingLinkOpenline: [""],
      listingLinkAutobid: [
        "https://autobid.de/lv/meklesanas-rezultati?radiusSearchZipcode=3101&e17=3&brandId-brand=25&brandId-brand=41&brandId-brand=38&registrationTo=2012&registrationFrom=2007&categoryId-category=10&categoryId-category=8&categoryId-category=56&sortingType=auctionStartDate-ASCENDING",
      ],
      listingLinkMobile: [""],
      listingLinkEcarstrade: [""],
    });
    const vanPlan = vans.find((p) => p.sourceUrls.some((u) => u.includes("autobid.de")));
    expect(vanPlan?.filter.bodies).toEqual(["Van/Minibus"]);
    expect(vanPlan?.filter.modelIds).toEqual(expect.arrayContaining([1146, 1818, 2741]));
    expect(vanPlan?.url).toContain("model[]=1146");
    expect(vanPlan?.url).toContain("model[]=1818");
    expect(vanPlan?.url).toContain("model[]=2741");
    expect(vanPlan?.url).toContain("category[]=Van%2FMinibus");
  });
});
