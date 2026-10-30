import { describe, expect, it } from "vitest";

import { marketplaceQuerySummaryLv } from "@/lib/marketplace/query-summary";
import { emptyMarketplaceQuery } from "@/lib/marketplace/types";

describe("Tirgus ielāde: ko meklēs (Nils 30.10 - manuāla ielāde pēc kritērijiem)", () => {
  it("rāda marku, gadus, km, cenu, degvielu un kārbu cilvēkam saprotami", () => {
    const q = {
      ...emptyMarketplaceQuery(),
      make: "Volkswagen",
      model: "Golf",
      yearFrom: 2018,
      yearTo: 2022,
      mileageTo: 150000,
      priceTo: 25000,
      fuel: "diesel",
      gearbox: "automatic",
    };
    expect(marketplaceQuerySummaryLv(q)).toEqual(["Volkswagen Golf", "2018-2022", "līdz 150 000 km", "līdz 25 000 €", "Dīzelis", "Automātiskā"]);
  });

  it("tukšs vaicājums - nekā nav", () => {
    expect(marketplaceQuerySummaryLv(emptyMarketplaceQuery())).toEqual([]);
  });
});
