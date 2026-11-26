import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CARFAX_CACHE_MS,
  CARFAX_COOLDOWN_BASE_MS,
  carfaxRecordCheckMatches,
  createVinSourceCache,
  createCarfaxCooldown,
  readBidCarsSearch,
  readCarfaxRecordCheck,
  validBidCarsLotUrl,
  validVinSourceRequest,
  vinSourceLaneKey,
} from "./vinsource-logic.mjs";

const VIN = "WBA5R1C0XLFH42873";

test("validVinSourceRequest: tikai zināmi avoti un 17 zīmju VIN", () => {
  assert.deepEqual(validVinSourceRequest({ source: "bid_cars", vin: " wba5r1c0xlfh42873 " }), { ok: true, source: "bid_cars", vin: VIN });
  assert.equal(validVinSourceRequest({ source: "plc_auction", vin: VIN }).ok, false);
  assert.equal(validVinSourceRequest({ source: "carfax_eu", vin: "WBA5R1C0XLFH4287" }).ok, false);
  assert.equal(validVinSourceRequest({ source: "carfax_eu", vin: "WBA5R1C0XLFH4287O" }).ok, false);
  assert.equal(validVinSourceRequest(null).ok, false);
});

test("vinSourceLaneKey: visi avoti vienā hostā (viena Chrome josla)", () => {
  const a = new URL(vinSourceLaneKey("bid_cars", VIN)).hostname;
  const b = new URL(vinSourceLaneKey("carfax_eu", VIN)).hostname;
  assert.equal(a, b);
});

test("readBidCarsSearch: lots, nav, kļūda", () => {
  const lot = readBidCarsSearch(
    '{"results":1,"url":"https:\\/\\/bid.cars\\/en\\/lot\\/0-27382814\\/2020-BMW-3-Series-WBA5R1C0XLFH42873"}',
    VIN,
  );
  assert.equal(lot.kind, "lot");
  assert.equal(lot.lotUrl, "https://bid.cars/en/lot/0-27382814/2020-BMW-3-Series-WBA5R1C0XLFH42873");
  assert.equal(
    readBidCarsSearch('{"results":0,"url":"https:\\/\\/bid.cars\\/en\\/search\\/archived\\/results?search-type=typing&query=X"}', VIN).kind,
    "none",
  );
  assert.equal(readBidCarsSearch('{"results":0}', VIN).kind, "none");
  assert.equal(readBidCarsSearch("<html>Just a moment</html>", VIN).kind, "error");
  // Cita VIN lots nav šī auto lapa.
  assert.equal(readBidCarsSearch('{"results":1,"url":"https://bid.cars/en/lot/1-1234567/2019-Jeep-1C4PJMDB9JD528953"}', VIN).kind, "error");
});

test("validBidCarsLotUrl: tikai bid.cars https lota ceļš", () => {
  assert.equal(validBidCarsLotUrl(`https://evil.example/en/lot/0-27382814/x-${VIN}`, VIN), "");
  assert.equal(validBidCarsLotUrl(`http://bid.cars/en/lot/0-27382814/x-${VIN}`, VIN), "");
  assert.equal(validBidCarsLotUrl(`https://bid.cars/en/search/x-${VIN}`, VIN), "");
});

test("readCarfaxRecordCheck: 200 ar recordCheck = found, 422/404 = none, citādi kļūda", () => {
  assert.equal(readCarfaxRecordCheck(200, '{"recordCheck":{"displayRecords":8}}').kind, "found");
  assert.equal(readCarfaxRecordCheck(422, '{"make":"VOLKSWAGEN"}').kind, "none");
  assert.equal(readCarfaxRecordCheck(404, "").kind, "none");
  assert.equal(readCarfaxRecordCheck(500, "oops").kind, "error");
  assert.equal(readCarfaxRecordCheck(200, '{"foo":1}').kind, "error");
});

test("carfaxRecordCheckMatches: tikai šī VIN record-check", () => {
  assert.equal(carfaxRecordCheckMatches(`https://web-backend.carfax.eu/api/v1/record-check/${VIN}?variant=VARIANT_1&recaptchaToken=x`, VIN), true);
  assert.equal(carfaxRecordCheckMatches("https://web-backend.carfax.eu/api/v1/record-check/TMBJH9NP9H7561596", VIN), false);
  assert.equal(carfaxRecordCheckMatches(`https://evil.example/api/v1/record-check/${VIN}`, VIN), false);
});

