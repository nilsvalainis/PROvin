import assert from "node:assert/strict";
import test from "node:test";

import { fetchCarinfoSuperSearchHttp, validCarinfoSuperSearchUrl } from "./vinscan-http.mjs";

const VIN = "WVWZZZ7NZEV015204";
const URL = `https://www.car.info/en-se/search/super/${VIN}?time=1`;

test("super-search URL ir tikai car.info JSON, ne VIN lapa", () => {
  assert.equal(validCarinfoSuperSearchUrl(URL), URL);
  assert.equal(validCarinfoSuperSearchUrl(`https://car.info/sv-se/search/super/${VIN}`), `https://car.info/sv-se/search/super/${VIN}`);
  assert.equal(validCarinfoSuperSearchUrl(`https://www.car.info/en-dk/vin/DK/${VIN}`), "");
  assert.equal(validCarinfoSuperSearchUrl(`https://stat.vin/search/super/${VIN}`), "");
  assert.equal(validCarinfoSuperSearchUrl("http://www.car.info/en-se/search/super/" + VIN), "");
});

test("plain HTTP sūta XHR galvenes un atdod JSON", async () => {
  let seen = null;
  const out = await fetchCarinfoSuperSearchHttp(URL, {
    fetchImpl: async (input, init) => {
      seen = { input, headers: init.headers };
      return {
        status: 200,
        url: URL,
        text: async () => JSON.stringify({ hits: { idents: [] }, hits_html: "" }),
      };
    },
  });
  assert.equal(seen.input, URL);
  assert.match(seen.headers.accept, /application\/json/);
  assert.equal(seen.headers["x-requested-with"], "XMLHttpRequest");
  assert.equal(seen.headers.referer, "https://www.car.info/en-se/");
  assert.equal(out.ok, true);
  assert.equal(out.status, 200);
  assert.match(out.html, /idents/);
});

test("VIN lapu neprasa no tīkla", async () => {
  let n = 0;
  const out = await fetchCarinfoSuperSearchHttp(`https://www.car.info/en-dk/vin/DK/${VIN}`, {
    fetchImpl: async () => {
      n += 1;
      return { status: 200, url: "", text: async () => "{}" };
    },
  });
  assert.equal(n, 0);
  assert.equal(out.ok, false);
});

test("ilga atbilde tiek nogriezta pirms 52 s", async () => {
  const started = Date.now();
  const out = await fetchCarinfoSuperSearchHttp(URL, {
    timeoutMs: 40,
    fetchImpl: (_input, init) =>
      new Promise((resolve, reject) => {
        const timer = setTimeout(() => resolve({ status: 403, url: URL, text: async () => "forbidden" }), 5_000);
        init.signal.addEventListener("abort", () => {
          clearTimeout(timer);
          const err = new Error("aborted");
          err.name = "AbortError";
          reject(err);
        });
      }),
  });
  assert.ok(Date.now() - started < 500);
  assert.equal(out.ok, false);
  assert.match(out.error, /neatbildēja/);
});
