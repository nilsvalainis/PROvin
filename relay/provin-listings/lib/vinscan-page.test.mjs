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
