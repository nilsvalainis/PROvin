import assert from "node:assert/strict";
import test from "node:test";

import {
  collectEcarstradeCardIds,
  collectIdsNeedingPrice,
  ecarstradeCardNeedsPrice,
  ecarstradeRelayApiUrl,
  ecarstradeRelayDetailUrl,
  ecarstradeRelaySearchPageUrl,
  extractEcarstradeRelayItem,
  extractEcarstradeRelayItems,
  htmlFromEcarstradeApiBody,
  idsNeedingDetailPrice,
  isEcarstradeFutureApiTrulyEmpty,
  itemsFromEcarstradeApiBody,
} from "./ecarstrade.mjs";

test("search page URL sets start for page 2+", () => {
  const src = "https://ecarstrade.com/search?mark[]=68&year_from=2018";
  const page1 = new URL(ecarstradeRelaySearchPageUrl(src, 1));
  const page2 = new URL(ecarstradeRelaySearchPageUrl(src, 2));
  assert.equal(page1.searchParams.get("year_from"), "2018");
  assert.equal(page1.searchParams.has("start"), false);
  assert.equal(page2.searchParams.get("start"), "20");
  assert.equal(ecarstradeRelayDetailUrl("7602956"), "https://ecarstrade.com/cars/7602956");
});

test("collects card ids and flags Sign in to buy", () => {
  const html = `
    <div class="card" data-itemId="111">Sign in to buy</div>
    <div class="card" data-itemId="222"><span>PIRKT</span> 16 200 €</div>
  `;
  assert.deepEqual(collectEcarstradeCardIds(html), ["111", "222"]);
  assert.equal(ecarstradeCardNeedsPrice("Sign in to buy"), true);
  assert.equal(ecarstradeCardNeedsPrice('<span>PIRKT</span> 16 200 €'), false);
  assert.deepEqual(idsNeedingDetailPrice(html), ["111"]);
});

test("idsNeedingDetailPrice does not take the next card euro", () => {
  const html = `
    <div class="card" data-itemId="1"><div class="title">A</div></div>
    <div class="card" data-itemId="2"><span>PIRKT</span> 16 200 €</div>
    <div class="card" data-itemId="3">Sign in to buy</div>
  `;
  assert.deepEqual(idsNeedingDetailPrice(html), ["1", "3"]);
  const items = [
    { externalId: "1", priceCurrent: null, priceBuyNow: null },
    { externalId: "2", priceCurrent: null, priceBuyNow: 16200 },
    { externalId: "3", priceCurrent: null, priceBuyNow: null },
  ];
  assert.deepEqual(collectIdsNeedingPrice(items, html, ["99"]), ["1", "3", "99"]);
});

test("future_api 404 and empty JSON are truly empty; CF html is not", () => {
  assert.equal(isEcarstradeFutureApiTrulyEmpty({ status: 404, text: "Not Found" }), true);
  assert.equal(isEcarstradeFutureApiTrulyEmpty({ status: 200, text: "" }), true);
  assert.equal(isEcarstradeFutureApiTrulyEmpty({ status: 200, text: "{}" }), true);
  assert.equal(isEcarstradeFutureApiTrulyEmpty({ status: 200, text: '{"status":404}' }), true);
  assert.equal(isEcarstradeFutureApiTrulyEmpty({ status: 403, text: "" }), false);
  assert.equal(
    isEcarstradeFutureApiTrulyEmpty({ status: 200, text: "<html>Just a moment... cloudflare</html>" }),
    false,
  );
  const card = '<div data-itemId="99"><span>PIRKT</span> 1 000 €</div>';
  const raw = JSON.stringify({ result: Buffer.from(card, "utf8").toString("base64") });
  assert.equal(isEcarstradeFutureApiTrulyEmpty({ status: 200, text: raw }), false);
});

test("detail page without data-itemId still yields PIRKT and current bid", () => {
  const html = `
    <h1>Volvo XC60</h1>
    <span class="car-price__current-bid__value">€ 12000</span>
    <button class="car-price__button">PIRKT 45000€</button>
  `;
  const item = extractEcarstradeRelayItem(html, { id: "6752454" });
  assert.equal(item?.externalId, "6752454");
  assert.equal(item?.priceCurrent, 12000);
  assert.equal(item?.priceBuyNow, 45000);
});

test("future_api URL copies search filters and skips iriss_ keys", () => {
  const api = new URL(ecarstradeRelayApiUrl("https://ecarstrade.com/search?mark[]=68&year_from=2018&sort=time_left&iriss_x=1", 20));
  assert.equal(api.pathname, "/future_api.php");
  assert.equal(api.searchParams.get("request_type"), "cars");
  assert.equal(api.searchParams.get("auction_type"), "search");
  assert.equal(api.searchParams.get("start"), "20");
  assert.equal(api.searchParams.get("perpage"), "20");
  assert.equal(api.searchParams.get("sort"), "time_left.asc");
  assert.equal(api.searchParams.get("mark[]"), "68");
  assert.equal(api.searchParams.get("year_from"), "2018");
  assert.equal(api.searchParams.has("iriss_x"), false);
});

test("future_api concatenated JSON result is card HTML", () => {
  const card = '<div data-itemId="99"><span>PIRKT</span> 1 000 €</div>';
  const raw = `${JSON.stringify({ result: Buffer.from(card, "utf8").toString("base64") })}${JSON.stringify({ result: "" })}`;
  const html = htmlFromEcarstradeApiBody(raw);
  assert.match(html, /data-itemId="99"/);
  assert.deepEqual(collectEcarstradeCardIds(html), ["99"]);
});

test("extracts current bid and buy-now from a logged-in card", () => {
  const html = `
    <div class="card rounded-6 car-item" data-itemId="6752454" data-auction-type="bid_or_fix">
      <div class="item-title"><span>Audi R8 Spyder</span></div>
      <span class="car-price__current-bid__value">€ 12000</span>
      <button class="car-price__button">PIRKT 45000€</button>
    </div>`;
  const items = extractEcarstradeRelayItems(html);
  assert.equal(items.length, 1);
  assert.equal(items[0].externalId, "6752454");
  assert.equal(items[0].priceCurrent, 12000);
  assert.equal(items[0].priceBuyNow, 45000);
  assert.match(items[0].title, /Audi R8/i);
});

test("extracts PIRKT when the title is only in the muted subtitle", () => {
  const html = `
    <div class="wrap">
      <div class="small text-muted">#7602956 - Hyundai Tucson</div>
      <div data-itemId="7602956" data-auction-type="stock">
        <button class="car-price__button">PIRKT 16200€</button>
      </div>
    </div>`;
  const items = extractEcarstradeRelayItems(html);
  assert.equal(items[0].externalId, "7602956");
  assert.equal(items[0].priceBuyNow, 16200);
  assert.match(items[0].title, /Hyundai Tucson|#7602956/i);
});

test("future_api JSON data.max_bid becomes current price on the item", () => {
  const card = '<div data-itemId="99"><div class="item-title"><span>Volvo XC60</span></div></div>';
  const raw = JSON.stringify({
    car_id: "99",
    data: { id: "99", max_bid: "25500", auction_type: "bid" },
    result: Buffer.from(card, "utf8").toString("base64"),
  });
  const items = itemsFromEcarstradeApiBody(raw);
  assert.equal(items.length, 1);
  assert.equal(items[0].priceCurrent, 25500);
  assert.equal(items[0].title, "Volvo XC60");
});
