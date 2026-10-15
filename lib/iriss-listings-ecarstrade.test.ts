import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { shouldExcludeIrissListing } from "@/lib/iriss-listings-exclude-rules";
import { listingCardPriceLabel, listingComparisonPrice } from "@/lib/iriss-listings-cost";
import {
  decodeEcarstradeCardHtml,
  ecarstradeApiUrl,
  ecarstradeAuctionTypeFromHtml,
  ecarstradeCarJsonUrl,
  ecarstradeDetailUrl,
  ecarstradePageStart,
  ecarstradeSearchPageUrl,
  isEcarstradeBidNoBidsHtml,
  mergeEcarstradeHtmlPrices,
  mergeEcarstradeJsonPrices,
  parseEcarstradeApiPage,
  parseEcarstradeCard,
  parseEcarstradeCardPrices,
  parseEcarstradeSearchHtml,
  readEcarstradeAuth,
  splitConcatenatedJsonObjects,
} from "@/lib/iriss-listings-ecarstrade";

/** Logged-in /cars/{id} FIX (7687027 BMW X5). Nav „Buy” first so old PIRKT window failed. */
const DETAIL_FIX_7687027 = `
<nav><a href="/search">Buy</a><a href="/account">My account</a></nav>
<h1>BMW X5</h1>
<a class="item-bid-button fix" data-price="27200" data-href="/bids/buy_or_offer?car_id=7687027&amp;bid=27200"> Buy<span> 27200€</span></a>
<input type="text" id="calc_bid" value="27200,00" />
<label>Price excl. VAT</label>`;

const DETAIL_FIX_7694037 = `
<nav><a href="/buy">Buy</a></nav>
<a class="item-bid-button fix" data-price="22800" data-href="/bids/buy_or_offer?car_id=7694037&amp;bid=22800"> Buy<span> 22800€</span></a>
<input id="calc_bid" value="22800,00" />`;

