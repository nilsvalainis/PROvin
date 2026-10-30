import { describe, expect, it } from "vitest";

import { migrateIrissCriteria } from "@/lib/iriss-criteria-migrate";
import { filterFromOrderFields } from "@/lib/iriss-listings-ecarstrade-search";
import { irissSpecMultiCustom, irissSpecMultiGroups, toggleIrissSpecMulti } from "@/lib/iriss-order-spec-selects";
import { marketplaceQueryFromOrder } from "@/lib/marketplace/query-from-order";
import { buildMobileDeOrderSearchUrl } from "@/lib/marketplace/search-urls";

describe("Nils 30.10: vairākas izvēles meklēšanas filtros", () => {
  it("čipi pievieno un noņem, vecais teksts paliek", () => {
    let fuel = "Dīzelis";
    fuel = toggleIrissSpecMulti("fuel", fuel, "petrol");
    expect(fuel).toBe("Dīzelis, Benzīns");
    expect(irissSpecMultiGroups("fuel", fuel)).toEqual(["diesel", "petrol"]);
    expect(toggleIrissSpecMulti("fuel", fuel, "diesel")).toBe("Benzīns");
    expect(toggleIrissSpecMulti("body", "Apvidus, kaut kas cits", "wagon")).toBe("Apvidus, Universālis, kaut kas cits");
    expect(irissSpecMultiCustom("body", "Apvidus, kaut kas cits")).toBe("kaut kas cits");
    expect(toggleIrissSpecMulti("drive", "", "awd")).toBe("4x4");
    expect(irissSpecMultiGroups("gearbox", "Automāts")).toEqual(["automatic"]);
  });

  it("vecie dati čipos atzīmējas", () => {
    expect(irissSpecMultiGroups("fuel", "dīzelis vai benzīns")).toEqual(["diesel", "petrol"]);
    expect(irissSpecMultiGroups("body", "SUV")).toEqual(["suv"]);
    expect(irissSpecMultiGroups("drive", "Pilnpiedziņa")).toEqual(["awd"]);
  });

  it("kritēriji, mobile.de un izsoļu saites ņem visas atzīmētās", () => {
    const order = {
      brandModel: "Volvo XC60",
      productionYears: "2014-2017",
      maxMileage: "220000",
      totalBudget: "15000",
      engineType: "Dīzelis, Benzīns",
      transmission: "Automāts",
      bodyType: "Apvidus, Universālis",
      driveType: "4x4",
    };
    const filter = migrateIrissCriteria(order).filters[0]!;
    expect(filter.fuel.value.map((f) => f.group)).toEqual(["diesel", "petrol"]);
    expect(filter.bodyTypes.value).toEqual(["suv", "wagon"]);

    const url = new URL(buildMobileDeOrderSearchUrl(marketplaceQueryFromOrder(order)));
    expect(url.searchParams.getAll("ft")).toEqual(["DIESEL", "PETROL"]);
    expect(url.searchParams.getAll("c")).toEqual(["SUV", "EstateCar"]);
    expect(url.searchParams.get("dr")).toBeTruthy();

    const ect = filterFromOrderFields(order);
    expect(ect.fuels).toHaveLength(2);
    expect(ect.bodies).toHaveLength(2);
  });

  it("abas kārbas vai dažādas piedziņas - mobile.de bez kārbas/piedziņas filtra", () => {
    const url = new URL(
      buildMobileDeOrderSearchUrl(
        marketplaceQueryFromOrder({ brandModel: "Volvo XC60", totalBudget: "15000", transmission: "Automāts, Manuāla", driveType: "Priekšējā, 4x4" }),
      ),
    );
    expect(url.searchParams.get("tr")).toBeNull();
    expect(url.searchParams.get("dr")).toBeNull();
  });
});
