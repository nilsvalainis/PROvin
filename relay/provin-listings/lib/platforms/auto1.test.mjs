import assert from "node:assert/strict";
import test from "node:test";

import { yearOf } from "../items.mjs";
import { auto1ListApiRe, auto1SearchPageUrl, auto1Stage, findCarArrays, isAuto1EmptySearchJson, looksLikeAuto1EmptyResultsPage, mapAuto1Car } from "./auto1.mjs";

/** yearOf(String(ms)) šeit atrod "1960", kalendāra gads ir 2010. */
const REG_MS = 1262304196000;
const START_MS = Date.parse("2026-10-08T08:00:00.000Z");
const END_MS = Date.parse("2026-10-08T16:00:00.000Z");

function hit(over = {}) {
  return {
    id: 987654,
    stockNumber: "BW03512",
    manufacturer: "060",
    manufacturerName: "BMW",
    modelDescription: "320d",
    mainType: "3",
    subType: "320",
    firstRegistrationDate: REG_MS,
    km: 84500,
    fuelType: "Diesel",
    gearType: "Automatic",
    kw: 140,
    lastTopBidValue: null,
    minimumBid: 450000,
    auctionStartPrice: 400000,
    buyNowPrice: 890000,
    expectedPriceDisplay: 820000,
    mainImageFullUrl: "",
    images: [{ fullUrl: "https://img-pa.auto1.com/img/BW03512.jpg" }],
    location: { lat: 52.52, lon: 13.4 },
    currentLocation: { city: "Berlin", country: "DE" },
    countryCode: "DE",
    auctionStartDatetime: START_MS,
    auctionEndDatetime: END_MS,
    auctionSecLeft: 3600,
    auctionIdentifier: "auc-1",
    auctionType: "24D2",
    salesVatType: 1053,
    taxDeduction: false,
    sourceCountry: "DE",
    owningCountry: "DE",
    ...over,
  };
}

test("search endpoint is the default list API", () => {
  const re = auto1ListApiRe("");
  assert.equal(re.test("https://www.auto1.com/v1/car-search/cars/search/abc-123"), true);
  assert.equal(re.test("https://www.auto1.com/api/vehicles"), false);
});

test("hits[0] maps cents, ms dates, stockNumber and image fullUrl", () => {
  assert.equal(yearOf(String(REG_MS)), "1960");
  const body = { totalHits: 1, hits: [hit()], aggregations: {}, serverTime: START_MS };
  const cars = findCarArrays(body);
  assert.equal(cars.length, 1);
  const item = mapAuto1Car(cars[0][0], END_MS - 1000);

  assert.equal(item.externalId, "987654");
  assert.equal(item.stockNumber, "BW03512");
  assert.equal(item.manufacturer, "BMW");
  assert.equal(item.title, "BMW 320d");
  assert.equal(item.manufacturer.includes("060"), false);
  assert.equal(item.year, "2010");
  assert.equal(item.firstRegistration, "2010-01-01");
  assert.equal(item.mileageKm, 84500);
  assert.equal(item.fuel, "Diesel");
  assert.equal(item.transmission, "Automatic");
  assert.equal(item.powerKw, "140");
  assert.equal(item.countryCode, "DE");
  assert.equal(item.priceCurrent, null);
  assert.equal(item.priceMinimal, 4500);
  assert.equal(item.priceStart, 4000);
  assert.equal(item.priceBuyNow, 8900);
  assert.equal(item.expectedPrice, 8200);
  assert.equal(item.imageUrl, "https://img-pa.auto1.com/img/BW03512.jpg");
  assert.equal(item.location, "Berlin, DE");
  assert.equal(item.location.includes("52.52"), false);
  assert.equal(item.auctionStartAt, "2026-10-08T08:00:00.000Z");
  assert.equal(item.auctionEndAt, "2026-10-08T16:00:00.000Z");
  assert.equal(item.auctionId, "auc-1");
  assert.equal(item.auctionStage, "IN_AUCTION");
  assert.equal(item.vatNote, "salesVatType 1053");
  assert.equal(item.salesVatType, 1053);
  assert.equal(item.taxDeduction, false);
  assert.equal(item.sourceCountry, "DE");
  assert.equal(item.owningCountry, "DE");
  assert.equal(item.detailUrl, "https://www.auto1.com/en/app/merchant/car/BW03512");
});

