import assert from "node:assert/strict";
import test from "node:test";

import {
  autobidLotFromNuxt,
  cleanVin,
  lotLooksGone,
  lotVinResult,
  openlaneLotFromJson,
  runLotVinBatch,
  validLotUrl,
  vinFromPageText,
  vinTail,
} from "./lot-vin-logic.mjs";

/** Devalue forma: objekti rāda uz masīva indeksiem. */
function nuxt(chassisValue) {
  return JSON.stringify([
    { data: 1 },
    { item: 2 },
    { attributes: 3, title: 16 },
    [4, 8, 12],
    { id: 5, name: 6, rawValue: 7, value: 7 },
    18,
    "Chassis number",
    chassisValue,
    { id: 9, name: 10, rawValue: 11, value: 11 },
    21,
    "Read mileage",
    "272.200 Kilometres",
    { id: 13, name: 14, rawValue: 15, value: 15 },
    20,
    "First registration",
    "10.2012",
    "Audi Q5 2,0 TDI quattro",
  ]);
}

test("Autobid: ielogotam NUXT dod VIN, nobraukumu un pirmo reģistrāciju", () => {
  const lot = autobidLotFromNuxt(nuxt("WAUZZZ8R3DA016565"));
  assert.equal(lot.vin, "WAUZZZ8R3DA016565");
  assert.equal(lot.mileageKm, 272200);
  assert.equal(lot.firstRegistration, "10.2012");
});

test("Autobid: neielogotam «-» nav VIN, bojāts JSON nekrīt", () => {
  assert.equal(autobidLotFromNuxt(nuxt("-")).vin, "");
  assert.equal(lotVinResult("u", autobidLotFromNuxt(nuxt("-"))).status, "no_vin");
  assert.equal(autobidLotFromNuxt("{nav json").vin, "");
});

test("Openlane: ChassisNumber dziļumā ar km, reģistrāciju un nosaukumu", () => {
  const lot = openlaneLotFromJson({
    Result: { Auction: { ChassisNumber: "w1n2477121j329770", Mileage: 307468, DateFirstRegistration: "2021-12-14T00:00:00", CarName: "Mercedes-Benz GLA 200d" } },
  });
  assert.deepEqual(lot, { vin: "W1N2477121J329770", mileageKm: 307468, firstRegistration: "2021-12-14", title: "Mercedes-Benz GLA 200d" });
});

test("Openlane: ChassisNumber null (meklēšanas rinda) nedod VIN", () => {
  assert.equal(openlaneLotFromJson({ Auctions: [{ ChassisNumber: null, Mileage: 1000 }] }).vin, "");
});

test("lapas teksts: pilns VIN pēc etiķetes, īsais VIN netiek ņemts", () => {
  assert.equal(vinFromPageText("Number of seats 5 VIN W1N2477121J329770 VIN (short) 329770 Number of keys 1"), "W1N2477121J329770");
  assert.equal(vinFromPageText("Номер шасси W1N2477121J329770"), "W1N2477121J329770");
  assert.equal(vinFromPageText("Vehicle Identification No.: WAUZZZ8R3DA016565 Transmission"), "WAUZZZ8R3DA016565");
  assert.equal(vinFromPageText("VIN (short) 329770 Chassis number -"), "");
});

test("cleanVin: tikai 17 derīgas zīmes, I/O/Q nav atļauti", () => {
  assert.equal(cleanVin(" wauzzz8r3da016565 "), "WAUZZZ8R3DA016565");
  assert.equal(cleanVin("WAUZZZ8R3DA01656"), "");
  assert.equal(cleanVin("WAUZZZ8R3DAO16565"), "");
  assert.equal(cleanVin(null), "");
});

test("validLotUrl: tikai lotes lapas uz pareizā hosta", () => {
  assert.equal(validLotUrl("openlane", "https://www.openlane.eu/ru/car/info?auctionId=11862697"), "https://www.openlane.eu/en/car/info?auctionId=11862697");
  assert.equal(validLotUrl("openlane", "https://www.openlane.eu/en/car/11858824"), "https://www.openlane.eu/en/car/11858824");
  assert.equal(validLotUrl("openlane", "https://www.openlane.eu/en/findcar"), "");
  assert.equal(validLotUrl("openlane", "https://evil.example/en/car/info?auctionId=11862697"), "");
  assert.equal(validLotUrl("autobid", "https://autobid.de/en/item/audi-q5-2-0-tdi-quattro-3635359/details"), "https://autobid.de/en/item/audi-q5-2-0-tdi-quattro-3635359/details");
  assert.equal(validLotUrl("autobid", "https://autobid.de/en/item/audi-q5-2-0-tdi-quattro-3635359"), "https://autobid.de/en/item/audi-q5-2-0-tdi-quattro-3635359");
  assert.equal(validLotUrl("autobid", "https://autobid.de/en/search-results"), "");
  assert.equal(validLotUrl("autobid", "http://autobid.de/en/item/x-1"), "");
  assert.equal(validLotUrl("auto1", "https://www.auto1.com/en/app/merchant/car/AB12345"), "");
});

