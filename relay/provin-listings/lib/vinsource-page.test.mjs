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
