import assert from "node:assert/strict";
import { test } from "node:test";

import { readVinSource } from "./vinsource-page.mjs";

const VIN = "TMBJH9NP9H7561596";
const REJECT = { status: 403, text: '{"error":"INVALID_CAPTCHA"}' };
const FOUND = { status: 200, text: JSON.stringify({ recordCheck: { displayRecords: 10 } }) };

/** Viltota Playwright lapa: katrs Enter atdod nākamo `record-check` atbildi no saraksta. */
function fakePage(responses) {
  const queue = [...responses];
  const calls = { goto: 0, enter: 0, clicked: [] };
  let pending = null;
  const input = {
    click: async () => undefined,
    fill: async () => undefined,
    type: async () => undefined,
  };
  const page = {
    calls,
    goto: async () => {
      calls.goto += 1;
      return { status: () => 200 };
    },
    title: async () => "CARFAX",
    waitForTimeout: async () => undefined,
    $: async () => null,
    waitForSelector: async () => input,
    waitForResponse: (pred) =>
      new Promise((resolve) => {
        pending = { pred, resolve };
      }),
    keyboard: {
      press: async () => {
        calls.enter += 1;
        const next = queue.shift();
        if (!next || !pending) return;
        const url = `https://web-backend.carfax.eu/api/v1/record-check/${VIN}?recaptchaToken=x`;
        assert.equal(pending.pred({ url: () => url }), true);
        pending.resolve({ url: () => url, status: () => next.status, text: async () => next.text });
        pending = null;
      },
    },
  };
  return page;
}

test("CARFAX: reCAPTCHA 403 -> viens mēģinājums, captcha karogs, bez atkārtojuma", async () => {
  const page = fakePage([REJECT, FOUND]);
  const out = await readVinSource(page, "carfax_eu", VIN, { timeoutMs: 40_000 });
  assert.equal(out.kind, "error");
  assert.equal(out.captcha, true);
  assert.equal(out.note, "CARFAX.eu: reCAPTCHA noraidīja (403)");
  assert.equal(page.calls.goto, 1);
  assert.equal(page.calls.enter, 1);
});

test("CARFAX: atrasts", async () => {
  const page = fakePage([FOUND]);
  const out = await readVinSource(page, "carfax_eu", VIN, { timeoutMs: 40_000 });
  assert.equal(out.kind, "found");
  assert.equal(out.json.recordCheck.displayRecords, 10);
  assert.equal(out.captcha, undefined);
});

test("CARFAX: ierakstu nav (422) nav kļūda", async () => {
  const page = fakePage([{ status: 422, text: "{}" }]);
  const out = await readVinSource(page, "carfax_eu", VIN, { timeoutMs: 40_000 });
  assert.equal(out.kind, "none");
});

test("CARFAX: cits 403 (bez INVALID_CAPTCHA) nav captcha", async () => {
  const page = fakePage([{ status: 403, text: "Forbidden" }]);
  const out = await readVinSource(page, "carfax_eu", VIN, { timeoutMs: 40_000 });
  assert.equal(out.kind, "error");
  assert.equal(out.captcha, undefined);
});

/** Viltota kfzgutachten.at lapa: «Suchen» klikšķis atdod `POST /Home/Search` atbildi. */
function fakeKfzPage(response) {
  const calls = { goto: [], typed: [], clicked: 0 };
  let pending = null;
  const field = (name) => ({
    click: async () => undefined,
    fill: async () => undefined,
    type: async (text) => {
      calls.typed.push([name, text]);
    },
  });
  const button = {
    click: async () => {
      calls.clicked += 1;
      if (!pending || !response) return;
      const url = "https://kfzgutachten.at/Home/Search";
      assert.equal(pending.pred({ url: () => url, request: () => ({ method: () => "POST" }) }), true);
      pending.resolve({ url: () => url, status: () => response.status, text: async () => response.text });
    },
  };
  return {
    calls,
    goto: async (url) => {
      calls.goto.push(url);
      return { status: () => 200 };
    },
    title: async () => "kfzgutachten.at",
    waitForTimeout: async () => undefined,
    waitForSelector: async (sel) => (sel === "#vehicleIdInput" ? field("vin") : null),
    $: async (sel) => (sel === "#regDtInput" ? field("date") : sel === "#searchButton" ? button : null),
    $eval: async () => "",
    waitForResponse: (pred) =>
      new Promise((resolve) => {
        pending = { pred, resolve };
      }),
    keyboard: { press: async () => undefined },
  };
}

const KFZ_VIN = "WBAFB71080LV66575";

test("kfzgutachten.at: tīra sākumlapa (bez ?vin=), VIN + datums, viens «Suchen», saraksts", async () => {
  const page = fakeKfzPage({
    status: 200,
    text: JSON.stringify({
      TotalItems: 1,
      Items: [{ Id: 1, VehicleModel: "BMW", VehicleType: "X5", EvaluationDate: "2019-07-30T00:00:00", LicensePlate: "W 1234GT", VehicleIdentificationNumber: KFZ_VIN }],
    }),
  });
  const out = await readVinSource(page, "kfz_at", KFZ_VIN, { timeoutMs: 40_000, date: "20.08.2004" });
  assert.equal(out.kind, "found");
  assert.deepEqual(out.rows, [{ date: "30.07.2019", model: "BMW X5", plate: "W 1234GT", vin: KFZ_VIN }]);
  assert.deepEqual(page.calls.goto, ["https://kfzgutachten.at/"]);
  assert.deepEqual(page.calls.typed, [["vin", KFZ_VIN], ["date", "20.08.2004"]]);
  assert.equal(page.calls.clicked, 1);
});

test("kfzgutachten.at: reCAPTCHA atteikums -> captcha karogs, bez atkārtojuma", async () => {
  const page = fakeKfzPage({ status: 400, text: "Recaptcha validation failed" });
  const out = await readVinSource(page, "kfz_at", KFZ_VIN, { timeoutMs: 40_000, date: "20.08.2004" });
  assert.equal(out.kind, "error");
  assert.equal(out.captcha, true);
  assert.equal(page.calls.clicked, 1);
  assert.equal(page.calls.goto.length, 1);
});