test("lotLooksGone: pāradresācija prom no lotes vai 404", () => {
  const ol = "https://www.openlane.eu/en/car/info?auctionId=11847089";
  assert.equal(lotLooksGone("openlane", ol, ol, "VIN ...", 200), false);
  assert.equal(lotLooksGone("openlane", ol, "https://www.openlane.eu/en/findcar", "Online Car Auctions", 200), true);
  assert.equal(lotLooksGone("openlane", ol, ol, "", 404), true);
  const ab = "https://autobid.de/en/item/audi-q5-3635359/details";
  assert.equal(lotLooksGone("autobid", ab, ab, "INFORMATION", 200), false);
  assert.equal(lotLooksGone("autobid", ab, "https://autobid.de/en/search-results", "", 200), true);
});

test("lotVinResult un vinTail: līguma forma, žurnālā tikai aste", () => {
  assert.deepEqual(lotVinResult("u", { vin: "WAUZZZ8R3DA016565", mileageKm: 5, firstRegistration: "10.2012", title: "T" }), {
    url: "u",
    status: "ok",
    vin: "WAUZZZ8R3DA016565",
    mileageKm: 5,
    firstRegistration: "10.2012",
    title: "T",
  });
  assert.deepEqual(lotVinResult("u", null, { status: "error" }), { url: "u", status: "error", vin: "", mileageKm: null, firstRegistration: "", title: "" });
  assert.equal(vinTail("WAUZZZ8R3DA016565"), "…016565");
});

test("partija: rezultāti ievades secībā ar burtisku url, nederīgie un pēc bloķēšanas ir error", async () => {
  const slots = [
    { raw: "https://www.openlane.eu/ru/car/info?auctionId=1111", url: "https://www.openlane.eu/en/car/info?auctionId=1111" },
    { raw: "nav saite", url: "" },
    { raw: "https://www.openlane.eu/en/car/2222", url: "https://www.openlane.eu/en/car/2222" },
    { raw: "https://www.openlane.eu/en/car/3333", url: "https://www.openlane.eu/en/car/3333" },
  ];
  const openedUrls = [];
  let counted = 0;
  const out = await runLotVinBatch("openlane", slots, {
    countOpen: () => {
      counted += 1;
      return false;
    },
    readOne: async (url) => {
      openedUrls.push(url);
      if (url.endsWith("2222")) return { stop: "blocked", note: "cloudflare_challenge" };
      return { result: lotVinResult(url, { vin: "W1N2477121J329770", mileageKm: 1, firstRegistration: "", title: "" }) };
    },
  });
  assert.equal(out.status, "blocked");
  assert.deepEqual(out.results.map((r) => [r.url, r.status]), [
    ["https://www.openlane.eu/ru/car/info?auctionId=1111", "ok"],
    ["nav saite", "error"],
    ["https://www.openlane.eu/en/car/2222", "error"],
    ["https://www.openlane.eu/en/car/3333", "error"],
  ]);
  assert.deepEqual(openedUrls, ["https://www.openlane.eu/en/car/info?auctionId=1111", "https://www.openlane.eu/en/car/2222"]);
  assert.equal(counted, 2);
  assert.equal(out.opened, 2);
});

test("partija: dienas limits skaita tikai atvērtās lapas, pārējās ir error", async () => {
  const slots = ["a", "b", "c"].map((x) => ({ raw: x, url: `https://autobid.de/en/item/${x}-1` }));
  let left = 1;
  const out = await runLotVinBatch("autobid", slots, {
    limitNote: "dienas limits 300 lotu VIN",
    countOpen: () => (left-- > 0 ? false : true),
    readOne: async (url) => ({ result: lotVinResult(url, { vin: "WAUZZZ8R3DA016565" }) }),
  });
  assert.equal(out.status, "ok");
  assert.equal(out.note, "dienas limits 300 lotu VIN");
  assert.deepEqual(out.results.map((r) => r.status), ["ok", "error", "error"]);
  assert.equal(out.opened, 1);
});
