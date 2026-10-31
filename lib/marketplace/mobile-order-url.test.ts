import { describe, expect, it } from "vitest";

import { marketplaceQueryFromOrder } from "@/lib/marketplace/query-from-order";
import { buildMobileDeOrderSearchUrl } from "@/lib/marketplace/search-urls";

describe("Nils 30.10: mobile.de «Izveidot» pēc Nila manuālo filtru principa", () => {
  const url = new URL(
    buildMobileDeOrderSearchUrl(
      marketplaceQueryFromOrder({
        brandModel: "Volvo XC60",
        productionYears: "2014-2016",
        maxMileage: "200000",
        totalBudget: "11000-15000",
        engineType: "Dīzelis",
        transmission: "Automāts",
        driveType: "Priekšpiedziņa",
        equipmentRequired: "Ādas salons\nKondicionieris",
        preferredColors: "Melna",
      }),
    ),
  );
  const p = url.searchParams;

  it("cena no 55 % līdz budžets - 2 000 €, gadi, km, degviela, kārba, tirgotāji, bez bojājumiem", () => {
    expect(url.hostname).toBe("suchen.mobile.de");
    expect(p.get("p")).toBe("8300:13000");
    expect(p.get("fr")).toBe("2014:2016");
    expect(p.get("ml")).toBe(":200000");
    expect(p.get("ft")).toBeTruthy();
    expect(p.get("tr")).toBeTruthy();
    expect(p.get("st")).toBe("DEALER");
    expect(p.get("dam")).toBe("0");
  });

  it("bez krāsām, aprīkojuma un priekšpiedziņas (pārdevēji to bieži nenorāda)", () => {
    expect(p.get("ecol")).toBeNull();
    expect(p.get("fe")).toBeNull();
    expect(p.get("dr")).toBeNull();
  });
});

describe("mobile.de modeļa ID no Nila filtriem", () => {
  const ms = (brandModel: string) =>
    new URL(buildMobileDeOrderSearchUrl(marketplaceQueryFromOrder({ brandModel, totalBudget: "15000" }))).searchParams.get("ms");
  it("zināmie modeļi saņem marka;modelis", () => {
    expect(ms("Volvo XC60")).toBe("25100;40");
    expect(ms("VW Golf 7")).toBe("25200;14");
    expect(ms("Škoda Kodiaq")).toBe("22900;19");
    expect(ms("Volkswagen Tiguan Allspace")).toBe("25200;66");
  });
  it("nezināms modelis - tikai marka (Nils pielabo ar roku)", () => {
    expect(ms("Volvo V90")).toBe("25100");
  });
});
