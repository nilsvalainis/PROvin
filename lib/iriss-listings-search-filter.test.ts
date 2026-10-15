import { describe, expect, it } from "vitest";
import {
  applySearchFilterToVehicles,
  enrichListingSearchUrl,
  listingSourceHasMakeParams,
  vehicleMatchesSearchFilter,
} from "@/lib/iriss-listings-search-filter";
import { filterFromBrandModel, parseListingSearchUrl } from "@/lib/iriss-listings-ecarstrade-search";

describe("enrichListingSearchUrl", () => {
  it("injects Auto1 manufacturer into channel=24h so the relay does not scrape all stock", () => {
    const next = enrichListingSearchUrl("auto1", "https://www.auto1.com/en/app/merchant/cars?channel=24h", "LEXUS/TOYOTA");
    const u = new URL(next);
    expect(u.searchParams.get("manufacturer")).toBe("LEXUS");
    expect(listingSourceHasMakeParams(next)).toBe(true);
  });

  it("injects Openlane makes and Autobid name-brand from brandModel", () => {
    const ol = enrichListingSearchUrl("openline", "https://www.openlane.eu/en/findcar", "Audi/VW/Porsche 176kw");
    const ou = new URL(ol);
    expect(ou.searchParams.getAll("makes").sort()).toEqual(["audi", "porsche", "volkswagen"]);
    expect(ou.searchParams.get("powerFrom")).toBe("176");
    expect(ou.searchParams.get("powerTo")).toBe("176");

    const ab = enrichListingSearchUrl("autobid", "https://autobid.de/en/search-results", "Volvo XC60");
    expect(new URL(ab).searchParams.get("name-brand")).toBe("Volvo");
    expect(new URL(ab).searchParams.get("name-model")).toBe("XC60");
  });

  it("leaves already filtered URLs unchanged", () => {
    const src = "https://www.auto1.com/en/app/merchant/cars?manufacturer=VOLVO&model=XC60";
    expect(enrichListingSearchUrl("auto1", src, "BMW 320")).toBe(src);
  });
});

describe("vehicleMatchesSearchFilter", () => {
  it("keeps VW Golf against a Volkswagen filter and drops other makes", () => {
    const filter = filterFromBrandModel("Volkswagen Golf");
    expect(vehicleMatchesSearchFilter({ title: "VW Golf 1.5", manufacturer: "VW" }, filter)).toBe(true);
    expect(vehicleMatchesSearchFilter({ title: "Audi A4", manufacturer: "Audi" }, filter)).toBe(false);
  });

  it("drops cars outside year / km / kW / price", () => {
    const filter = parseListingSearchUrl(
      "https://ecarstrade.com/search?mark[]=68&year_from=2018&year_to=2022&mileage_to=150000&power_from=140&power_to=180&price_to=28000",
    );
    const ok = {
      title: "Volvo XC60",
      manufacturer: "Volvo",
      year: "2020",
      mileageKm: 80_000,
      powerKw: "150",
      priceCurrent: 22_000,
    };
    expect(vehicleMatchesSearchFilter(ok, filter)).toBe(true);
    expect(vehicleMatchesSearchFilter({ ...ok, year: "2015" }, filter)).toBe(false);
    expect(vehicleMatchesSearchFilter({ ...ok, mileageKm: 200_000 }, filter)).toBe(false);
    expect(vehicleMatchesSearchFilter({ ...ok, powerKw: "110" }, filter)).toBe(false);
    expect(vehicleMatchesSearchFilter({ ...ok, priceCurrent: 40_000 }, filter)).toBe(false);
  });

  it("applies the same filter to a fetched list", () => {
    const filter = filterFromBrandModel("Volvo XC60");
    const kept = applySearchFilterToVehicles(
      [
        { title: "Volvo XC60 D4", manufacturer: "Volvo" },
        { title: "BMW X3", manufacturer: "BMW" },
      ],
      filter,
    );
    expect(kept.map((v) => v.title)).toEqual(["Volvo XC60 D4"]);
  });
});

describe("vehicleMatchesSearchFilter post-filter", () => {
  it("drops opposite drive and excluded colors, keeps quattro", () => {
    const filter = parseListingSearchUrl(
      "https://ecarstrade.com/search?mark[]=5&model[]=1&iriss_drive=awd&iriss_exclude_color=Yellow",
    );
    expect(
      vehicleMatchesSearchFilter(
        { title: "Audi A6 3.0 TDI quattro", manufacturer: "Audi", color: "Black" },
        filter,
      ),
    ).toBe(true);
    expect(
      vehicleMatchesSearchFilter({ title: "Audi A6 2.0 TDI Front", manufacturer: "Audi", color: "Blue" }, filter),
    ).toBe(false);
    expect(
      vehicleMatchesSearchFilter(
        { title: "Audi A6 3.0 TDI quattro", manufacturer: "Audi", color: "Yellow" },
        filter,
      ),
    ).toBe(false);
  });

  it("keeps unknown drive/color rather than dropping", () => {
    const filter = parseListingSearchUrl("https://ecarstrade.com/search?mark[]=68&iriss_drive=awd&iriss_need=navi");
    expect(vehicleMatchesSearchFilter({ title: "Volvo XC60", manufacturer: "Volvo" }, filter)).toBe(true);
  });

  it("applies year/km from the ET URL to a fetched list", () => {
    const filter = parseListingSearchUrl(
      "https://ecarstrade.com/search?mark[]=68&year_from=2018&mileage_to=150000",
    );
    const kept = applySearchFilterToVehicles(
      [
        { title: "Volvo XC60", manufacturer: "Volvo", year: "2020", mileageKm: 80_000 },
        { title: "Volvo XC60", manufacturer: "Volvo", year: "2015", mileageKm: 80_000 },
        { title: "BMW X3", manufacturer: "BMW", year: "2020", mileageKm: 80_000 },
      ],
      filter,
    );
    expect(kept.map((v) => `${v.manufacturer} ${v.year}`)).toEqual(["Volvo 2020"]);
  });

  it("reads first registration 06/2021 and 03.2018 and drops a missing year", () => {
    const filter = parseListingSearchUrl(
      "https://ecarstrade.com/search?mark[]=7&year_from=2016&year_to=2020",
    );
    expect(
      vehicleMatchesSearchFilter(
        { title: "BMW 220d", manufacturer: "BMW", firstRegistration: "03.2018", year: "" },
        filter,
      ),
    ).toBe(true);
    expect(
      vehicleMatchesSearchFilter(
        { title: "BMW 320d", manufacturer: "BMW", firstRegistration: "06/2021", year: "0620" },
        filter,
      ),
    ).toBe(false);
    expect(
      vehicleMatchesSearchFilter({ title: "BMW 318d", manufacturer: "BMW", year: "", firstRegistration: "" }, filter),
    ).toBe(false);
  });
});
