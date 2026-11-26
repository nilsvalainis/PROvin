import assert from "node:assert/strict";
import { test } from "node:test";

import { CARFAX_MAX_ATTEMPTS } from "./vinsource-logic.mjs";
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

test("CARFAX: pēc reCAPTCHA 403 pārlādē un meklē vēlreiz tajā pašā sesijā", async () => {
  const page = fakePage([REJECT, FOUND]);
  const out = await readVinSource(page, "carfax_eu", VIN, { timeoutMs: 40_000 });
  assert.equal(out.kind, "found");
  assert.equal(out.attempts, 2);
  assert.equal(page.calls.goto, 2);
  assert.equal(out.json.recordCheck.displayRecords, 10);
});

test("CARFAX: pirmais mēģinājums izdodas - bez atkārtojuma", async () => {
  const page = fakePage([FOUND, FOUND]);
  const out = await readVinSource(page, "carfax_eu", VIN, { timeoutMs: 40_000 });
  assert.equal(out.kind, "found");
  assert.equal(out.attempts, 1);
  assert.equal(page.calls.enter, 1);
});

test("CARFAX: ierakstu nav (422) nav kļūda un netiek atkārtots", async () => {
  const page = fakePage([{ status: 422, text: "{}" }, FOUND]);
  const out = await readVinSource(page, "carfax_eu", VIN, { timeoutMs: 40_000 });
  assert.equal(out.kind, "none");
  assert.equal(out.attempts, 1);
});

test("CARFAX: ne vairāk par maksimumu, tad skaidra kļūda", async () => {
  const page = fakePage(Array.from({ length: CARFAX_MAX_ATTEMPTS + 2 }, () => REJECT));
  const out = await readVinSource(page, "carfax_eu", VIN, { timeoutMs: 120_000 });
  assert.equal(out.kind, "error");
  assert.equal(out.note, "CARFAX.eu: reCAPTCHA noraidīja (403)");
  assert.equal(out.attempts, CARFAX_MAX_ATTEMPTS);
  assert.equal(page.calls.enter, CARFAX_MAX_ATTEMPTS);
});

test("CARFAX: ja laika par maz, neatkārto", async () => {
  const page = fakePage([REJECT, FOUND]);
  const out = await readVinSource(page, "carfax_eu", VIN, { timeoutMs: 8_000 });
  assert.equal(out.kind, "error");
  assert.equal(out.attempts, 1);
});
