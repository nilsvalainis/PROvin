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

/** Dzīvais $svue-query cache: nickname, contactPerson.surname, addressBook.items.*.email.to. */
function fixtureSvueQueryAccount() {
  return [
    ["ShallowReactive", 1],
    { state: 2 },
    { "$svue-query": 3 },
    { queries: 4 },
    [5],
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
    { id: 18, name: 19, taxInformation: 20 },
    1001,
    "Audi A6",
    "Including 19% VAT",
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

test("sanitizeAutobidRelayRaw maps nuxtPages only", () => {
  const raw = sanitizeAutobidRelayRaw({ kind: "autobid-nuxt", loggedIn: true, nuxtPages: [JSON.stringify(fixtureWithSecrets())] });
  assert.equal(JSON.stringify(raw).includes(JWT), false);
  assert.equal(raw.loggedIn, true);
  assert.equal(sanitizeAutobidRelayRaw({ kind: "openlane" }).kind, "openlane");
});