test("createVinSourceCache: 24 h tikai found/none, vecākie izkrīt", () => {
  let t = 0;
  const cache = createVinSourceCache({ now: () => t, ttlMs: 1000, max: 2 });
  cache.set("a", { kind: "error", note: "x" });
  assert.equal(cache.get("a"), null);
  cache.set("a", { kind: "found", html: "<p>" });
  assert.equal(cache.get("a").cached, true);
  t = 1500;
  assert.equal(cache.get("a"), null);
  cache.set("b", { kind: "none" });
  cache.set("c", { kind: "none" });
  cache.set("d", { kind: "none" });
  assert.equal(cache.size, 2);
  assert.equal(cache.get("b"), null);
});

test("createCarfaxCooldown: pauze pēc captcha, dubultojas, veiksme atiestata", () => {
  let t = 1_000_000;
  const cd = createCarfaxCooldown({ baseMs: 1_000, maxMs: 3_000, now: () => t });
  assert.equal(cd.remainingMs(), 0);
  cd.record({ kind: "error", note: "cits" });
  assert.equal(cd.remainingMs(), 0, "ne-captcha kļūda pauzi neieslēdz");
  cd.record({ kind: "error", captcha: true });
  assert.equal(cd.remainingMs(), 1_000);
  assert.ok(cd.untilIso());
  t += 1_000;
  assert.equal(cd.remainingMs(), 0);
  cd.record({ kind: "error", captcha: true });
  assert.equal(cd.remainingMs(), 2_000);
  cd.record({ kind: "error", captcha: true });
  assert.equal(cd.remainingMs(), 3_000, "griesti");
  cd.record({ kind: "found" });
  assert.equal(cd.remainingMs(), 0);
  assert.equal(cd.strikes, 0);
  assert.equal(CARFAX_COOLDOWN_BASE_MS >= 10 * 60 * 1000, true);
});

test("createVinSourceCache: avotam savs derīgums (carfax_eu 7 d)", () => {
  let t = 0;
  const cache = createVinSourceCache({ now: () => t, ttlBySource: { carfax_eu: CARFAX_CACHE_MS } });
  const cf = vinSourceLaneKey("carfax_eu", VIN);
  const bc = vinSourceLaneKey("bid_cars", VIN);
  cache.set(cf, { kind: "found", json: {} });
  cache.set(bc, { kind: "none" });
  t = 2 * 24 * 60 * 60 * 1000;
  assert.equal(cache.get(cf)?.kind, "found");
  assert.equal(cache.get(bc), null);
  t = CARFAX_CACHE_MS + 1;
  assert.equal(cache.get(cf), null);
});

import { createKfzScheduler, KFZ_MIN_INTERVAL_MS, kfzExactDate, kfzSearchResponseMatches, readKfzSearch } from "./vinsource-logic.mjs";

const KVIN = "WBAFB71080LV66575";

test("kfz_at pieprasījums: vajag precīzu datumu; atslēgā VIN + datums", () => {
  assert.deepEqual(validVinSourceRequest({ source: "kfz_at", vin: KVIN, date: "2004-08-20" }), {
    ok: true,
    source: "kfz_at",
    vin: KVIN,
    date: "20.08.2004",
  });
  assert.equal(validVinSourceRequest({ source: "kfz_at", vin: KVIN }).ok, false);
  assert.equal(validVinSourceRequest({ source: "kfz_at", vin: KVIN, date: "08.2004" }).ok, false);
  assert.equal(validVinSourceRequest({ source: "kfz_at", vin: KVIN, date: "31.02.2004" }).ok, false);
  assert.equal(kfzExactDate("1.8.2004"), "01.08.2004");
  assert.equal(vinSourceLaneKey("kfz_at", KVIN, "20.08.2004"), `https://vinsource.relay/kfz_at/${KVIN}/20.08.2004`);
  // Kešs ņem avota derīgumu no atslēgas 4. daļas.
  assert.equal(new URL(vinSourceLaneKey("kfz_at", KVIN, "20.08.2004")).pathname.split("/")[1], "kfz_at");
});

