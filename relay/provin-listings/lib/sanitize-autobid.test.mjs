import assert from "node:assert/strict";
import test from "node:test";

import { isAutobidSecretString, sanitizeAutobidNuxtJson, sanitizeAutobidRelayRaw } from "./sanitize-autobid.mjs";

const JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0IiwibmFtZSI6IkpvaG4ifQ.sflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
const BEARER = `Bearer ${JWT}`;

function fixtureWithSecrets() {
  return [
    ["ShallowReactive", 1],
    { state: 2 },
    { auth: 3, "$svue-query": 10 },
    { token: 4, user: 5, refreshToken: 9 },
    JWT,
    { email: 6, firstName: 7, lastName: 8, id: 11 },
    "operator@example.com",
    "Jānis",
    "Bērziņš",
    JWT,
    { data: 12 },
    42,
    { itemPageCount: 13, items: 14 },
    1,
    [15],
    { id: 16, name: 17, taxInformation: 18, authorization: 19 },
    3587391,
    "Volvo XC60 B5 AWD",
    "Including 19% VAT",
    BEARER,
  ];
}

/** Dzīvais $svue-query cache; auto ir sasniedzams no saknes. */
function fixtureSvueQueryAccount() {
  return [
    ["ShallowReactive", 1],
    { state: 2 },
    { "$svue-query": 3 },
    { queries: 4 },
    [5, 17],
    { state: 6 },
    { data: 7 },
    { nickname: 8, extendedData: 9 },
    "op-nick",
    { contactPerson: 10, addressBook: 11 },
    { surname: 12 },
    { items: 13 },
    "Kalniņš",
    [14],
    { email: 15 },
    { to: 16 },
    "leak@example.com",
    { state: 18 },
    { data: 19 },
    { itemPageCount: 20, items: 21 },
    1,
    [22],
    { id: 23, auctionId: 26, name: 24, taxInformation: 25, price: 27 },
    1001,
    "Audi A6",
    "Including 19% VAT",
    9001,
    { start: 28, minimal: 29, current: 30 },
    15000,
    0,
    0,
  ];
}

/**
 * Kopīgs devalue slots: items[].name un user.displayName rāda uz to pašu "Audi A6";
 * taxInformation ir arī dropped extendedData apakškokā.
 */
function fixtureSharedSlots() {
  return [
    ["ShallowReactive", 1],
    { state: 2 },
    { user: 3, "$svue-query": 8 },
    { nickname: 4, displayName: 5, email: 6, extendedData: 7 },
    "op-nick",
    "Audi A6",
    "leak@example.com",
    { taxInformation: 16, contactPerson: 17 },
    { queries: 9 },
    [10],
    { state: 11 },
    { data: 12 },
    { itemPageCount: 13, items: 14 },
    1,
    [15],
    { id: 18, auctionId: 26, name: 5, slug: 19, stage: 20, auctionStartDate: 21, taxInformation: 16, equipments: 22, price: 27 },
    "Including 19% VAT",
    { surname: 23 },
    1001,
    "audi-a6",
    "IN_AUCTION",
    "2026-10-01T08:00:00.000Z",
    { eq68: 24 },
    "Kalniņš",
    { value: 25 },
    "120000",
    9001,
    { start: 28, minimal: 29, current: 30 },
    15000,
    0,
    0,
  ];
}

test("JWT and Bearer strings are secrets", () => {
  assert.equal(isAutobidSecretString(JWT), true);
  assert.equal(isAutobidSecretString(BEARER), true);
  assert.equal(isAutobidSecretString("Including 19% VAT"), false);
  assert.equal(isAutobidSecretString("Volvo XC60 B5 AWD"), false);
});

test("sanitizeAutobidNuxtJson drops Bearer, JWT and account fields but keeps listing data", () => {
  const out = JSON.parse(sanitizeAutobidNuxtJson(JSON.stringify(fixtureWithSecrets())));
  const dumped = JSON.stringify(out);
  assert.equal(dumped.includes(JWT), false);
  assert.equal(/Bearer\s/i.test(dumped), false);
  assert.equal(dumped.includes("operator@example.com"), false);
  assert.equal(dumped.includes("Jānis"), false);
  assert.equal(dumped.includes("Bērziņš"), false);
  assert.equal(dumped.includes("Volvo XC60 B5 AWD"), true);
  assert.equal(dumped.includes("Including 19% VAT"), true);
  assert.equal(out[16], 3587391);
});

test("invalid JSON still has JWT/Bearer stripped", () => {
  const raw = `not-json ${BEARER} tail ${JWT}`;
  const out = sanitizeAutobidNuxtJson(raw);
  assert.equal(out.includes(JWT), false);
  assert.equal(/Bearer\s/i.test(out), false);
});

test("sanitizeAutobidNuxtJson empties $svue-query nickname, surname and nested email.to", () => {
  const dumped = sanitizeAutobidNuxtJson(JSON.stringify(fixtureSvueQueryAccount()));
  assert.equal(dumped.includes("leak@example.com"), false);
  assert.equal(dumped.includes("op-nick"), false);
  assert.equal(dumped.includes("Kalniņš"), false);
  assert.equal(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(dumped), false);
  assert.equal(dumped.includes("Audi A6"), true);
  assert.equal(dumped.includes("Including 19% VAT"), true);
});

test("shared slots keep items[].name and taxInformation while account data is gone", () => {
  const dumped = sanitizeAutobidNuxtJson(JSON.stringify(fixtureSharedSlots()));
  assert.equal(dumped.includes("leak@example.com"), false);
  assert.equal(dumped.includes("op-nick"), false);
  assert.equal(dumped.includes("Kalniņš"), false);
  assert.equal(dumped.includes("Audi A6"), true);
  assert.equal(dumped.includes("Including 19% VAT"), true);
  assert.equal(dumped.includes("audi-a6"), true);
  assert.equal(dumped.includes("IN_AUCTION"), true);
  assert.equal(dumped.includes("120000"), true);
  const out = JSON.parse(dumped);
  assert.equal(out[5], "Audi A6");
  assert.equal(out[16], "Including 19% VAT");
});

test("sanitizeAutobidRelayRaw maps nuxtPages only", () => {
  const raw = sanitizeAutobidRelayRaw({ kind: "autobid-nuxt", loggedIn: true, nuxtPages: [JSON.stringify(fixtureWithSecrets())] });
  assert.equal(JSON.stringify(raw).includes(JWT), false);
  assert.equal(raw.loggedIn, true);
  assert.equal(sanitizeAutobidRelayRaw({ kind: "openlane" }).kind, "openlane");
});
