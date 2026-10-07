import { describe, expect, it } from "vitest";
import {
  autobidDetailUrl,
  autobidPageUrl,
  extractNuxtDataJson,
  hydrateNuxtData,
  parseAutobidSearchPage,
} from "@/lib/iriss-listings-autobid";

/** Minimāls devalue masīvs tādā pašā formā kā autobid.de `__NUXT_DATA__` (2026-10). */
function fixtureFlat(): unknown[] {
  return [
    ["ShallowReactive", 1], // 0 root
    { state: 2 }, // 1
    { "$svue-query": 3 }, // 2
    { queries: 4 }, // 3
    [5], // 4
    { state: 6 }, // 5
    { data: 7 }, // 6
    { itemPageCount: 8, items: 9, metadata: 10 }, // 7
    3, // 8
    [11, 23], // 9 items
    { counters: -1 }, // 10
    // vehicle 1
    {
      id: 12,
      auctionId: 13,
      name: 14,
      stage: 15,
      price: 16,
      auctionStartDate: 20,
      slug: 21,
      manufacturer: 22,
      equipments: 26,
      imageGroups: 33,
      taxInformation: 38,
      additionalInformation: 39,
    }, // 11
    3587391, // 12
    83954, // 13
    "Volvo XC60 B5 AWD", // 14
    "BEFORE_AUCTION", // 15
    { start: 17, minimal: 18, current: 19 }, // 16
    32500, // 17
    22800, // 18
    0, // 19
    ["Date", "2026-10-08T08:00:00+00:00"], // 20
    "volvo-xc60-b5-awd-3587391", // 21
    { name: 42 }, // 22
    // vehicle 2 (bez slug, bez attēla)
    { id: 24, auctionId: 13, name: 25, stage: 15, price: 16, auctionStartDate: 20 }, // 23
    3587387, // 24
    "Volvo XC60 T6", // 25
    { eq21: 27, eq68: 29, eq17: 31, eq70: 41, eq168: 43 }, // 26 equipments
    { id: 21, name: "First registration", value: 28 }, // 27
    "07.2024", // 28
    { id: 68, name: "Read mileage", value: 30 }, // 29
    "93500", // 30
    { id: 17, name: "Fuel type", value: 32 }, // 31
    "Mild-Hybrid", // 32
    { itemMainImageSubgroup: 34 }, // 33
    [35], // 34
    { links: 36 }, // 35
    { m: 37 }, // 36
    "https://cdn.autobid.de/data/cars/x_m.jpg", // 37
    "Including 19% VAT", // 38
    { itemLocationCountry: 40 }, // 39
    { isoCode: 44 }, // 40
    { id: 70, name: "Transmission", value: 45 }, // 41
    "Volvo", // 42
    { id: 168, name: "Location", value: 46 }, // 43
    "DE", // 44
    "Automatic", // 45
    "Stuttgart", // 46
  ];
}

function fixtureHtml(): string {
  return `<html><head></head><body><div id="app"></div><script type="application/json" data-nuxt-data="nuxt-app" data-ssr="true" id="__NUXT_DATA__">${JSON.stringify(fixtureFlat())}</script></body></html>`;
}

describe("hydrateNuxtData", () => {
  it("resolves refs, wrappers, Date and negative specials", () => {
    const root = hydrateNuxtData([["Ref", 1], { a: 2, b: 3, c: -1, d: 4 }, "x", [2, 2], ["Date", "2026-01-01"]]) as Record<string, unknown>;
    expect(root.a).toBe("x");
    expect(root.b).toEqual(["x", "x"]);
    expect(root.c).toBeUndefined();
    expect(root.d).toBe("2026-01-01");
  });

  it("does not loop on cycles", () => {
    const root = hydrateNuxtData([{ self: 0, v: 1 }, 5]) as Record<string, unknown>;
    expect(root.v).toBe(5);
    expect(root.self).toBe(root);
  });
});

describe("parseAutobidSearchPage", () => {
  it("extracts vehicles, prices, equipment and page count", () => {
    const page = parseAutobidSearchPage(fixtureHtml());
    expect(page).not.toBeNull();
    expect(page!.pageCount).toBe(3);
    expect(page!.vehicles).toHaveLength(2);
    const v = page!.vehicles[0]!;
    expect(v.externalId).toBe("3587391");
    expect(v.auctionId).toBe("83954");
    expect(v.title).toBe("Volvo XC60 B5 AWD");
    expect(v.manufacturer).toBe("Volvo");
    expect(v.priceStart).toBe(32500);
    expect(v.priceMinimal).toBe(22800);
    expect(v.priceCurrent).toBeNull();
    expect(v.auctionStartAt).toBe("2026-10-08T08:00:00+00:00");
    expect(v.auctionStage).toBe("BEFORE_AUCTION");
    expect(v.detailUrl).toBe("https://autobid.de/en/item/volvo-xc60-b5-awd-3587391");
    expect(v.firstRegistration).toBe("07.2024");
    expect(v.year).toBe("2024");
    expect(v.mileageKm).toBe(93500);
    expect(v.fuel).toBe("Mild-Hybrid");
    expect(v.transmission).toBe("Automatic");
    expect(v.location).toBe("Stuttgart");
    expect(v.countryCode).toBe("DE");
    expect(v.imageUrl).toBe("https://cdn.autobid.de/data/cars/x_m.jpg");
    expect(v.vatNote).toBe("Including 19% VAT");

    const v2 = page!.vehicles[1]!;
    expect(v2.externalId).toBe("3587387");
    expect(v2.detailUrl).toBe("https://autobid.de/en/item/3587387");
    expect(v2.imageUrl).toBe("");
    expect(v2.mileageKm).toBeNull();
  });

  it("returns null when there is no __NUXT_DATA__ or no list structure", () => {
    expect(parseAutobidSearchPage("<html><body>Just a moment...</body></html>")).toBeNull();
    expect(extractNuxtDataJson("<html></html>")).toBeNull();
    const noList = `<script id="__NUXT_DATA__" type="application/json">${JSON.stringify([{ a: 1 }, "x"])}</script>`;
    expect(parseAutobidSearchPage(noList)).toBeNull();
  });

  it("treats a search with zero results as a valid empty page", () => {
    const flat = [{ data: 1 }, { itemPageCount: 2, items: 3 }, 0, []];
    const html = `<script id="__NUXT_DATA__" type="application/json">${JSON.stringify(flat)}</script>`;
    const page = parseAutobidSearchPage(html);
    expect(page).toEqual({ vehicles: [], pageCount: 0, pageNumber: 0 });
  });
});

describe("autobid urls", () => {
  it("pages with currentPage and strips it for page 1", () => {
    const base = "https://autobid.de/lv/meklesanas-rezultati?brandId-brand=49&name-model=XC60";
    expect(autobidPageUrl(base, 1)).toBe(base);
    expect(autobidPageUrl(base, 3)).toBe(`${base}&currentPage=3`);
    expect(autobidPageUrl(`${base}&currentPage=7`, 1)).toBe(base);
  });

  it("builds detail url from slug or id", () => {
    expect(autobidDetailUrl("a-b-1", "1")).toBe("https://autobid.de/en/item/a-b-1");
    expect(autobidDetailUrl("", "1")).toBe("https://autobid.de/en/item/1");
    expect(autobidDetailUrl("", "")).toBe("");
  });
});