test("kfzSearchResponseMatches: tikai POST /Home/Search", () => {
  assert.equal(kfzSearchResponseMatches("https://kfzgutachten.at/Home/Search", "POST"), true);
  assert.equal(kfzSearchResponseMatches("https://www.kfzgutachten.at/home/search", "post"), true);
  assert.equal(kfzSearchResponseMatches("https://kfzgutachten.at/Home/UpdateBasket", "POST"), false);
  assert.equal(kfzSearchResponseMatches("https://kfzgutachten.at/Home/Search", "GET"), false);
  assert.equal(kfzSearchResponseMatches("https://evil.example/Home/Search", "POST"), false);
});

test("readKfzSearch: saraksts, cits VIN izmests, dublikāti, kārtība, nobraukums ja ir", () => {
  const out = readKfzSearch(
    200,
    JSON.stringify({
      TotalItems: 4,
      Items: [
        { EvaluationDate: "2021-06-01T00:00:00", VehicleModel: "BMW", VehicleType: "X5 3,0d", LicensePlate: "W 1234GT", VehicleIdentificationNumber: KVIN, Mileage: "185 000" },
        { EvaluationDate: "2019-05-02T00:00:00", VehicleModel: "BMW", VehicleType: "X5", LicensePlate: "W 1234GT", VehicleIdentificationNumber: KVIN },
        { EvaluationDate: "2019-05-02T00:00:00", VehicleModel: "BMW", VehicleType: "X5", LicensePlate: "W 1234 GT", VehicleIdentificationNumber: KVIN },
        { EvaluationDate: "2020-01-01T00:00:00", VehicleModel: "VW", VehicleType: "Golf", LicensePlate: "G 1A", VehicleIdentificationNumber: "WVWZZZ1KZ6W000001" },
      ],
    }),
    KVIN,
  );
  assert.equal(out.kind, "found");
  assert.deepEqual(
    out.rows.map((r) => [r.date, r.km ?? ""]),
    [
      ["02.05.2019", ""],
      ["01.06.2021", "185000"],
    ],
  );
});

test("readKfzSearch: tukšs saraksts = nav; reCAPTCHA un neskaidra atbilde = kļūda (nekešo)", () => {
  assert.equal(readKfzSearch(200, '{"Items":[],"TotalItems":0}', KVIN).kind, "none");
  const cap = readKfzSearch(200, '{"error":"Recaptcha validation failed"}', KVIN);
  assert.equal(cap.kind, "error");
  assert.equal(cap.captcha, true);
  assert.equal(readKfzSearch(403, "Forbidden", KVIN).captcha, true);
  const odd = readKfzSearch(200, "{}", KVIN);
  assert.equal(odd.kind, "error");
  assert.equal(odd.captcha, undefined);
  assert.equal(readKfzSearch(500, "x", KVIN).captcha, undefined);
});

test("createKfzScheduler: ≥2 min starp vaicājumiem, rinda FIFO bez dublikātiem, pilna rinda", () => {
  let t = 1_000_000;
  const s = createKfzScheduler({ now: () => t, maxPending: 2 });
  assert.equal(s.waitMs(), 0);
  s.markRun();
  assert.equal(s.waitMs(), KFZ_MIN_INTERVAL_MS);
  assert.equal(s.enqueue("a", KVIN, "20.08.2004"), 1);
  assert.equal(s.enqueue("b", KVIN, "21.08.2004"), 2);
  assert.equal(s.enqueue("a", KVIN, "20.08.2004"), 1);
  assert.equal(s.enqueue("c", KVIN, "22.08.2004"), 0);
  assert.equal(s.takeNext(), null);
  t += KFZ_MIN_INTERVAL_MS;
  assert.equal(s.takeNext(60_000), null, "atdzišanas laikā nedod");
  assert.equal(s.takeNext().key, "a");
  s.markRun();
  assert.equal(s.takeNext(), null);
  t += KFZ_MIN_INTERVAL_MS;
  assert.equal(s.takeNext().key, "b");
  assert.equal(s.size, 0);
});

test("kfz_at atdzišana: tā pati kā CARFAX (20 min -> dubulto)", () => {
  let t = 0;
  const cd = createCarfaxCooldown({ now: () => t });
  cd.record({ kind: "error", captcha: true });
  assert.equal(cd.remainingMs(), CARFAX_COOLDOWN_BASE_MS);
  cd.record({ kind: "error", captcha: true });
  assert.equal(cd.remainingMs(), 2 * CARFAX_COOLDOWN_BASE_MS);
  cd.record({ kind: "none" });
  assert.equal(cd.remainingMs(), 0);
});
