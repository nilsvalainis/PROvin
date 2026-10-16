import { describe, expect, it } from "vitest";
import { ECARSTRADE_BODY, ECARSTRADE_FUEL, ECARSTRADE_GEARBOX } from "@/lib/iriss-listings-ecarstrade-search";
import { emptyIrissCriteriaFilter, irissCriteriaMandatoryGaps, parseIrissCriteriaV1 } from "@/lib/iriss-criteria-types";
import { migrateIrissCriteria, readIrissCriteria } from "@/lib/iriss-criteria-migrate";
import { filterToSearchFilter, readSharedOrderCriteria } from "@/lib/iriss-criteria-shared";
import { filterToSearchFilter as filterToSearchFilterFromMatch } from "@/lib/iriss-listings-search-filter";

describe("migrateIrissCriteria", () => {
  it("builds one default filter from the existing order text and links", () => {
    const criteria = migrateIrissCriteria({
      brandModel: "Volvo XC60",
      productionYears: "2018-2022",
      maxMileage: "150000",
      totalBudget: "10 000 - 18 000 EUR netto",
      engineType: "2.0 TDI 140 kW Euro 6d",
      transmission: "DSG",
      bodyType: "SUV",
      driveType: "quattro",
      seatCount: "5 vietas",
      equipmentRequired: "navigācija, ādas salons",
      equipmentDesired: "webasta",
      dealVat21Required: true,
      listingLinkOpenline: ["https://www.openlane.eu/en/findcar?fuelTypes=100003", ""],
      listingLinkAuto1: [""],
    });
    expect(criteria.version).toBe(1);
    expect(criteria.filters).toHaveLength(1);
    const filter = criteria.filters[0]!;
    expect(filter.id).toBe("flt-1");
    expect(filter.label).toBe("Filtrs 1");
    expect(filter.enabled).toBe(true);
    expect(filter.useForm).toBe(true);
    expect(filter.useLinks).toBe(true);
    expect(filter.make.value).toContain("Volvo");
    expect(filter.models.value.join(" ").toLowerCase()).toContain("xc60");
    expect(filter.yearFrom.value).toBe(2018);
    expect(filter.yearTo.value).toBe(2022);
    expect(filter.mileageFrom.value).toBeNull();
    expect(filter.mileageTo.value).toBe(150000);
    expect(filter.budgetFrom.value).toBe(10000);
    expect(filter.budgetTo.value).toBe(18000);
    expect(filter.priceBasis.value).toBe("net");
    expect(filter.vatRequired.value).toBe(true);
    expect(filter.fuel.value).toEqual([{ group: "diesel" }]);
    expect(filter.gearbox.value).toEqual([{ group: "automatic", sub: "dsg_dct" }]);
    expect(filter.bodyTypes.value).toEqual(["suv"]);
    expect(filter.drive.value).toEqual(["awd"]);
    expect(filter.seatsFrom.value).toBe(5);
    expect(filter.kwFrom.value).toBe(140);
    expect(filter.kwTo.value).toBe(140);
    expect(filter.ccFrom.value).toBe(2000);
    expect(filter.emissionMin.value).toBe("Euro6d");
    expect(filter.equipmentRequired.value).toEqual(["navigācija", "ādas salons"]);
    expect(filter.equipmentDesired.value).toEqual(["webasta"]);
    expect(filter.links.value.openlane).toEqual(["https://www.openlane.eu/en/findcar?fuelTypes=100003"]);
    expect(filter.links.value.auto1).toEqual([]);
    expect(filter.make.source).toBe("migrated");
    expect("color" in filter).toBe(false);
    expect("preferredColors" in filter).toBe(false);
  });

  it("keeps unparsed text on the manual override and leaves useForm off", () => {
    const filter = migrateIrissCriteria({
      brandModel: "Nezināma marka",
      productionYears: "jauns",
      maxMileage: "mazs",
      totalBudget: "pēc vienošanās",
      engineType: "ūdensdzinējs",
      transmission: "kaut kāda",
      bodyType: "kaste",
      driveType: "vidējā",
      seatCount: "daudz",
    }).filters[0]!;
    expect(filter.useForm).toBe(false);
    expect(filter.useLinks).toBe(false);
    expect(filter.make.value).toEqual([]);
    expect(filter.make.manual).toBe("Nezināma marka");
    expect(filter.yearFrom.manual).toBe("jauns");
    expect(filter.yearFrom.value).toBeNull();
    expect(filter.mileageTo.manual).toBe("mazs");
    expect(filter.budgetTo.manual).toBe("pēc vienošanās");
    expect(filter.fuel.manual).toBe("ūdensdzinējs");
    expect(filter.fuel.value).toEqual([]);
    expect(filter.gearbox.manual).toBe("kaut kāda");
    expect(filter.bodyTypes.manual).toBe("kaste");
    expect(filter.drive.manual).toBe("vidējā");
    expect(filter.seatsFrom.manual).toBe("daudz");
  });

  it("parses several fuels and a mileage floor without copying colours", () => {
    const filter = migrateIrissCriteria({
      engineType: "dīzelis vai benzīns",
      transmission: "automāts vai mehānika",
      maxMileage: "no 20000 līdz 150000",
      productionYears: "2018+",
    }).filters[0]!;
    expect(filter.fuel.value.map((item) => item.group).sort()).toEqual(["diesel", "petrol"]);
    expect(filter.gearbox.value.map((item) => item.group).sort()).toEqual(["automatic", "manual"]);
    expect(filter.mileageFrom.value).toBe(20000);
    expect(filter.mileageTo.value).toBe(150000);
    expect(filter.yearFrom.value).toBe(2018);
    expect(filter.yearTo.value).toBeNull();
    expect("preferredColors" in filter).toBe(false);
    expect("color" in filter).toBe(false);
  });

  it("reads horsepower from the engine line", () => {
    const filter = migrateIrissCriteria({ engineType: "150 ZS", brandModel: "BMW 320" }).filters[0]!;
    expect(filter.kwFrom.value).toBe(110);
    expect(filter.fuel.value).toEqual([]);
    expect(filter.make.value.length).toBeGreaterThan(0);
  });

  it("does not replace a valid stored criteria document", () => {
    const stored = emptyIrissCriteriaFilter("flt-custom", "Pielāgots", "form");
    stored.useForm = true;
    stored.fuel = { value: [{ group: "petrol" }], manual: "operators", source: "ai" };
    const read = readIrissCriteria({
      engineType: "dīzelis",
      criteria: { version: 1, filters: [stored] },
    });
    expect(read.filters[0]?.label).toBe("Pielāgots");
    expect(read.filters[0]?.fuel.value).toEqual([{ group: "petrol" }]);
    expect(read.filters[0]?.fuel.manual).toBe("operators");
    expect(read.filters[0]?.fuel.source).toBe("ai");
  });

  it("migrates again when stored criteria is corrupt", () => {
    const read = readIrissCriteria({ engineType: "diesel", criteria: { version: 1, filters: [{ id: "x" }] } });
    expect(read.filters[0]?.fuel.value).toEqual([{ group: "diesel" }]);
  });

  it("round-trips through the parser and drops a colour key", () => {
    const migrated = migrateIrissCriteria({ engineType: "Benzin", bodyType: "sedan" });
    const withColour = {
      ...migrated,
      filters: migrated.filters.map((filter) => ({ ...filter, color: "black", preferredColors: "melna" })),
    };
    const parsed = parseIrissCriteriaV1(withColour);
    expect(parsed?.filters[0]?.fuel.value).toEqual([{ group: "petrol" }]);
    expect(parsed?.filters[0]?.bodyTypes.value).toEqual(["sedan"]);
    expect(parsed && "color" in parsed.filters[0]!).toBe(false);
    expect(JSON.stringify(parsed)).not.toContain("preferredColors");
  });

  it("lists the mandatory gaps on an empty filter", () => {
    expect(irissCriteriaMandatoryGaps(emptyIrissCriteriaFilter())).toEqual([
      "make",
      "yearFrom",
      "mileageTo",
      "budgetTo",
      "fuel",
      "gearbox",
      "bodyTypes",
    ]);
  });
});

