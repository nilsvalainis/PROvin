import { describe, expect, it } from "vitest";
import {
  bodiesMatchGroups,
  colorsMatchGroups,
  countriesMatchGroups,
  damageMatchesGroup,
  drivesMatchGroups,
  fuelsMatchGroups,
  gearboxesMatchGroups,
  makesMatchCanonical,
  modelExtensionsMatchTitle,
  seatsMatchCount,
} from "@/lib/iriss-criteria-listing-match";
import { mapEcarstradeColor } from "@/lib/iriss-listings-ecarstrade-criteria";
import { resolveEcarstradeMake } from "@/lib/iriss-listings-ecarstrade-catalog";
import {
  filterFromOrderFields,
  parseListingSearchUrl,
} from "@/lib/iriss-listings-ecarstrade-search";
import { vehicleMatchesSearchFilter } from "@/lib/iriss-listings-search-filter";
import { foldModelExtension } from "@/lib/iriss-model-extension";
import { migrateIrissSpecSelectLabels } from "@/lib/iriss-order-spec-selects";

describe("group matching vs English auction labels", () => {
  it("keeps German and Latvian listings against ET English criteria", () => {
    expect(bodiesMatchGroups("Limousine", ["Saloon"])).toBe(true);
    expect(bodiesMatchGroups("Kombi", ["Estate Car"])).toBe(true);
    expect(bodiesMatchGroups("Schrägheck", ["Small Car"])).toBe(true);
    expect(bodiesMatchGroups("hečbeks", ["Small Car"])).toBe(true);
    expect(bodiesMatchGroups("sedans", ["Saloon"])).toBe(true);
    expect(bodiesMatchGroups("universālis", ["Estate Car"])).toBe(true);
    expect(fuelsMatchGroups("Benzin", ["Petrol"])).toBe(true);
    expect(fuelsMatchGroups("benzīns", ["Petrol"])).toBe(true);
    expect(fuelsMatchGroups("dīzelis", ["Diesel"])).toBe(true);
    expect(fuelsMatchGroups("PHEV", ["Hibrīds"])).toBe(true);
    expect(gearboxesMatchGroups("Automatik", ["Automatic"])).toBe(true);
    expect(gearboxesMatchGroups("automāts", ["Automatic"])).toBe(true);
    expect(gearboxesMatchGroups("Mehāniskā", ["Manuāla"])).toBe(true);
    expect(gearboxesMatchGroups("Schaltgetriebe", ["Manual"])).toBe(true);
  });

  it("does not drop a listing when the raw label is unknown", () => {
    expect(bodiesMatchGroups("Sonderaufbau", ["Saloon"])).toBe(true);
    expect(fuelsMatchGroups("", ["Petrol"])).toBe(true);
  });
});

describe("per-source fuel/body/gear groups", () => {
  it("Auto1 English and German raw", () => {
    expect(fuelsMatchGroups("PETROL", ["Benzīns"], "auto1")).toBe(true);
    expect(fuelsMatchGroups("DIESEL", ["Dīzelis"], "auto1")).toBe(true);
    expect(gearboxesMatchGroups("AUTOMATIC", ["Automāts"], "auto1")).toBe(true);
    expect(bodiesMatchGroups("Estate", ["Universālis"], "auto1")).toBe(true);
  });

  it("Autobid numeric codes and German text", () => {
    expect(fuelsMatchGroups("3", ["Dīzelis"], "autobid")).toBe(true);
    expect(fuelsMatchGroups("2", ["Benzīns"], "autobid")).toBe(true);
    expect(fuelsMatchGroups("6", ["Hibrīds"], "autobid")).toBe(true);
    expect(gearboxesMatchGroups("1", ["Manuāla"], "autobid")).toBe(true);
    expect(fuelsMatchGroups("Benzin", ["Petrol"], "autobid")).toBe(true);
    expect(bodiesMatchGroups("Kombi", ["Estate Car"], "autobid")).toBe(true);
  });

  it("Openlane fuel ids", () => {
    expect(fuelsMatchGroups("100001", ["Benzīns"], "openlane")).toBe(true);
    expect(fuelsMatchGroups("100003", ["Dīzelis"], "openlane")).toBe(true);
    expect(fuelsMatchGroups("100013", ["Hibrīds"], "openlane")).toBe(true);
  });

  it("eCarsTrade English labels vs DE listing", () => {
    const filter = parseListingSearchUrl(
      "https://ecarstrade.com/search?mark[]=5&fuel[]=Petrol&gearbox[]=Automatic&category[]=Saloon",
    );
    expect(
      vehicleMatchesSearchFilter(
        {
          title: "Audi A6 Limousine",
          manufacturer: "Audi",
          fuel: "Benzin",
          transmission: "Automatik",
          bodyType: "Limousine",
          platform: "ecarstrade",
        },
        filter,
      ),
    ).toBe(true);
  });

  it("mobile.de Automatik/Benzin/Kombi", () => {
    expect(fuelsMatchGroups("Benzin", ["Petrol"], "mobile")).toBe(true);
    expect(gearboxesMatchGroups("AUTOMATIC_GEAR", ["Automāts"], "mobile")).toBe(true);
    expect(bodiesMatchGroups("Kombi", ["Universālis"], "mobile_de")).toBe(true);
  });

  it("Apify / marketplace German raw", () => {
    expect(fuelsMatchGroups("Benzin", ["benzīns"])).toBe(true);
    expect(gearboxesMatchGroups("Schaltgetriebe", ["mehāniskā"])).toBe(true);
    expect(bodiesMatchGroups("Geländewagen", ["Apvidus"])).toBe(true);
  });
});

