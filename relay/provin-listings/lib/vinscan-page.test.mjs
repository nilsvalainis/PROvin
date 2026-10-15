import assert from "node:assert/strict";
import test from "node:test";

import { fetchVinScanPageHtml, validVinScanPageUrl, VINSCAN_PAGE_HOSTS } from "./vinscan-page.mjs";

test("VIN SCAN page URL allowlist", () => {
  assert.equal(validVinScanPageUrl("https://stat.vin/cars/WBA"), "https://stat.vin/cars/WBA");
  assert.equal(validVinScanPageUrl("https://www.bid.cars/en/search?q=1"), "https://www.bid.cars/en/search?q=1");
  assert.equal(validVinScanPageUrl("https://checkcar.vin/report/check/WBA"), "https://checkcar.vin/report/check/WBA");
  assert.equal(validVinScanPageUrl("https://bidfax.info/?s=WBA"), "https://bidfax.info/?s=WBA");
  assert.equal(validVinScanPageUrl("https://poctra.com/search/WBA"), "https://poctra.com/search/WBA");
  assert.equal(validVinScanPageUrl("https://plc.auction/?vin=WBA"), "https://plc.auction/?vin=WBA");
  assert.equal(
    validVinScanPageUrl("https://adify.lv/history?url=https://www.ss.lv/msg/x.html"),
    "https://adify.lv/history?url=https://www.ss.lv/msg/x.html",
  );
  assert.equal(
    validVinScanPageUrl("https://tirgusdati.lv/vesture?q=https://www.ss.lv/msg/x.html"),
    "https://tirgusdati.lv/vesture?q=https://www.ss.lv/msg/x.html",
  );
  assert.equal(validVinScanPageUrl("https://www.ss.lv/msg/lv/x.html"), "https://www.ss.lv/msg/lv/x.html");
  assert.equal(validVinScanPageUrl("https://www.ss.com/msg/lv/x.html"), "https://www.ss.com/msg/lv/x.html");
  assert.equal(validVinScanPageUrl("https://www.car.info/en-se/vin/S/YV1LW5522V2348444"), "https://www.car.info/en-se/vin/S/YV1LW5522V2348444");
  assert.equal(validVinScanPageUrl("http://stat.vin/cars/WBA"), "");
  assert.equal(validVinScanPageUrl("https://openlane.eu/search"), "");
  assert.equal(validVinScanPageUrl("https://evil.example/stat.vin"), "");
  assert.ok(VINSCAN_PAGE_HOSTS.includes("stat.vin"));
});

test("fetchVinScanPageHtml waits out Access blocked WAF then returns HTML", async () => {
  let n = 0;
  const page = {
    goto: async () => ({ status: () => 403 }),
    content: async () => {
      n += 1;
      if (n < 3) return "Access blocked, contact us at support@stat.vin A";
      return "<html><body>RAM 2500 Sale History Copart</body></html>";
    },
    title: async () => (n < 3 ? "" : "stat.vin"),
    url: () => "https://stat.vin/cars/WBA",
  };
  const out = await fetchVinScanPageHtml(page, "https://stat.vin/cars/WBA", { sleep: async () => undefined });
  assert.match(out.html, /Sale History/);
  assert.ok(n >= 3);
});

test("fetchVinScanPageHtml waits out Just a moment then returns HTML", async () => {
  let n = 0;
  const page = {
    goto: async () => ({ status: () => 200 }),
    content: async () => {
      n += 1;
      if (n < 3) return "<html><title>Just a moment...</title></html>";
      return "<html><body>RAM 2500 Sale History Copart</body></html>";
    },
    title: async () => (n < 3 ? "Just a moment..." : "stat.vin"),
    url: () => "https://stat.vin/cars/WBA",
  };
  const out = await fetchVinScanPageHtml(page, "https://stat.vin/cars/WBA", { sleep: async () => undefined });
  assert.equal(out.status, 200);
  assert.match(out.html, /Sale History/);
  assert.equal(out.finalUrl, "https://stat.vin/cars/WBA");
  assert.ok(n >= 3);
});

const ACCEPT_VIN = "WDD1173421N570488";
const ACCEPT_HTML = `<html><body><h1>VIN: ${ACCEPT_VIN}</h1><p>Sale History Copart FI</p><p>Lot: 50558298</p><p>20 photos</p></body></html>`;

test("tukša HTTP 403 aina nav gatava lapa: gaida Just a moment un atdod 200", async () => {
  let t = 1_000_000;
  let n = 0;
  const page = {
    goto: async () => ({ status: () => 403, text: async () => "" }),
    content: async () => {
      n += 1;
      if (t < 1_004_000) return "<html><head></head><body></body></html>";
      if (t < 1_007_000) return "<html><head><title>Just a moment...</title></head><body>Performing security verification</body></html>";
      return ACCEPT_HTML;
    },
    title: async () => (t < 1_007_000 ? "" : "stat.vin"),
    url: () => `https://stat.vin/cars/${ACCEPT_VIN}`,
    mouse: { move: async () => undefined },
  };
  const out = await fetchVinScanPageHtml(page, `https://stat.vin/cars/${ACCEPT_VIN}`, {
    now: () => t,
    sleep: async (ms) => {
      t += ms;
    },
    timeoutMs: 40_000,
  });
  assert.equal(out.status, 200);
  assert.match(out.html, /50558298/);
  assert.match(out.html, /Copart FI/);
  assert.ok(n > 2);
  assert.ok(t >= 1_007_000);
});

test("cf_clearance profilā izsauc otru navigāciju un tad atdod izsoles HTML", async () => {
  let gotos = 0;
  const page = {
    goto: async () => {
      gotos += 1;
      return { status: () => 403, text: async () => "" };
    },
    content: async () =>
      gotos < 2
        ? "<html><title>Just a moment...</title><body>Performing security verification</body></html>"
        : ACCEPT_HTML,
    title: async () => (gotos < 2 ? "Just a moment..." : "stat.vin"),
    url: () => `https://stat.vin/cars/${ACCEPT_VIN}`,
  };
  let t = 5_000_000;
  const out = await fetchVinScanPageHtml(page, `https://stat.vin/cars/${ACCEPT_VIN}`, {
    context: {
      cookies: async () => [{ name: "cf_clearance", value: "clearance-token-value" }],
    },
    now: () => t,
    sleep: async (ms) => {
      t += ms;
    },
    timeoutMs: 30_000,
  });
  assert.ok(gotos >= 2);
  assert.equal(out.status, 200);
  assert.match(out.html, /50558298/);
});