describe("shared adapter", () => {
  it("reads a plain order object with a brand and a note", () => {
    const criteria = readSharedOrderCriteria({ brandModel: "Audi A6", note: "klienta piezīme" });
    expect(criteria.filters[0]?.make.value).toContain("Audi");
    expect(JSON.stringify(criteria)).not.toContain("klienta piezīme");
    expect(criteria.filters[0]?.useLinks).toBe(false);
  });

  it("projects form values onto the existing ET filter and ignores colour and manual text", () => {
    const filter = emptyIrissCriteriaFilter();
    filter.make = { value: ["Volvo"], manual: "", source: "form" };
    filter.models = { value: ["XC60", "XC90"], manual: "", source: "form" };
    filter.yearFrom = { value: 2018, manual: "", source: "form" };
    filter.budgetTo = { value: 20000, manual: "", source: "form" };
    filter.vatRequired = { value: true, manual: "", source: "form" };
    filter.fuel = {
      value: [{ group: "diesel" }, { group: "hybrid", sub: "diesel_hybrid" }, { group: "hydrogen" }],
      manual: "Benzin",
      source: "form",
    };
    filter.gearbox = {
      value: [
        { group: "automatic", sub: "dsg_dct" },
        { group: "automatic", sub: "amt" },
      ],
      manual: "",
      source: "form",
    };
    filter.bodyTypes = { value: ["suv", "pickup"], manual: "", source: "form" };
    filter.drive = { value: ["awd"], manual: "", source: "form" };
    const search = filterToSearchFilter(filter);
    expect(filterToSearchFilterFromMatch).toBe(filterToSearchFilter);
    expect(search.fuels).toEqual([ECARSTRADE_FUEL.diesel, ECARSTRADE_FUEL.hybridDiesel]);
    expect(search.gearboxes).toEqual([ECARSTRADE_GEARBOX.automatic, ECARSTRADE_GEARBOX.semi]);
    expect(search.bodies).toEqual([ECARSTRADE_BODY.suv]);
    expect(search.drives).toEqual(["awd"]);
    expect(search.yearFrom).toBe(2018);
    expect(search.priceTo).toBe(20000);
    expect(search.vat).toEqual(["reclaimable"]);
    expect(search.modelName).toBe("");
    expect(search.colors).toEqual([]);
    expect(search.excludeColors).toEqual([]);
    expect(search.fuels).not.toContain(ECARSTRADE_FUEL.petrol);
    expect(search.unmapped.some((item) => item.value === "hydrogen")).toBe(true);
    expect(search.unmapped.some((item) => item.key === "models")).toBe(true);
  });
});