test("search page URL always sets page, even when the saved URL has none", () => {
  assert.equal(
    auto1SearchPageUrl("https://www.auto1.com/en/app/merchant/cars?channel=24h", 2),
    "https://www.auto1.com/en/app/merchant/cars?channel=24h&page=2",
  );
  assert.equal(
    auto1SearchPageUrl("https://www.auto1.com/en/app/merchant/cars?channel=24h&page=1", 3),
    "https://www.auto1.com/en/app/merchant/cars?channel=24h&page=3",
  );
});

test("empty results page text is ok with 0 cars (Volvo S60 / BMW X3 searches)", () => {
  assert.equal(looksLikeAuto1EmptyResultsPage("No cars found for this search"), true);
  assert.equal(looksLikeAuto1EmptyResultsPage("0 results"), true);
  assert.equal(looksLikeAuto1EmptyResultsPage("BMW 320d in auction"), false);
});

test("live-shaped hit with mainImageFullUrl null uses images[].fullUrl", () => {
  const item = mapAuto1Car(hit({ mainImageFullUrl: null }));
  assert.equal(item.imageUrl, "https://img-pa.auto1.com/img/BW03512.jpg");
});

test("vatRate comes from finance, never meta.prices; seller country is not currentLocation", () => {
  const margin = mapAuto1Car(
    hit({
      currentLocation: { city: "Berlin", country: "DE" },
      countryCode: "BE",
      sourceCountry: "BE",
      owningCountry: "BE",
      meta: { finance: { vatRate: null, sourceCountryCode: "BE" }, prices: { vatRate: 21 } },
    }),
  );
  assert.equal(margin.vatRate, null);
  assert.equal(margin.sourceCountry, "BE");
  assert.equal(margin.countryCode, "BE");
  const gross = mapAuto1Car(hit({ meta: { finance: { vatRate: 19 } } }));
  assert.equal(gross.vatRate, 19);
});

test("empty search hits/totalHits is ok with 0 cars, not a missing-JSON error", () => {
  assert.equal(isAuto1EmptySearchJson({ totalHits: 0, hits: [], aggregations: {}, serverTime: START_MS }), true);
  assert.equal(isAuto1EmptySearchJson({ hits: [] }), true);
  assert.equal(isAuto1EmptySearchJson({ totalHits: 0 }), true);
  assert.equal(isAuto1EmptySearchJson({ totalHits: 1, hits: [hit()] }), false);
  assert.equal(findCarArrays({ totalHits: 0, hits: [] }).length, 0);
});

test("title falls back to mainType and subType, image prefers mainImageFullUrl, bid is cents", () => {
  const item = mapAuto1Car(
    hit({
      modelDescription: "",
      mainImageFullUrl: "https://img-pa.auto1.com/img/main.jpg",
      lastTopBidValue: 512300,
    }),
  );
  assert.equal(item.title, "BMW 3 320");
  assert.equal(item.imageUrl, "https://img-pa.auto1.com/img/main.jpg");
  assert.equal(item.priceCurrent, 5123);
});

test("stage uses auction times or seconds when auctionType is empty", () => {
  const during = hit({ auctionType: "" });
  assert.equal(auto1Stage(during, START_MS + 1000), "IN_AUCTION");
  assert.equal(auto1Stage(during, END_MS + 1000), "AFTER_AUCTION");
  assert.equal(auto1Stage(hit({ auctionType: "", auctionStartDatetime: null, auctionEndDatetime: null, auctionSecLeft: 12 }), 0), "IN_AUCTION");
  assert.equal(auto1Stage(hit({ auctionType: "", auctionStartDatetime: null, auctionEndDatetime: null, auctionSecLeft: 0 }), 0), "AFTER_AUCTION");
});
