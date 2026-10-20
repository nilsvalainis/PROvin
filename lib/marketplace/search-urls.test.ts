import { describe, expect, it } from "vitest";
import {
  as24Body,
  marketplaceActorSearchInput,
  marketplaceKwToPs,
  marketplaceModelSearchToken,
  mobileActorBody,
  buildAutoscout24SearchUrl,
  buildMobileDeSearchUrl,
} from "@/lib/marketplace/search-urls";
import { emptyMarketplaceQuery } from "@/lib/marketplace/types";

function volvoQuery() {
  const q = emptyMarketplaceQuery();
  q.make = "Volvo";
  q.model = "XC60";
  q.yearFrom = 2018;
  q.yearTo = 2021;
  q.mileageTo = 150000;
  q.priceFrom = 10000;
  q.priceTo = 25000;
  q.fuel = "diesel";
  q.gearbox = "automatic";
  q.powerFromKw = 110;
  q.powerToKw = 180;
  q.displacementFromCc = 1900;
  q.displacementToCc = 2000;
  q.body = "suv";
  q.drive = "awd";
  return q;
}

function audiA6Query() {
  const q = emptyMarketplaceQuery();
  q.make = "Audi";
  q.model = "A6 C7 BI-TURBO Sline";
  q.yearFrom = 2012;
  q.yearTo = 2015;
  q.priceFrom = 11000;
  q.priceTo = 14000;
  q.mileageFrom = 180000;
  q.mileageTo = 280000;
  q.powerFromKw = 230;
  q.powerToKw = 230;
  q.gearbox = "automatic";
  q.body = "estate";
  q.drive = "quattro";
  q.countries = ["Germany"];
  return q;
}