/** BID no bids (7677985). Empty data-price is real, not a parse miss. */
const DETAIL_BID_7677985 = `
<nav><a href="/buy">Buy</a></nav>
<a class="item-bid-button bid">Place a bid</a>
<div class="min-market-price d-none" data-price="">Min. Market Price</div>
<div class="recommended-bid d-none" data-price="">Recommended bid</div>`;

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
    expect(
      listingComparisonPrice({
        platform: "ecarstrade",
        priceCurrent: v?.priceCurrent ?? null,
        priceStart: v?.priceStart ?? null,
        priceBuyNow: v?.priceBuyNow ?? null,
        priceMinimal: v?.priceMinimal ?? null,
        priceEstimate: v?.priceEstimate ?? null,
      }),
    ).toBeNull();
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
    expect(listingComparisonPrice({ ...logged!, platform: "ecarstrade" })).toBe(12000);
    expect(listingCardPriceLabel({ ...logged!, platform: "ecarstrade" })).toBe("Solījums");
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

  it("reads FIX buy-now from item-bid-button.fix data-price, not nav Buy", () => {
    const x5 = parseEcarstradeCardPrices(DETAIL_FIX_7687027);
    expect(x5.buyNow).toBe(27200);
    expect(x5.current).toBeNull();
    expect(ecarstradeAuctionTypeFromHtml(DETAIL_FIX_7687027)).toBe("fix");
    const v = parseEcarstradeCard(DETAIL_FIX_7687027, { id: "7687027" });
    expect(v).toMatchObject({
      externalId: "7687027",
      priceBuyNow: 27200,
      priceCurrent: null,
      auctionStage: "FIXED_PRICE",
    });
    expect(listingCardPriceLabel({ ...v!, platform: "ecarstrade" })).toBe("Pirkt uzreiz");
    expect(parseEcarstradeCardPrices(DETAIL_FIX_7694037).buyNow).toBe(22800);
    expect(parseEcarstradeCard(DETAIL_FIX_7694037, { id: "7694037" })?.priceBuyNow).toBe(22800);
  });

  it("treats BID Place a bid with empty data-price as unpriced; max_bid stays current", () => {
    expect(isEcarstradeBidNoBidsHtml(DETAIL_BID_7677985)).toBe(true);
    const parsed = parseEcarstradeCardPrices(DETAIL_BID_7677985);
    expect(parsed).toEqual({ buyNow: null, current: null, start: null, estimate: null, total: null });
    const v = parseEcarstradeCard(DETAIL_BID_7677985, { id: "7677985" });
    expect(v).toMatchObject({
      externalId: "7677985",
      priceBuyNow: null,
      priceCurrent: null,
      priceEstimate: null,
      auctionStage: "BLIND_AUCTION",
    });
    expect(listingCardPriceLabel({ ...v!, platform: "ecarstrade" })).toBe("nav cenas");
    const withListBid = parseEcarstradeCard(DETAIL_BID_7677985, {
      id: "7677985",
      auction_type: "bid",
      max_bid: "15100",
    });
    expect(withListBid).toMatchObject({ priceBuyNow: null, priceCurrent: 15100, auctionStage: "BLIND_AUCTION" });
    expect(listingCardPriceLabel({ ...withListBid!, platform: "ecarstrade" })).toBe("Solījums");
    const pub = parseEcarstradeCard(card("card-tucson-public.html"), {
      id: "7602956",
      max_bid: null,
      close_date: "31 Dec 2036 23:59",
    });
    const merged = mergeEcarstradeHtmlPrices(pub!, DETAIL_BID_7677985);
    expect(merged.priceBuyNow).toBeNull();
    expect(merged.priceCurrent).toBeNull();
  });

  it("takes FIX buy-now from buy_or_offer bid= or #calc_bid when data-price is empty", () => {
    const hrefOnly = `
      <nav><a href="/buy">Buy</a></nav>
      <a class="item-bid-button fix" data-href="/bids/buy_or_offer?car_id=7687027&amp;bid=27200"> Buy</a>`;
    expect(parseEcarstradeCardPrices(hrefOnly).buyNow).toBe(27200);
    const calcOnly = `
      <a class="item-bid-button fix">Buy</a>
      <input id="calc_bid" value="27200,00" />
      <span>Price excl. VAT</span>`;
    expect(parseEcarstradeCardPrices(calcOnly).buyNow).toBe(27200);
  });

  it("reads Aplēses cena before Kopējā and before buy-now, and keeps a live bid first", () => {
    const html = card("detail-estimate-7693493.html");
    const json = JSON.parse(card("detail-estimate-7693493.json")) as { data: Record<string, unknown> };
    const fromHtml = parseEcarstradeCard(html, { id: "7693493", auction_type: "bid" });
    expect(fromHtml).toMatchObject({
      externalId: "7693493",
      priceCurrent: null,
      priceBuyNow: null,
      priceEstimate: 17000,
      priceTotal: 17300,
      auctionStage: "BLIND_AUCTION",
    });
    expect(listingComparisonPrice({ ...fromHtml!, platform: "ecarstrade" })).toBe(17000);
    expect(listingCardPriceLabel({ ...fromHtml!, platform: "ecarstrade" })).toBe("Aplēse");
    const fromJson = parseEcarstradeCard(`<div data-itemId="7693493"></div>`, json.data);
    expect(fromJson).toMatchObject({ priceEstimate: 17000, priceTotal: 17300, priceCurrent: null, priceBuyNow: null });
    const withBid = parseEcarstradeCard(
      html.replace('data-price=""', 'data-price="15100"').replace(
        "Aplēses cena",
        `Aktuālais solījums</span><span class="car-price__current-bid__value">€ 15100</span><span>Aplēses cena`,
      ) + `<button class="car-price__button">PIRKT 19000€</button>`,
      { id: "7693493", auction_type: "bid", max_bid: "15100" },
    );
    expect(withBid?.priceCurrent).toBe(15100);
    expect(withBid?.priceEstimate).toBe(17000);
    expect(withBid?.priceBuyNow).toBe(19000);
    expect(listingComparisonPrice({ ...withBid!, platform: "ecarstrade" })).toBe(15100);
    expect(listingCardPriceLabel({ ...withBid!, platform: "ecarstrade" })).toBe("Solījums");
  });
});
