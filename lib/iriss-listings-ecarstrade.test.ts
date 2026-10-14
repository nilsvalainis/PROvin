import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { shouldExcludeIrissListing } from "@/lib/iriss-listings-exclude-rules";
import { listingCardPriceLabel, listingComparisonPrice } from "@/lib/iriss-listings-cost";
import {
  decodeEcarstradeCardHtml,
  ecarstradeApiUrl,
  ecarstradeCarJsonUrl,
  ecarstradeDetailUrl,
  ecarstradePageStart,
  ecarstradeSearchPageUrl,
  mergeEcarstradeHtmlPrices,
  mergeEcarstradeJsonPrices,
  parseEcarstradeApiPage,
  parseEcarstradeCard,
  parseEcarstradeSearchHtml,
  readEcarstradeAuth,
  splitConcatenatedJsonObjects,
} from "@/lib/iriss-listings-ecarstrade";

const FIX = join(dirname(fileURLToPath(import.meta.url)), "__fixtures__", "iriss-ecarstrade");

function card(name: string): string {
  return readFileSync(join(FIX, name), "utf8");
}

function apiBody(cards: Array<{ id: string; html: string; maxBid?: string | null; close?: string }>): string {
  const parts = ["{}"];
  for (const c of cards) {
    parts.push(
      JSON.stringify({
        status: "101",
        car_id: c.id,
        data: { id: c.id, max_bid: c.maxBid ?? null, close_date: c.close ?? "14 Oct 2026 09:10" },
        result: Buffer.from(c.html, "utf8").toString("base64"),
      }),
    );
  }
  return parts.join("");
}