describe("marketplace search URLs", () => {
  it("always restricts mobile.de and AutoScout24 to dealer ads", () => {
    const mobile = buildMobileDeSearchUrl(emptyMarketplaceQuery());
    const as24 = buildAutoscout24SearchUrl(emptyMarketplaceQuery());
    expect(new URL(mobile).searchParams.get("st")).toBe("DEALER");
    expect(new URL(as24).searchParams.get("custtype")).toBe("D");
    expect(marketplaceActorSearchInput("mobilede", emptyMarketplaceQuery()).sellerType).toBe("DEALER");
    expect(marketplaceActorSearchInput("autoscout24", emptyMarketplaceQuery())).not.toHaveProperty("sellerType");
  });

  it("puts all ranges on mobile.de search URL with current site params", () => {
    const url = buildMobileDeSearchUrl(volvoQuery());
    const parsed = new URL(url);
    expect(url).toContain("suchen.mobile.de/fahrzeuge/search.html");
    expect(parsed.searchParams.get("ms")).toBe("25100");
    expect(url).not.toContain("XC60");
    expect(url).toMatch(/fr=2018%3A2021|fr=2018:2021/);
    expect(url).toContain("p=");
    expect(url).toContain("ml=");
    expect(url).toContain("cc=");
    expect(parsed.searchParams.get("pw")).toBe("110:180");
    expect(parsed.searchParams.get("minPowerAsArray")).toBeNull();
    expect(url).toContain("ft=DIESEL");
    expect(url).toContain("tr=AUTOMATIC_GEAR");
    expect(parsed.searchParams.get("dam")).toBe("0");
    expect(url).toContain("cn=DE");
    expect(parsed.searchParams.get("st")).toBe("DEALER");
    expect(parsed.searchParams.get("adLimitation")).toBeNull();
  });

  it("puts all ranges on AutoScout24 search URL", () => {
    const url = buildAutoscout24SearchUrl(volvoQuery(), true);
    expect(url).toContain("autoscout24.de/lst/volvo/xc60");
    expect(url).toContain("fregfrom=2018");
    expect(url).toContain("fregto=2021");
    expect(url).toContain("pricefrom=10000");
    expect(url).toContain("priceto=25000");
    expect(url).toContain("kmto=150000");
    expect(url).toContain("powerfrom=110");
    expect(url).toContain("ccfrom=1900");
    expect(url).toContain("fuel=D");
    expect(url).toContain("sort=age");
    expect(url).toContain("damaged_listing=exclude");
    expect(url).not.toContain("damaged_listing=0");
    expect(url).toContain("cy=D");
    expect(url).toContain("custtype=D");
    expect(url).toContain("ustate=");
    expect(url).toContain("powerto=180");
    expect(url).toContain("ccto=2000");
    expect(new URL(url).searchParams.get("body")).toBe("4");
  });

  it("sends mobile.de actor structured fields and DEALER enum, without startUrls", () => {
    const input = marketplaceActorSearchInput("mobilede", volvoQuery(), { maxItems: 40, sortNewest: true });
    expect(input).not.toHaveProperty("startUrls");
    expect(input.make).toBe("Volvo");
    expect(input.model).toBe("XC60");
    expect(input.priceMin).toBe(10000);
    expect(input.priceMax).toBe(25000);
    expect(input.yearMin).toBe(2018);
    expect(input.yearMax).toBe(2021);
    expect(input.mileageMax).toBe(150000);
    expect(input.powerMin).toBe(marketplaceKwToPs(110));
    expect(input.powerMax).toBe(marketplaceKwToPs(180));
    expect(input.transmission).toEqual(["AUTOMATIC_GEAR"]);
    expect(input.bodyType).toEqual(["SUV"]);
    expect(input.sellerType).toBe("DEALER");
    expect(input.damageStatus).toBe("EXCLUDE");
    expect(input.maxResults).toBe(40);
    expect(input.includeDetails).toBe(false);
    expect(input.category).toBe("CAR");
    expect(input.sort).toBe("newest");
    expect(input.fuelType).toEqual(["DIESEL"]);
    expect(input.customFilters).toEqual([{ field: "country", op: "equals", value: "DE" }]);
    expect(input).not.toHaveProperty("country");
    expect(input).not.toHaveProperty("webhook");
  });

  it("sends AutoScout24 actor input as searchUrls objects", () => {
    const input = marketplaceActorSearchInput("autoscout24", volvoQuery(), { maxItems: 40, sortNewest: true });
    const urls = input.searchUrls as { url: string }[];
    expect(urls[0]?.url).toContain("autoscout24.de/lst/volvo/xc60");
    expect(urls[0]?.url).toContain("damaged_listing=exclude");
    expect(urls[0]?.url).toContain("custtype=D");
    expect(input).not.toHaveProperty("sellerType");
    expect(input.maxResults).toBe(40);
    expect(input.includeDetails).toBe(false);
    expect(input).not.toHaveProperty("startUrls");
    expect(input).not.toHaveProperty("fuelType");
  });

  it("maps IRISS gearbox AT/MT and Latvian labels to automatic or manual", () => {
    for (const gearbox of ["AT", "A/T", "automāts", "automats", "automatic"]) {
      const q = emptyMarketplaceQuery();
      q.gearbox = gearbox;
      expect(new URL(buildMobileDeSearchUrl(q)).searchParams.get("tr"), gearbox).toBe("AUTOMATIC_GEAR");
      expect(new URL(buildAutoscout24SearchUrl(q)).searchParams.get("gear"), gearbox).toBe("A");
      expect(marketplaceActorSearchInput("mobilede", q).transmission).toEqual(["AUTOMATIC_GEAR"]);
    }
    for (const gearbox of ["MT", "manuāla"]) {
      const q = emptyMarketplaceQuery();
      q.gearbox = gearbox;
      expect(new URL(buildMobileDeSearchUrl(q)).searchParams.get("tr"), gearbox).toBe("MANUAL_GEAR");
      expect(new URL(buildAutoscout24SearchUrl(q)).searchParams.get("gear"), gearbox).toBe("M");
      expect(marketplaceActorSearchInput("mobilede", q).transmission).toEqual(["MANUAL_GEAR"]);
    }
    const seat = emptyMarketplaceQuery();
    seat.gearbox = "SEAT";
    expect(new URL(buildMobileDeSearchUrl(seat)).searchParams.get("tr")).toBeNull();
    expect(new URL(buildAutoscout24SearchUrl(seat)).searchParams.get("gear")).toBeNull();
  });

  it("maps IRISS universal body to AutoScout24 estate code 5 and mobile.de KOMBI", () => {
    for (const body of ["universal", "universalis", "universāls", "estate", "wagon"]) {
      const q = emptyMarketplaceQuery();
      q.body = body;
      expect(new URL(buildAutoscout24SearchUrl(q)).searchParams.get("body"), body).toBe("5");
      expect(new URL(buildMobileDeSearchUrl(q)).searchParams.get("c"), body).toBe("EstateCar");
      expect(mobileActorBody(body), body).toBe("KOMBI");
      expect(marketplaceActorSearchInput("mobilede", q).bodyType).toEqual(["KOMBI"]);
    }
  });

  it("returns AutoScout24 numeric body codes", () => {
    expect(as24Body("compact")).toBe("1");
    expect(as24Body("convertible")).toBe("2");
    expect(as24Body("coupe")).toBe("3");
    expect(as24Body("suv")).toBe("4");
    expect(as24Body("estate")).toBe("5");
    expect(as24Body("saloon")).toBe("6");
    expect(as24Body("van")).toBe("12");
  });

  it("uses only the first model token for URLs, slugs and actor inputs", () => {
    expect(marketplaceModelSearchToken("A6 C7 BI-TURBO Sline")).toBe("A6");
    const q = audiA6Query();
    const mobileUrl = new URL(buildMobileDeSearchUrl(q));
    expect(mobileUrl.searchParams.get("ms")).toBe("1900");
    expect(mobileUrl.toString()).not.toMatch(/C7|BI-TURBO|Sline/i);
    const as24 = buildAutoscout24SearchUrl(q);
    expect(as24).toContain("autoscout24.de/lst/audi/a6");
    expect(as24).not.toMatch(/c7|bi-turbo|sline/i);
    const input = marketplaceActorSearchInput("mobilede", q, { maxItems: 10 });
    expect(input.model).toBe("A6");
  });

  it("switches mobile.de vc and AutoScout24 atype for van vs car", () => {
    const car = emptyMarketplaceQuery();
    car.make = "Volvo";
    car.model = "XC60";
    car.vehicleCategory = "car";
    expect(new URL(buildMobileDeSearchUrl(car)).searchParams.get("vc")).toBe("Car");
    expect(new URL(buildAutoscout24SearchUrl(car)).searchParams.get("atype")).toBe("C");
    expect(marketplaceActorSearchInput("mobilede", car).category).toBe("CAR");

    const van = emptyMarketplaceQuery();
    van.make = "Mercedes-Benz";
    van.model = "Sprinter";
    van.vehicleCategory = "van";
    van.yearFrom = 2020;
    van.yearTo = 2026;
    van.mileageTo = 180000;
    van.features = ["air_conditioning"];
    const mobile = new URL(buildMobileDeSearchUrl(van));
    expect(mobile.searchParams.get("s")).toBe("Van");
    expect(mobile.searchParams.get("vc")).toBe("Van");
    expect(mobile.searchParams.get("ml")).toBe(":180000");
    expect(mobile.searchParams.get("fe")).toBe("AIR_CONDITIONING");
    expect(mobile.toString()).not.toMatch(/mile/i);
    const as24 = new URL(buildAutoscout24SearchUrl(van));
    expect(as24.searchParams.get("atype")).toBe("X");
    expect(as24.searchParams.get("kmto")).toBe("180000");
    expect(as24.searchParams.has("mileto")).toBe(false);
    expect(as24.searchParams.get("eq")).toBe("5");
    expect(marketplaceActorSearchInput("mobilede", van).category).toBe("VAN");
  });

  it("builds Audi A6 dealer search actor inputs with PS power and KOMBI", () => {
    const q = audiA6Query();
    const mobile = marketplaceActorSearchInput("mobilede", q, { maxItems: 10 });
    expect(mobile).toEqual({
      maxResults: 10,
      includeDetails: false,
      category: "CAR",
      sellerType: "DEALER",
      damageStatus: "EXCLUDE",
      make: "Audi",
      model: "A6",
      priceMin: 11000,
      priceMax: 14000,
      yearMin: 2012,
      yearMax: 2015,
      mileageMin: 180000,
      mileageMax: 280000,
      powerMin: 313,
      powerMax: 313,
      transmission: ["AUTOMATIC_GEAR"],
      bodyType: ["KOMBI"],
      customFilters: [{ field: "country", op: "equals", value: "DE" }],
    });
    expect(marketplaceKwToPs(230)).toBe(313);

    const as24 = marketplaceActorSearchInput("autoscout24", q, { maxItems: 10 });
    const url = (as24.searchUrls as { url: string }[])[0]?.url ?? "";
    const parsed = new URL(url);
    expect(as24.maxResults).toBe(10);
    expect(as24.includeDetails).toBe(false);
    expect(parsed.pathname).toBe("/lst/audi/a6");
    expect(parsed.searchParams.get("damaged_listing")).toBe("exclude");
    expect(parsed.searchParams.get("ustate")).toBe("N,U");
    expect(parsed.searchParams.get("custtype")).toBe("D");
    expect(parsed.searchParams.get("cy")).toBe("D");
    expect(parsed.searchParams.get("fregfrom")).toBe("2012");
    expect(parsed.searchParams.get("fregto")).toBe("2015");
    expect(parsed.searchParams.get("pricefrom")).toBe("11000");
    expect(parsed.searchParams.get("priceto")).toBe("14000");
    expect(parsed.searchParams.get("kmfrom")).toBe("180000");
    expect(parsed.searchParams.get("kmto")).toBe("280000");
    expect(parsed.searchParams.get("powerfrom")).toBe("230");
    expect(parsed.searchParams.get("powerto")).toBe("230");
    expect(parsed.searchParams.get("powertype")).toBe("kw");
    expect(parsed.searchParams.get("gear")).toBe("A");
    expect(parsed.searchParams.get("body")).toBe("5");
  });
});