describe("makes, trim, drive, color, country, damage, seats", () => {
  it("canonicalizes VW / Mercedes / Skoda / Citroen / Alfa / Land Rover", () => {
    expect(resolveEcarstradeMake("VW")?.name.toLowerCase()).toContain("volk");
    expect(makesMatchCanonical("VW Golf", ["Volkswagen"])).toBe(true);
    expect(makesMatchCanonical("Volkswagen Golf", ["VW"])).toBe(true);
    expect(makesMatchCanonical("Mercedes-Benz C220", ["MB"])).toBe(true);
    expect(makesMatchCanonical("Škoda Octavia", ["Skoda"])).toBe(true);
    expect(makesMatchCanonical("Citroën C3", ["Citroen"])).toBe(true);
    expect(makesMatchCanonical("Alfa Romeo Giulia", ["Alfa"])).toBe(true);
    expect(makesMatchCanonical("Range Rover Sport", ["Land Rover"])).toBe(true);
  });

  it("treats S line / S-line / Sline as the same trim", () => {
    expect(foldModelExtension("S line")).toBe(foldModelExtension("S-line"));
    expect(foldModelExtension("Sline")).toBe(foldModelExtension("S-line"));
    expect(modelExtensionsMatchTitle("Audi A6 S-line 3.0", ["S line"])).toBe(true);
    expect(modelExtensionsMatchTitle("Audi A6 Ambiente", ["S-line"])).toBe(false);
  });

  it("matches drive aliases", () => {
    expect(drivesMatchGroups("quattro", ["4x4"])).toBe(true);
    expect(drivesMatchGroups("xDrive", ["AWD"])).toBe(true);
    expect(drivesMatchGroups("4MATIC", ["pilnpiedziņa"])).toBe(true);
    expect(drivesMatchGroups("4motion", ["Allrad"])).toBe(true);
    expect(drivesMatchGroups("Frontantrieb", ["priekšējā"])).toBe(true);
    expect(drivesMatchGroups("Front", ["4x4"])).toBe(false);
  });

  it("matches LV/EN/DE colors including metallic", () => {
    expect(mapEcarstradeColor("schwarz metallic")).toBe("Black");
    expect(mapEcarstradeColor("melna")).toBe("Black");
    expect(mapEcarstradeColor("balts perleffekt")).toBe("White");
    expect(mapEcarstradeColor("pelēks")).toBe("Grey");
    expect(colorsMatchGroups("Schwarz Metallic", ["melns"])).toBe(true);
    expect(colorsMatchGroups("Gelb", [], ["dzeltens"])).toBe(false);
  });

  it("matches countries and damage, seats", () => {
    expect(countriesMatchGroups("Deutschland", ["DE"])).toBe(true);
    expect(countriesMatchGroups("Vācija", ["Germany"])).toBe(true);
    expect(damageMatchesGroup("Lackschaden", "tikai kosmētika")).toBe(true);
    expect(seatsMatchCount("5", 5)).toBe(true);
    expect(seatsMatchCount(7, 5)).toBe(true);
    expect(seatsMatchCount(4, 5)).toBe(false);
  });
});

describe("bookmarks and filters ignore equipment, use agent notes", () => {
  it("puts Piezīmes aģentam into includeTokens, not Obligātās prasības", () => {
    const filter = filterFromOrderFields({
      brandModel: "Audi A6",
      equipmentRequired: "Matrix LED, 360 kamera",
      agentNotes: "pārbaudīt servisa vēsturi",
      modelExtension: "S-line",
    });
    expect(filter.includeTokens.join(" ")).toMatch(/servisa/);
    expect(filter.includeTokens.join(" ")).not.toMatch(/Matrix/i);
    expect(filter.modelExtensions).toEqual(["S-line"]);
  });
});

describe("spec select migration", () => {
  it("rewrites Mehāniskā / Petrol / Saloon to Latvian select labels", () => {
    expect(
      migrateIrissSpecSelectLabels({
        engineType: "Petrol",
        transmission: "Mehāniskā",
        bodyType: "Saloon",
      }),
    ).toEqual({
      engineType: "Benzīns",
      transmission: "Manuāla",
      bodyType: "Sedans",
    });
  });

  it("keeps already-valid Latvian labels and SUV casing", () => {
    expect(
      migrateIrissSpecSelectLabels({
        engineType: "dīzelis",
        transmission: "automāts",
        bodyType: "SUV",
      }),
    ).toEqual({
      engineType: "dīzelis",
      transmission: "automāts",
      bodyType: "SUV",
    });
  });
});