describe("eCarsTrade parser", () => {
  it("reads title, kW, km, country, VAT and bid from a public card", () => {
    const v = parseEcarstradeCard(card("card-volvo.html"), {
      id: "7672194",
      max_bid: "25500",
      close_date: "14 Oct 2026 09:10",
    });
    expect(v).toMatchObject({
      externalId: "7672194",
      manufacturer: "Volvo",
      countryCode: "BE",
      powerKw: "200",
      mileageKm: 8388,
      fuel: "Electric",
      transmission: "Automatic",
      year: "2025",
      firstRegistration: "12/2025",
      priceCurrent: 25500,
      taxDeduction: true,
      vatNote: "VAT deductible",
      auctionId: "120004",
      auctionStage: "BLIND_AUCTION",
    });
    expect(v?.title).toMatch(/VOLVO EX30/i);
    expect(v?.detailUrl).toBe("https://ecarstrade.com/cars/7672194");
    expect(v?.imageUrl).toContain("7672194");
    expect(v?.location).toMatch(/Belgium/i);
    expect(v?.auctionEndAt).toBe("2026-10-14T07:10:00.000Z");
  });

  it("keeps a Volvo 110 kW card for the exclude-rules layer and drops France in the API page", () => {
    const volvo110 = parseEcarstradeCard(card("card-volvo-110.html"), { id: "1100001", max_bid: "4000" });
    expect(volvo110?.countryCode).toBe("DE");
    expect(volvo110?.powerKw).toBe("110");
    expect(shouldExcludeIrissListing({ manufacturer: volvo110?.manufacturer, title: volvo110?.title, powerKw: volvo110?.powerKw })).toBe(
      true,
    );
    const page = parseEcarstradeApiPage(
      apiBody([
        { id: "7672194", html: card("card-volvo.html"), maxBid: "25500" },
        { id: "8800001", html: card("card-france.html"), maxBid: "9000" },
      ]),
    );
    expect(page?.vehicles.map((v) => v.externalId)).toEqual(["7672194"]);
  });

  it("splits concatenated JSON and decodes base64 cards", () => {
    const raw = apiBody([{ id: "1", html: "<div>ok</div>" }]);
    const objs = splitConcatenatedJsonObjects(raw);
    expect(objs).toHaveLength(1);
    expect(decodeEcarstradeCardHtml(objs[0]!.result)).toBe("<div>ok</div>");
  });

  it("forces BE/NL/LU/DE on the API URL and keeps mark/model from the search link", () => {
    const url = ecarstradeApiUrl("https://ecarstrade.com/search?mark[]=68&country[]=FRA&country[]=ESP&sort=price", 20, 20);
    const u = new URL(url);
    expect(u.pathname).toBe("/future_api.php");
    expect(u.searchParams.get("request_type")).toBe("cars");
    expect(u.searchParams.get("start")).toBe("20");
    expect(u.searchParams.get("mark[]")).toBe("68");
    expect(u.searchParams.getAll("country[]")).toEqual(["BEL", "NET", "LUX", "GER"]);
    expect(u.searchParams.get("sort")).toBe("price.asc");
    expect(ecarstradePageStart(1)).toBe(0);
    expect(ecarstradePageStart(2, 20)).toBe(20);
    expect(ecarstradeSearchPageUrl("https://ecarstrade.com/search?mark[]=68", 20)).toContain("start=20");
    expect(ecarstradeDetailUrl("7672194")).toBe("https://ecarstrade.com/cars/7672194");
  });

  it("reads credentials only from env and never invents a default user", () => {
    expect(readEcarstradeAuth({})).toBeNull();
    expect(readEcarstradeAuth({ ECARSTRADE_USER: "sia-iriss@inbox.lv" })).toBeNull();
    expect(readEcarstradeAuth({ ECARSTRADE_USER: "sia-iriss@inbox.lv", ECARSTRADE_PASS: "secret" })).toEqual({
      username: "sia-iriss@inbox.lv",
      password: "secret",
    });
  });

  it("does not invent a price or 2036 end date for a public stock card (Tucson 7602956)", () => {
    const v = parseEcarstradeCard(card("card-tucson-public.html"), {
      id: "7602956",
      max_bid: null,
      close_date: "31 Dec 2036 23:59",
      close_time: false,
    });
    expect(v).toMatchObject({
      externalId: "7602956",
      auctionStage: "STOCK",
      priceBuyNow: null,
      priceCurrent: null,
      auctionEndAt: "",
      taxDeduction: true,
      countryCode: "BE",
      powerKw: "169",
      mileageKm: 105926,
    });
    expect(listingComparisonPrice({ ...v, platform: "ecarstrade" })).toBeNull();
  });

  it("parses PIRKT 16200 from a logged-in stock card and ignores Kopējā 16500 and the 2036 placeholder", () => {
    const v = parseEcarstradeCard(card("card-tucson-loggedin.html"), {
      id: "7602956",
      max_bid: null,
      close_date: "31 Dec 2036 23:59",
    });
    expect(v?.priceBuyNow).toBe(16200);
    expect(v?.priceCurrent).toBeNull();
    expect(v?.auctionEndAt).toBe("");
    expect(v?.auctionStage).toBe("STOCK");
    expect(listingComparisonPrice({ ...v!, platform: "ecarstrade" })).toBe(16200);
    expect(listingCardPriceLabel({ ...v!, platform: "ecarstrade" })).toBe("Pirkt uzreiz");
  });

  it("parses fixed-price PIRKT and keeps a real close time; public fix has neither price nor fake date", () => {
    const pub = parseEcarstradeCard(card("card-fix-public.html"), {
      id: "7691293",
      max_bid: null,
      close_date: "15 Oct 2026 13:10",
    });
    expect(pub?.priceBuyNow).toBeNull();
    expect(pub?.auctionStage).toBe("FIXED_PRICE");
    expect(pub?.auctionEndAt).toBe("2026-10-15T11:10:00.000Z");
    const logged = parseEcarstradeCard(card("card-fix-loggedin.html"), {
      id: "7691293",
      close_date: "15 Oct 2026 13:10",
    });
    expect(logged?.priceBuyNow).toBe(8900);
    expect(logged?.priceCurrent).toBeNull();
    expect(logged?.auctionEndAt).toBe("2026-10-15T11:10:00.000Z");
  });

  it("parses bid-or-fix current bid and buy-now; public card has no prices", () => {
    const pub = parseEcarstradeCard(card("card-bid-or-fix-public.html"), { id: "6752454", max_bid: null });
    expect(pub?.priceBuyNow).toBeNull();
    expect(pub?.priceCurrent).toBeNull();
    expect(pub?.auctionStage).toBe("BID_OR_BUY_NOW");
    const logged = parseEcarstradeCard(card("card-bid-or-fix-loggedin.html"), { id: "6752454" });
    expect(logged?.priceBuyNow).toBe(45000);
    expect(logged?.priceCurrent).toBe(12000);
    expect(listingComparisonPrice({ ...logged!, platform: "ecarstrade" })).toBe(45000);
  });

  it("treats a 850 € public tender floor as start, not a live bid", () => {
    const v = parseEcarstradeCard(card("card-volvo.html"), { id: "7672194", max_bid: "850" });
    expect(v?.priceStart).toBe(850);
    expect(v?.priceCurrent).toBeNull();
    expect(listingComparisonPrice({ ...v!, platform: "ecarstrade" })).toBeNull();
  });

  it("fills stock buy-now from /api/v1/cars JSON without using Kopējā as the bid", () => {
    const pub = parseEcarstradeCard(card("card-tucson-public.html"), {
      id: "7602956",
      max_bid: null,
      close_date: "31 Dec 2036 23:59",
    });
    expect(pub).toBeTruthy();
    const merged = mergeEcarstradeJsonPrices(pub!, {
      data: { id: "7602956", auction_type: "stock", buy_now_price: 16200, total_price: 16500, close_date: "31 Dec 2036 23:59" },
    });
    expect(merged.priceBuyNow).toBe(16200);
    expect(merged.priceCurrent).toBeNull();
    expect(merged.auctionEndAt).toBe("");
    expect(ecarstradeCarJsonUrl("7602956")).toBe("https://ecarstrade.com/api/v1/cars/7602956");
  });

  it("fills stock buy-now from logged-in HTML without using Kopējā", () => {
    const pub = parseEcarstradeCard(card("card-tucson-public.html"), {
      id: "7602956",
      max_bid: null,
      close_date: "31 Dec 2036 23:59",
    });
    expect(pub).toBeTruthy();
    const merged = mergeEcarstradeHtmlPrices(pub!, card("card-tucson-loggedin.html"));
    expect(merged.priceBuyNow).toBe(16200);
    expect(merged.priceCurrent).toBeNull();
    expect(mergeEcarstradeHtmlPrices(pub!, card("card-tucson-public.html")).priceBuyNow).toBeNull();
  });

  it("keeps a card when item-title is missing but data-itemId and PIRKT are present", () => {
    const html = `
      <div class="car-item" data-itemId="888001" data-auction-type="stock">
        <img alt="Opel Vivaro" src="/thumbnails/carsphotos/888001/photo_000/x.jpg">
        <button class="car-price__button">PIRKT 9900€</button>
        <span>Belgium</span>
        <div class="item-action" style="background-image: url('/images/flags/h40/be.png')"></div>
      </div>`;
    const v = parseEcarstradeCard(html, { id: "888001" });
    expect(v).toMatchObject({ externalId: "888001", priceBuyNow: 9900, countryCode: "BE" });
    expect(v?.title).toMatch(/Opel Vivaro|#888001/i);
    expect(parseEcarstradeSearchHtml(`<html>${html}</html>`)).toHaveLength(1);
  });

  it("parses PIRKT from a logged-in /search HTML page", () => {
    const html = `<html><body>${card("card-tucson-loggedin.html")}</body></html>`;
    const vehicles = parseEcarstradeSearchHtml(html);
    expect(vehicles).toHaveLength(1);
    expect(vehicles[0]).toMatchObject({ externalId: "7602956", priceBuyNow: 16200 });
    expect(parseEcarstradeSearchHtml("<html><title>Just a moment...</title></html>")).toEqual([]);
  });
});
