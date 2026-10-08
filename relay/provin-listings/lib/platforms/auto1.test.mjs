import assert from "node:assert/strict";
import test from "node:test";

import { yearOf } from "../items.mjs";
import { auto1ListApiRe, auto1Stage, findCarArrays, mapAuto1Car } from "./auto1.mjs";

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
    fuel: "Diesel",
    transmission: "Automatic",
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
  assert.equal(item.auctionStage, "24D2");
  assert.equal(item.vatNote, "salesVatType 1053");
  assert.equal(item.detailUrl, "https://www.auto1.com/en/app/merchant/car/BW03512");
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
