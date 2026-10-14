import assert from "node:assert/strict";
import test from "node:test";

import {
  collectEcarstradeCardIds,
  ecarstradeCardNeedsPrice,
  ecarstradeRelayApiUrl,
  ecarstradeRelayDetailUrl,
  ecarstradeRelaySearchPageUrl,
  htmlFromEcarstradeApiBody,
  idsNeedingDetailPrice,
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
