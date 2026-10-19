import { describe, expect, it } from "vitest";
import { listingBrandModelLabel, listingOrderSearchFields, listingProductionYears } from "@/lib/iriss-listing-search-fields";

describe("listingOrderSearchFields", () => {
  it("uses the title when it already contains the make, and fills year/fuel/kW/gear/body", () => {
    const fields = listingOrderSearchFields({
      manufacturer: "BMW",
      title: "BMW 520d G30",
      year: "2019",
      firstRegistration: "2019-03",
      fuel: "Dīzelis",
      powerKw: "140 kW",
      transmission: "Automāts",
      bodyType: "Sedans",
    });
    expect(fields.brandModel).toBe("BMW 520d G30");
    expect(fields.productionYears).toBe("2019");
    expect(fields.engineType).toBe("Dīzelis 140 kW");
    expect(fields.transmission).toBe("Automāts");
    expect(fields.bodyType).toBe("Sedans");
  });

  it("takes the year from first registration when year is empty", () => {
    expect(listingProductionYears({ year: "", firstRegistration: "03/2018" })).toBe("2018");
    expect(listingBrandModelLabel({ manufacturer: "Volvo", title: "XC60" })).toBe("Volvo XC60");
  });
});
