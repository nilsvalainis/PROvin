import assert from "node:assert/strict";
import test from "node:test";

import {
  fetchAuctionDetail,
  filterDetailPhotos,
  findDetailObject,
  findJsonPhotoList,
  flattenJsonFields,
  mergeDetailExtracts,
  photoIdentity,
  validDetailUrl,
} from "./detail-page.mjs";

test("validDetailUrl: tikai detaļu lapas uz platformas hosta, Openlane -> /en/", () => {
  assert.equal(validDetailUrl("auto1", "https://www.auto1.com/en/app/merchant/car/DE48213"), "https://www.auto1.com/en/app/merchant/car/DE48213");
  assert.equal(validDetailUrl("auto1", "https://www.auto1.com/en/app/merchant/cars?channel=24h"), "");
  assert.equal(validDetailUrl("auto1", "http://www.auto1.com/en/app/merchant/car/DE48213"), "");
  assert.equal(validDetailUrl("auto1", "https://evil.example/car/DE48213"), "");
  assert.equal(validDetailUrl("openlane", "https://www.openlane.eu/lv/car/info?auctionId=8123456"), "https://www.openlane.eu/en/car/info?auctionId=8123456");
  assert.equal(validDetailUrl("openlane", "https://www.openlane.eu/en/car/8123456"), "https://www.openlane.eu/en/car/8123456");
  assert.equal(validDetailUrl("openlane", "https://www.openlane.eu/en/findcarv6"), "");
  assert.equal(validDetailUrl("autobid", "https://autobid.de/en/item/3051234"), "");
});

test("flattenJsonFields izmet konta laukus", () => {
  const flat = flattenJsonFields({
    stockNumber: "DE48213",
    km: 64300,
    merchantId: 77,
    user: { email: "x@y.z", token: "abc" },
    accessToken: "secret",
    equipment: ["Navigation", "Leather"],
    damages: [{ area: "Front door right", type: "Scratch" }],
  });
  const keys = flat.map(([k]) => k);
  assert.ok(keys.includes("stockNumber"));
  assert.ok(keys.includes("equipment"));
  assert.ok(keys.includes("damages[0].area"));
  assert.ok(!keys.some((k) => /token|email|merchantId/i.test(k)));
  assert.deepEqual(flat.find(([k]) => k === "equipment"), ["equipment", "Navigation, Leather"]);
});

test("findDetailObject atrod lielāko objektu ar šo id", () => {
  const json = { data: { car: { stockNumber: "DE48213", km: 1, manufacturerName: "BMW", vin: "WBA" }, related: [{ stockNumber: "DE11111", km: 2 }] } };
  assert.equal(findDetailObject(json, "de48213")?.vin, "WBA");
  assert.equal(findDetailObject(json, "XX"), null);
});

test("findJsonPhotoList: garākais attēlu saraksts, secība saglabāta", () => {
  const json = {
    images: [
      { fullUrl: "https://img-pa.auto1.com/a/1.jpg", type: "FRONT_LEFT" },
      { fullUrl: "https://img-pa.auto1.com/a/2.jpg" },
      { fullUrl: "https://img-pa.auto1.com/a/3.jpg" },
    ],
    logos: ["https://x.com/logo.svg", "https://x.com/icon.svg"],
  };
  assert.deepEqual(findJsonPhotoList(json), ["https://img-pa.auto1.com/a/1.jpg", "https://img-pa.auto1.com/a/2.jpg", "https://img-pa.auto1.com/a/3.jpg"]);
});

test("filterDetailPhotos: hosts, ikonas, izmēru dublikāti", () => {
  const out = filterDetailPhotos("auto1", [
    { url: "https://img-pa.auto1.com/a/1.jpg?w=200", w: 200 },
    { url: "https://img-pa.auto1.com/a/1.jpg?w=1200", w: 1200 },
    { url: "https://www.auto1.com/static/logo.png", w: 300 },
    { url: "https://img-pa.auto1.com/a/2.jpg", w: 40 },
    { url: "https://cdn.other.com/a/3.jpg", w: 800 },
    "https://img-pa.auto1.com/a/4.jpg",
  ]);
  assert.deepEqual(out, ["https://img-pa.auto1.com/a/1.jpg?w=200", "https://img-pa.auto1.com/a/4.jpg"]);
  assert.equal(photoIdentity("https://h.com/x/thumb/1.jpg?w=10"), photoIdentity("https://h.com/x/1.jpg"));
  const ol = filterDetailPhotos("openlane", ["https://cdn.openlane.eu/images/car/1.jpg", "https://www.openlane.eu/en/car/info", "https://cdn.openlane.eu/icons/flag-de.png"]);
  assert.deepEqual(ol, ["https://cdn.openlane.eu/images/car/1.jpg"]);
});

