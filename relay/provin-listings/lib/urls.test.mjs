import assert from "node:assert/strict";
import test from "node:test";

import { listingsFetchKey, listingsFetchUrl, listingsUrlLog } from "./urls.mjs";

test("listingsFetchUrl drops iriss_ and start, keeps auction filters", () => {
  const a = listingsFetchUrl(
    "https://ecarstrade.com/search?year_from=2018&mark[]=68&iriss_drive=awd&start=20",
  );
  const b = listingsFetchUrl("https://ecarstrade.com/search/?mark[]=68&year_from=2018&iriss_need=led");
  assert.equal(a, b);
  assert.match(a, /mark%5B%5D=68|mark\[\]=68/);
  assert.match(a, /year_from=2018/);
  assert.equal(/iriss_/.test(a), false);
  assert.equal(/start=/.test(a), false);
});

test("listingsFetchKey and log keep the full URL plus hash", () => {
  const url =
    "https://ecarstrade.com/search?mark[]=68&model[]=1866&year_from=2018&year_to=2022&fuel[]=Diesel&gearbox[]=Automatic";
  assert.equal(listingsFetchKey("ecarstrade", url), `ecarstrade|${listingsFetchUrl(url)}`);
  const line = listingsUrlLog(url);
  assert.match(line, /ecarstrade\.com\/search\?mark/);
  assert.match(line, /gearbox\[\]=Automatic|gearbox%5B%5D=Automatic/);
  assert.match(line, / #[0-9a-f]{10}$/);
  assert.equal(line.includes(url) || line.includes(listingsFetchUrl(url)) || line.startsWith("https://"), true);
  assert.ok(line.length > 100);
});
