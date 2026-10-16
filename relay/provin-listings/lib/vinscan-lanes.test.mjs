import assert from "node:assert/strict";
import test from "node:test";

import { createVinScanLanes, vinScanPageHost, vinScanProfileName } from "./vinscan-lanes.mjs";

async function flush() {
  for (let i = 0; i < 8; i += 1) await Promise.resolve();
}

test("hosts un profili", () => {
  assert.equal(vinScanPageHost("https://www.car.info/sv-se/vin/S/X"), "car.info");
  assert.equal(vinScanPageHost("https://bid.cars/en/search?q=1"), "bid.cars");
  assert.equal(vinScanProfileName("car.info"), "vinscan-car.info");
  assert.equal(vinScanProfileName("stat.vin"), "vinscan-stat.vin");
});

test("car.info un bid.cars startē pirms bloķētajiem", async () => {
  let t = 1_000;
  /** @type {null | (() => void)} */
  let wake = null;
  const started = [];
  const lanes = createVinScanLanes({
    limit: 2,
    nonPriorityDelayMs: 200,
    now: () => t,
    schedule: (fn) => {
      wake = fn;
      return true;
    },
  });
  const urls = [
    "https://stat.vin/cars/WBA",
    "https://bidfax.info/?s=WBA",
    "https://www.car.info/sv-se/vin/S/WBA",
    "https://bid.cars/en/search?q=WBA",
  ];
  const jobs = urls.map((url) =>
    lanes.run(url, async () => {
      started.push(url);
      return url;
    }),
  );
  await flush();
  assert.deepEqual(started, [
    "https://www.car.info/sv-se/vin/S/WBA",
    "https://bid.cars/en/search?q=WBA",
  ]);
  t += 200;
  assert.equal(typeof wake, "function");
  wake();
  await Promise.all(jobs);
  assert.deepEqual(started.slice(2).sort(), [
    "https://bidfax.info/?s=WBA",
    "https://stat.vin/cars/WBA",
  ]);
});

test("tas pats URL atver Chrome vienreiz un atkārtojums ņem kešu", async () => {
  let calls = 0;
  const lanes = createVinScanLanes({
    limit: 2,
    nonPriorityDelayMs: 0,
    recentMs: 45_000,
    now: () => 5_000,
    schedule: () => true,
  });
  const url = "https://stat.vin/cars/WBA";
  const first = lanes.run(url, async () => {
    calls += 1;
    return { status: 403, html: "Access blocked" };
  });
  const second = lanes.run(url, async () => {
    calls += 1;
    return { status: 200, html: "other" };
  });
  const [a, b] = await Promise.all([first, second]);
  assert.equal(calls, 1);
  assert.deepEqual(a, b);
  const third = await lanes.run(url, async () => {
    calls += 1;
    return { status: 200, html: "again" };
  });
  assert.equal(calls, 1);
  assert.equal(third.status, 403);
});

test("divi dažādi hosti iet paralēli, tas pats hosts gaida", async () => {
  const events = [];
  const lanes = createVinScanLanes({
    limit: 2,
    nonPriorityDelayMs: 0,
    now: () => 0,
    schedule: () => true,
  });
  function run(url) {
    return lanes.run(url, async () => {
      events.push(`start ${url}`);
      await new Promise((resolve) => setTimeout(resolve, 25));
      events.push(`end ${url}`);
      return url;
    });
  }
  await Promise.all([
    run("https://stat.vin/cars/1"),
    run("https://bidfax.info/?s=1"),
    run("https://stat.vin/cars/2"),
  ]);
  const startStat2 = events.indexOf("start https://stat.vin/cars/2");
  const endStat1 = events.indexOf("end https://stat.vin/cars/1");
  const startBid = events.indexOf("start https://bidfax.info/?s=1");
  const endStat = events.indexOf("end https://stat.vin/cars/1");
  const startStat = events.indexOf("start https://stat.vin/cars/1");
  assert.ok(startStat >= 0 && startBid >= 0);
  assert.ok(startStat < endStat);
  assert.ok(startBid < endStat);
  assert.ok(endStat1 < startStat2);
});