test("mergeDetailExtracts apvieno cilnes bez dublikātiem", () => {
  const m = mergeDetailExtracts([
    { title: "BMW 320d", fields: [["Keys", "2"], ["Fuel type", "Diesel"]], tables: [], lists: [], photos: [{ url: "a" }], text: "abc" },
    { title: "", fields: [["Keys", "2"], ["Inspection expires", "05/2026"]], tables: [[["Area", "Damage"], ["Door", "Scratch"]]], lists: [{ heading: "Equipment", items: ["Navi", "Leather"] }], photos: [{ url: "b" }], text: "abcdef" },
  ]);
  assert.equal(m.title, "BMW 320d");
  assert.deepEqual(m.fields, [["Keys", "2"], ["Fuel type", "Diesel"], ["Inspection expires", "05/2026"]]);
  assert.equal(m.tables.length, 1);
  assert.equal(m.lists[0].items.length, 2);
  assert.equal(m.photos.length, 2);
  assert.equal(m.text, "abcdef");
});

function fakePage({ url, status = 200, extract, jsonResponses = [] }) {
  const handlers = [];
  let current = "";
  return {
    on: (ev, fn) => ev === "response" && handlers.push(fn),
    off: () => undefined,
    url: () => current,
    goto: async (u) => {
      current = url ?? u;
      for (const r of jsonResponses) for (const h of handlers) await h(r);
      return { status: () => status };
    },
    evaluate: async (fn) => (fn.name === "extractDetailDom" ? extract : undefined),
    locator: () => ({ filter: () => ({ first: () => ({ count: async () => 0 }) }) }),
  };
}

const jsonRes = (u, body) => ({ url: () => u, headers: () => ({ "content-type": "application/json" }), json: async () => body });

test("fetchAuctionDetail: Auto1 JSON auto objekts + DOM lauki, foto izsoles secībā", async () => {
  const page = fakePage({
    extract: {
      title: "BMW 320d xDrive",
      fields: [["Keys", "2"], ["Inspection expires", "05/2026"], ["a", "1"], ["b", "2"], ["c", "3"], ["d", "4"], ["e", "5"], ["f", "6"]],
      tables: [],
      lists: [],
      photos: [{ url: "https://img-pa.auto1.com/a/9.jpg", w: 800 }],
      text: "",
    },
    jsonResponses: [
      jsonRes("https://www.auto1.com/v1/user-token/obtain-token", { token: "x", stockNumber: "DE48213" }),
      jsonRes("https://www.auto1.com/v1/car-details/DE48213", {
        stockNumber: "DE48213",
        manufacturerName: "BMW",
        modelDescription: "320d xDrive",
        km: 64300,
        vin: "WBA5A71000FH12345",
        images: [{ fullUrl: "https://img-pa.auto1.com/a/1.jpg" }, { fullUrl: "https://img-pa.auto1.com/a/2.jpg" }],
      }),
    ],
  });
  const out = await fetchAuctionDetail(page, "auto1", "https://www.auto1.com/en/app/merchant/car/DE48213", { sleep: async () => undefined });
  assert.equal(out.status, "ok");
  assert.equal(out.detail.item.vin, "WBA5A71000FH12345");
  assert.equal(out.detail.item.mileageKm, 64300);
  assert.deepEqual(out.detail.photos, ["https://img-pa.auto1.com/a/1.jpg", "https://img-pa.auto1.com/a/2.jpg", "https://img-pa.auto1.com/a/9.jpg"]);
  assert.ok(out.detail.fields.some(([l]) => l === "Keys"));
  assert.ok(!out.detail.jsonFields.some(([k]) => /token/i.test(k)));
});

test("fetchAuctionDetail: login lapa -> login_required, 404 -> not_found", async () => {
  const login = fakePage({ url: "https://www.auto1.com/en/merchant/signin", extract: null });
  assert.equal((await fetchAuctionDetail(login, "auto1", "https://www.auto1.com/en/app/merchant/car/DE48213", { sleep: async () => undefined })).status, "login_required");
  const gone = fakePage({ status: 404, extract: null });
  assert.equal((await fetchAuctionDetail(gone, "openlane", "https://www.openlane.eu/en/car/8123456", { sleep: async () => undefined })).status, "not_found");
});
