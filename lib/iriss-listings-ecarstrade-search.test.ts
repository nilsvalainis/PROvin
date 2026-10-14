import { describe, expect, it } from "vitest";
import { resolveEcarstradeMake, resolveEcarstradeModel, resolveMakeModelFromBrand } from "@/lib/iriss-listings-ecarstrade-catalog";
import { isSingleVehicleListingUrl } from "@/lib/iriss-listings-ecarstrade-criteria";
import {
  ecarstradeApiStackFields,
  ecarstradeSearchUrl,
  fillFilterGaps,
  fillMakeModelFromBrand,
  filterFromBrandModel,
  filterFromOrderFields,
  filtersFromBrandModel,
  loosenStackedEcarstradeFilter,
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

  it("loosens stacked seats/colors/exact kW/body from the ET API URL", () => {
    const stacked = {
      ...filterFromBrandModel("Volvo XC60"),
      yearFrom: 2018,
      yearTo: 2022,
      mileageTo: 150000,
      priceTo: 28000,
      powerFromKw: 100,
      powerToKw: 100,
      fuels: ["Diesel"],
      gearboxes: ["Automatic"],
      bodies: ["SUV"],
      colors: ["Black", "Grey"],
      seatsFrom: 5,
      seatsTo: 5,
      doorsFrom: 5,
      doorsTo: 5,
      vat: ["reclaimable"],
    };
    expect(ecarstradeApiStackFields(stacked)).toEqual(
      expect.arrayContaining(["model", "year", "seats", "color", "power", "vat"]),
    );
    const loose = loosenStackedEcarstradeFilter(stacked);
    expect(loose.seatsFrom).toBeNull();
    expect(loose.colors).toEqual([]);
    expect(loose.vat).toEqual([]);
    expect(loose.powerFromKw).toBeNull();
    expect(loose.bodies).toEqual([]);
    expect(loose.yearFrom).toBe(2018);
    expect(loose.mileageTo).toBe(150000);
    expect(loose.fuels).toEqual(["Diesel"]);
    expect(loose.gearboxes).toEqual([]);
    expect(loose.priceTo).toBeNull();
    const url = ecarstradeSearchUrl(loose)!;
    expect(url).not.toContain("places_from=");
    expect(url).not.toContain("color[]=");
    expect(url).not.toContain("vat[]=");
    expect(url).toContain("year_from=2018");
    expect(url).toContain("mark[]=68");
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
  });

  it("ignores Auto1 id-only vehicle links and widens exact year/cm3", () => {
    expect(isSingleVehicleListingUrl("https://www.auto1.com/en/app/merchant/cars?id=95a1ea78-e733-414d-a526-46e47e97efb3")).toBe(true);
    expect(
      isSingleVehicleListingUrl(
        "https://www.auto1.com/en/app/merchant/cars?id=95a1ea78-e733-414d-a526-46e47e97efb3&manufacturers=Opel%7CVivaro",
      ),
    ).toBe(false);
    const wide = widenExactSearchBounds({
      ...filterFromBrandModel("Audi A6"),
      yearFrom: 2018,
      yearTo: 2018,
      engineFromCc: 2000,
      engineToCc: 2000,
    });
    expect(wide.yearFrom).toBe(2017);
    expect(wide.yearTo).toBe(2019);
    expect(wide.engineFromCc).toBe(1800);
    expect(wide.engineToCc).toBe(2200);
    const kw = widenExactSearchBounds({
      ...filterFromBrandModel("Audi A6"),
      powerFromKw: 176,
      powerToKw: 176,
    });
    expect(kw.powerFromKw).toBe(161);
    expect(kw.powerToKw).toBe(191);
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
  });

  it("adds a Jeep search next to Mitsubishi Pajero and splits MAN/Crafter/Sprinter", () => {
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
    expect(pajero.some((p) => p.filter.makeNames.includes("Jeep"))).toBe(true);

    const vans = planEcarstradeSearchUrls({
      id: "vans",
      brandModel: "MAN/Crafter/Sprinter",
      listingLinkAuto1: [""],
      listingLinkOpenline: [""],
      listingLinkAutobid: [""],
      listingLinkMobile: [""],
      listingLinkEcarstrade: [""],
    });
    expect(vans.length).toBeGreaterThanOrEqual(3);
    expect(vans.some((p) => p.filter.makeNames.includes("MAN"))).toBe(true);
    expect(vans.some((p) => /Crafter/i.test(p.filter.modelName))).toBe(true);
    expect(vans.some((p) => /Sprinter/i.test(p.filter.modelName))).toBe(true);
  });
});
