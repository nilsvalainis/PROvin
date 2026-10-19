import { describe, expect, it } from "vitest";
import { marketplaceActorSearchInput, buildAutoscout24SearchUrl, buildMobileDeSearchUrl } from "@/lib/marketplace/search-urls";
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

describe("marketplace search URLs", () => {
  it("puts all ranges on mobile.de search URL", () => {
    const url = buildMobileDeSearchUrl(volvoQuery());
    expect(url).toContain("suchen.mobile.de/fahrzeuge/search.html");
    expect(url).toContain("ms=25100");
    expect(url).toContain("XC60");
    expect(url).toMatch(/fr=2018%3A2021|fr=2018:2021/);
    expect(url).toContain("p=");
    expect(url).toContain("ml=");
    expect(url).toContain("cc=");
    expect(url).toContain("minPowerAsArray=110");
    expect(url).toContain("maxPowerAsArray=180");
    expect(url).toContain("ft=DIESEL");
    expect(url).toContain("tr=AUTOMATIC_GEAR");
    expect(url).toContain("dam=false");
    expect(url).toContain("cn=DE");
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
  });

  it("sends startUrls and structured filters to the actor", () => {
    const input = marketplaceActorSearchInput("mobilede", volvoQuery(), { maxItems: 40, sortNewest: true });
    expect(Array.isArray(input.startUrls)).toBe(true);
    expect(String((input.startUrls as { url: string }[])[0]?.url)).toContain("suchen.mobile.de");
    expect(input.make).toBe("Volvo");
    expect(input.priceFrom).toBe(10000);
    expect(input.cubicCapacityFrom).toBe(1900);
    expect(input.powerFromKw).toBe(110);
    expect(input.accidentFree).toBe(true);
    expect(input.country).toBe("DE");
  });
});
